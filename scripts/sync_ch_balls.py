#!/usr/bin/env python3
"""
Ball-by-ball rebuilt from CricHeroes → Supabase ch_ball_matches / ch_balls.

CricHeroes' commentary feed has every delivery EXCEPT the ones a wicket fell on.
Their ball_id runs consecutively through an innings, so each missing wicket ball
is a gap in the ids (or, for the last wicket, a ball missing off the end). The
scorecard supplies the rest: who was out, how, and to whom. This script fills
the gaps and checks the result against the scorecard before trusting it.

What the feed does and doesn't carry, found by comparing 25 matches:
  * wide / no-ball penalty run is NOT in run or extra_run — add 1 per wd/nb
  * with that, commentary + wicket balls reproduces the scorecard total to 0–2
    runs, the remainder being runs scored on wicket balls (run outs mostly)
  * the batter is only in the TEXT: "<bowler> to <batter>, <outcome>"
  * non-striker is never given

Quality per match, stored so the app can say how far to trust it:
  exact    team runs, wickets and every batter's runs & balls match the card
  close    team runs within 3 and wickets match
  partial  anything worse — kept, but the app flags it

Prereq: supabase/migrations/add_cricheroes_balls.sql (run by hand).
Run:    python3 scripts/sync_ch_balls.py                 # new matches only
        python3 scripts/sync_ch_balls.py --all           # rebuild everything
        python3 scripts/sync_ch_balls.py --match 27074034 --dry-run
"""
import argparse, json, os, re, sys, time, urllib.error, urllib.request
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_scorecards import ch_api_headers  # same CricHeroes auth, one place to rotate it

SUPABASE_URL = "https://nptvrfqonfmafvbzjrih.supabase.co"
SUPABASE_KEY = "sb_publishable_NC3gqU5FnEFEhSO9KWPKNg_WpLnfo9G"
COMMENTARY = "https://api.cricheroes.in/api/v1/scorecard/get-commentary/{}"


def ch_get(url, retries=3):
    import gzip
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=ch_api_headers())
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                body = json.loads(raw.decode())
                return body.get("data") if isinstance(body, dict) and "data" in body else body
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))


def sb(method, path, body=None, prefer=None):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", **({"Prefer": prefer} if prefer else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {method} {path[:80]}: {e.read().decode()[:300]}")


# ── names ─────────────────────────────────────────────────────────────────────
def clean(name):
    return re.sub(r"\s*\((c|wk|c & wk|wk & c|rs|ip)\)\s*", " ", name or "", flags=re.I).strip()

def norm(name):
    return re.sub(r"[^a-z ]", "", clean(name).lower()).strip()


class Roster:
    """Name → player key for one side. Keys are CricHeroes ids where the card has
    one, otherwise 'n:<name>' — a fielder who neither batted nor bowled."""

    def __init__(self):
        self.by_norm, self.players = {}, {}

    def add(self, pid, name, team_id):
        if not name:
            return
        key = str(pid) if pid else f"n:{clean(name)}"
        self.players[key] = {"name": clean(name), "team_id": team_id}
        self.by_norm.setdefault(norm(name), key)

    def key(self, name, team_id, create=True):
        n = norm(name)
        if not n:
            return None
        if n in self.by_norm:
            return self.by_norm[n]
        # "Suresh" in a dismissal for "Suresh Patil" on the card; one match only.
        hits = [k for nn, k in self.by_norm.items()
                if self.players[k]["team_id"] == team_id and (nn.startswith(n) or n.startswith(nn) or n in nn.split())]
        if len(set(hits)) == 1:
            return hits[0]
        best = max(((SequenceMatcher(None, n, nn).ratio(), k) for nn, k in self.by_norm.items()
                    if self.players[k]["team_id"] == team_id), default=(0, None))
        if best[0] >= 0.85:
            return best[1]
        if not create:
            return None
        key = f"n:{clean(name)}"
        self.players[key] = {"name": clean(name), "team_id": team_id}
        self.by_norm[n] = key
        return key


# ── dismissals ────────────────────────────────────────────────────────────────
def parse_out(text):
    """'c Govind Sharma b Nikhil' → ('caught', 'Govind Sharma', 'Nikhil')."""
    t = (text or "").strip()
    tl = t.lower()
    if tl.startswith("retired out"):
        return ("retired_out", None, None)    # a wicket under ICC law, nobody's credit
    if not t or tl in ("not out", "dnb", "did not bat") or tl.startswith("retired") or "absent" in tl:
        return None
    m = re.match(r"^c\s*(?:&|and)\s*b\s+(.+)$", t, re.I)
    if m:
        return ("caught", "__bowler__", m.group(1))
    m = re.match(r"^c\s+(.+?)\s+b\s+(.+)$", t, re.I)
    if m:
        return ("caught", m.group(1), m.group(2))
    m = re.match(r"^st\s+(.+?)\s+b\s+(.+)$", t, re.I)
    if m:
        return ("stumped", m.group(1), m.group(2))
    m = re.match(r"^lbw\s+(?:b\s+)?(.+)$", t, re.I)
    if m:
        return ("lbw", None, m.group(1))
    m = re.match(r"^hit\s*wicket\s+(?:b\s+)?(.+)$", t, re.I)
    if m:
        return ("hit_wicket", None, m.group(1))
    m = re.match(r"^run\s*out\s*\(?([^)/]*)", t, re.I)
    if m:
        return ("run_out", m.group(1).strip() or None, None)
    m = re.match(r"^b\s+(.+)$", t, re.I)
    if m:
        return ("bowled", None, m.group(1))
    return ("other", None, None)


EXTRA = {"WD": "wd", "NB": "nb", "LB": "lb", "B": "b"}


def ball_from_feed(b, roster, bat_team, bowl_team):
    code = (b.get("extra_type_code") or "").upper()
    head = code.split("-")[0]
    run, xrun = int(b.get("run") or 0), int(b.get("extra_run") or 0)
    m = re.match(r"^(.+?) to (.+?),", b.get("commentary") or "")
    bowler = roster.key(m.group(1), bowl_team) if m else None
    striker = roster.key(m.group(2), bat_team) if m else None
    out = {"striker_id": striker, "bowler_id": bowler, "runs_off_bat": 0, "extra_type": None,
           "extra_runs": 0, "wicket_type": None, "dismissed_id": None, "fielder_id": None,
           "reconstructed": False, "_ch": b}
    if head == "WD":
        out.update(extra_type="wd", extra_runs=1 + run + xrun)
    elif head == "NB":
        # "(no ball) bye, 4 runs" — the runs are byes, not off the bat.
        byes = "-" in code
        out.update(extra_type="nb", extra_runs=1 + xrun + (run if byes else 0), runs_off_bat=0 if byes else run)
    elif head in ("LB", "B"):
        out.update(extra_type=EXTRA[head], extra_runs=run + xrun)
    else:
        out.update(runs_off_bat=run, extra_runs=xrun)
    if b.get("is_out") and (b.get("dismiss_type_code") or "").upper() not in ("REH", "RTH", "RH", "RET"):
        out["wicket_type"] = "other"          # filled from the card below
        out["dismissed_id"] = str(b["dismiss_player_id"]) if b.get("dismiss_player_id") else striker
    return out


def legal(ball):
    return ball["extra_type"] not in ("wd", "nb")


# ── one innings ───────────────────────────────────────────────────────────────
def rebuild_innings(feed, card_bat, card_bowl, bat_team, bowl_team, roster, summary):
    feed = sorted(feed, key=lambda b: b["ball_id"])
    balls = []
    for i, b in enumerate(feed):
        # A jump of more than a few ids is a change of id scheme (old matches
        # mix two), not missing deliveries — treat it as no gap.
        if i and 1 < b["ball_id"] - feed[i - 1]["ball_id"] <= 4:
            for _ in range(b["ball_id"] - feed[i - 1]["ball_id"] - 1):
                balls.append(None)            # a missing delivery
        balls.append(ball_from_feed(b, roster, bat_team, bowl_team))

    # Who the card says was dismissed, and how.
    dismissed = []
    for row in card_bat:
        how = parse_out(row.get("how_to_out"))
        if how:
            dismissed.append({"key": roster.key(row["name"], bat_team), "how": how, "row": row})
    already = {b["dismissed_id"] for b in balls if b and b["wicket_type"]}
    todo = [d for d in dismissed if d["key"] not in already]

    # Runs the card has that the feed doesn't: the most the rebuilt balls may add.
    team_short = int(summary.get("total_run") or 0) - sum(b["runs_off_bat"] + b["extra_runs"] for b in balls if b)
    gaps = balls.count(None)
    for _ in range(max(0, len(todo) - gaps)):
        balls.append(None)                    # last wicket(s) off the end of the feed

    # What each batter is short of on the card: the balls and runs of their
    # missing deliveries. A dismissed batter short by a ball faced the wicket
    # ball; one short by none was run out at the other end.
    faced, scored = {}, {}
    for b in balls:
        if b and b["striker_id"]:
            if b["extra_type"] != "wd":
                faced[b["striker_id"]] = faced.get(b["striker_id"], 0) + 1
            scored[b["striker_id"]] = scored.get(b["striker_id"], 0) + b["runs_off_bat"]

    def last_seen(key, before):
        for j in range(before - 1, -1, -1):
            if balls[j] and balls[j]["striker_id"] == key:
                return j
        return -1

    def seen_after(key, pos):
        return any(b and b["striker_id"] == key for b in balls[pos + 1:])

    # Fill each hole with the dismissal that fits it: someone not seen again, and
    # of those the one who batted most recently before the hole.
    card_balls = {roster.key(r["name"], bat_team, create=False): int(r.get("balls") or 0) for r in card_bat}

    def short(key):
        return card_balls.get(key, 0) - faced.get(key, 0)

    holes = [i for i, b in enumerate(balls) if b is None]
    for n, pos in enumerate(holes):
        cands = [d for d in todo if not seen_after(d["key"], pos)]
        # More holes than dismissals left: a hole with nobody short of a ball
        # among the candidates is more likely a lost ordinary delivery.
        spare = (len(holes) - n) > len(todo)
        if spare and cands and not any(short(c["key"]) >= 1 for c in cands):
            cands = []
        prev = next((x for x in reversed(balls[:pos]) if x), None)
        nxt = next((x for x in balls[pos + 1:] if x), None)
        if not cands:
            # A delivery that is missing for some other reason: a legal dot, by
            # whichever recent batter the card says is a ball short.
            recent = [x["striker_id"] for x in reversed(balls[max(0, pos - 12):pos]) if x and x["striker_id"]]
            who = next((k for k in recent if short(k) >= 1), prev and prev["striker_id"])
            if who:
                faced[who] = faced.get(who, 0) + 1
            balls[pos] = {"striker_id": who, "bowler_id": prev and prev["bowler_id"],
                          "runs_off_bat": 0, "extra_type": None, "extra_runs": 0, "wicket_type": None,
                          "dismissed_id": None, "fielder_id": None, "reconstructed": True}
            continue
        d = max(cands, key=lambda c: (short(c["key"]) >= 1 or c["how"][0] == "run_out", last_seen(c["key"], pos)))
        todo.remove(d)
        kind, fielder, bowler_name = d["how"]
        short_balls = int(d["row"].get("balls") or 0) - faced.get(d["key"], 0)
        # Capped by what the team is actually short: a card name the commentary
        # spells differently would otherwise land a whole innings on one ball.
        short_runs = min(max(0, int(d["row"].get("runs") or 0) - scored.get(d["key"], 0)), 6, max(0, team_short))
        on_strike = short_balls >= 1 or kind != "run_out"
        striker = d["key"] if on_strike else (prev and prev["striker_id"])
        bowler = roster.key(bowler_name, bowl_team, create=False) if bowler_name else None
        on_strike = on_strike and kind != "retired_out" or short_balls >= 1
        if not bowler:
            same = prev and nxt and prev["bowler_id"] == nxt["bowler_id"]
            bowler = (prev or nxt or {}).get("bowler_id") if same or not nxt else prev and prev["bowler_id"]
        fk = None
        if fielder == "__bowler__":
            fk = bowler
        elif fielder:
            fk = roster.key(fielder, bowl_team)
        balls[pos] = {"striker_id": striker, "bowler_id": bowler,
                      "runs_off_bat": short_runs if on_strike else 0, "extra_type": None, "extra_runs": 0,
                      "wicket_type": kind if kind != "other" else "bowled",
                      "dismissed_id": d["key"], "fielder_id": fk, "reconstructed": True}
        team_short -= balls[pos]["runs_off_bat"]
        if on_strike:
            faced[d["key"]] = faced.get(d["key"], 0) + 1
            scored[d["key"]] = scored.get(d["key"], 0) + short_runs

    # Real wicket balls in the feed (rare — CricHeroes keeps some) get their
    # type and fielder from the card too.
    for b in balls:
        if b["wicket_type"] == "other":
            d = next((x for x in dismissed if x["key"] == b["dismissed_id"]), None)
            if d:
                kind, fielder, _ = d["how"]
                b["wicket_type"] = kind if kind != "other" else "bowled"
                b["fielder_id"] = b["bowler_id"] if fielder == "__bowler__" else (roster.key(fielder, bowl_team) if fielder else None)
            else:
                b["wicket_type"] = "bowled"

    # Any team runs still unaccounted for (byes on a wicket ball and the like)
    # go on the last wicket ball as extras, so the total matches the card.
    total = sum(b["runs_off_bat"] + b["extra_runs"] for b in balls)
    left = int(summary.get("total_run") or 0) - total
    if 0 < left <= 6:
        wb = next((b for b in reversed(balls) if b["reconstructed"] and b["wicket_type"]), None) or balls[-1]
        wb["extra_runs"] += left

    # The card's overs are the truth for how many legal balls there were. A hole
    # we filled with a dot that the card has no room for was not a delivery.
    op = str(summary.get("overs_played") or "")
    mo = re.match(r"^(\d+)(?:\.(\d))?$", op)
    if mo:
        card_legal = int(mo.group(1)) * 6 + int(mo.group(2) or 0)
        excess = sum(1 for b in balls if legal(b)) - card_legal
        for j in range(len(balls) - 1, -1, -1):
            if excess <= 0:
                break
            b = balls[j]
            if b.get("reconstructed") and not b["wicket_type"] and legal(b) and b["runs_off_bat"] + b["extra_runs"] == 0:
                balls.pop(j)
                excess -= 1

    # Number the deliveries: over and ball from the legal count.
    legal_n = 0
    out = []
    for seq, b in enumerate(balls):
        b.pop("_ch", None)
        b.update(seq=seq, over_no=legal_n // 6, ball_no=legal_n % 6, non_striker_id=None)
        if legal(b):
            legal_n += 1
        out.append(b)
    return out


def check(balls, card_bat, summary, roster, bat_team):
    runs = sum(b["runs_off_bat"] + b["extra_runs"] for b in balls)
    wkts = sum(1 for b in balls if b["wicket_type"])
    ok_team = runs == int(summary.get("total_run") or 0) and wkts == int(summary.get("total_wicket") or 0)
    bad = []
    for row in card_bat:
        k = roster.key(row["name"], bat_team, create=False)
        r = sum(b["runs_off_bat"] for b in balls if b["striker_id"] == k)
        f = sum(1 for b in balls if b["striker_id"] == k and b["extra_type"] != "wd")
        if (r, f) != (int(row.get("runs") or 0), int(row.get("balls") or 0)):
            bad.append(f"{clean(row['name'])} {r}({f}) v {row.get('runs')}({row.get('balls')})")
    if ok_team and not bad:
        q = "exact"
    elif abs(runs - int(summary.get("total_run") or 0)) <= 3 and wkts == int(summary.get("total_wicket") or 0):
        q = "close"
    else:
        q = "partial"
    return q, runs, wkts, bad


def rebuild_match(cid, card, feed_all):
    roster = Roster()
    t1, t2 = card.get("innings1_team_id"), card.get("innings2_team_id")
    for inn, bat_t, bowl_t in ((1, t1, t2), (2, t2, t1)):
        for r in card.get(f"innings{inn}_batting") or []:
            roster.add(r.get("player_id"), r.get("name"), bat_t)
        for r in card.get(f"innings{inn}_bowling") or []:
            roster.add(r.get("player_id"), r.get("name"), bowl_t)

    rank = {"exact": 0, "close": 1, "partial": 2}
    quality, notes, rows, inns = "exact", [], [], []
    target = None
    for inn, bat_t, bowl_t in ((1, t1, t2), (2, t2, t1)):
        feed = [b for b in feed_all if b.get("inning") == inn]
        summary = card.get(f"innings{inn}_summary") or {}
        if not feed or not summary:
            continue
        balls = rebuild_innings(feed, card.get(f"innings{inn}_batting") or [],
                                card.get(f"innings{inn}_bowling") or [], bat_t, bowl_t, roster, summary)
        q, runs, wkts, bad = check(balls, card.get(f"innings{inn}_batting") or [], summary, roster, bat_t)
        if rank[q] > rank[quality]:
            quality = q
        if bad or q != "exact":
            notes.append(f"inn{inn} {q}: {runs}/{wkts} v {summary.get('total_run')}/{summary.get('total_wicket')}"
                         + (f"; {', '.join(bad[:4])}" if bad else ""))
        for b in balls:
            rows.append({"ch_match_id": cid, "innings": inn, **b})
        inns.append({"innings": inn, "team_id": bat_t, "team_name": card.get(f"innings{inn}_team_name"),
                     "target": target, "runs": int(summary.get("total_run") or 0),
                     "wickets": int(summary.get("total_wicket") or 0),
                     "legal_balls": sum(1 for b in balls if legal(b))})
        target = int(summary.get("total_run") or 0) + 1
    # The fixture row says 16 overs for nearly every match; many were 15. The
    # longest innings bowled is the real length unless both ended early (all out,
    # or a quick chase), in which case the fixture's figure stands.
    def card_overs(inn):
        op = str((card.get(f"innings{inn}_summary") or {}).get("overs_played") or "0")
        whole, _, part = op.partition(".")
        return int(whole or 0) + (1 if part and part != "0" else 0)
    longest = max((card_overs(i["innings"]) for i in inns), default=0)
    for i in inns:
        i["match_overs"] = longest if longest >= 10 else None
    return {"quality": quality, "notes": "; ".join(notes) or None, "balls": rows,
            "innings": inns, "players": roster.players}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--match")
    ap.add_argument("--all", action="store_true", help="rebuild matches already stored")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cache", help="read/write CricHeroes commentary JSON here")
    ap.add_argument("--dump", help="write every rebuilt match to this JSON file (for calibration)")
    a = ap.parse_args()

    cards = sb("GET", "match_scorecards?select=*,match:matches(id,date,scoring_source)"
               + (f"&ch_match_id=eq.{a.match}" if a.match else "") + "&limit=1000")
    cards = [c for c in cards if c.get("ch_match_id") and c.get("match")
             and c["match"].get("scoring_source") != "app"]
    cards.sort(key=lambda c: c["match"]["date"], reverse=True)

    done = set()
    if not a.all and not a.match and not a.dry_run:
        try:
            done = {r["ch_match_id"] for r in sb("GET", "ch_ball_matches?select=ch_match_id&limit=5000")}
        except RuntimeError as e:
            if "ch_ball_matches" in str(e) or "42P01" in str(e) or "PGRST205" in str(e):
                print("❌ Run supabase/migrations/add_cricheroes_balls.sql first.")
                sys.exit(1)
            raise
    todo = [c for c in cards if c["ch_match_id"] not in done]
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(todo)} match(es) to rebuild ({len(done)} already stored)")

    tally = {"exact": 0, "close": 0, "partial": 0, "empty": 0}
    dump = []
    for c in todo:
        cid = c["ch_match_id"]
        cache = a.cache and os.path.join(a.cache, f"{cid}.json")
        try:
            if cache and os.path.exists(cache):
                d = json.load(open(cache))
            else:
                d = ch_get(COMMENTARY.format(cid))
                time.sleep(0.4)
                if cache:
                    json.dump(d, open(cache, "w"))
        except Exception as e:
            print(f"  {cid}: commentary fetch failed — {e}")
            continue
        feed = (d or {}).get("commentary") or []
        if not feed:
            tally["empty"] += 1
            continue
        m = rebuild_match(cid, c, feed)
        tally[m["quality"]] += 1
        print(f"  {c['match']['date']} {cid}: {m['quality']:7} {len(m['balls'])} balls"
              + (f"  — {m['notes']}" if m["notes"] and m["quality"] != "exact" else ""))
        if a.dump:
            dump.append({"ch_match_id": cid, "date": c["match"]["date"], **m})
        if a.dry_run:
            continue
        sb("POST", "ch_ball_matches?on_conflict=ch_match_id", {
            "ch_match_id": cid, "match_id": c["match"]["id"], "players": m["players"],
            "innings": m["innings"], "quality": m["quality"], "notes": m["notes"],
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, prefer="resolution=merge-duplicates")
        sb("DELETE", f"ch_balls?ch_match_id=eq.{cid}")
        for i in range(0, len(m["balls"]), 200):
            sb("POST", "ch_balls", m["balls"][i:i + 200])

    if a.dump:
        json.dump(dump, open(a.dump, "w"))
    print("done:", tally)


if __name__ == "__main__":
    main()
