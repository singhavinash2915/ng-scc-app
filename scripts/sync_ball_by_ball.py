#!/usr/bin/env python3
"""
Ball-by-ball dot-ball sync (CricHeroes commentary → Supabase player_ball_stats).

CricHeroes scorecards give runs/balls/4s/6s per batsman but NOT dot balls, so we
derive them from the ball-by-ball commentary. Each ball's batsman is only in the
commentary TEXT ("<bowler> to <batsman>, <outcome>"), so we parse the name and
fuzzy-match it to an SCC member. We only look at balls where team_id == our team,
so every parsed batsman is an SCC player (no false matches from opponents).

Per (member, season) we store:
  balls_faced  — legal deliveries faced (wides excluded)
  dot_balls    — of those, deliveries with 0 runs off the bat

Prereq: run supabase/migrations/add_player_ball_stats.sql once (creates the table).
Run:    python3 scripts/sync_ball_by_ball.py [--limit N] [--match-id CH_ID]
"""
import json, urllib.request, urllib.error, datetime, sys, time, re, gzip, argparse
from collections import defaultdict
from difflib import SequenceMatcher

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

CH_API_KEY = "cr!CkH3r0s"
CH_AUTH    = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"
CH_UDID    = "3833274f1b23ae81b995ebfdfb7f948b"
TEAM_ID    = 7927431

def ch_headers():
    return {
        'api-key': CH_API_KEY, 'authorization': CH_AUTH, 'udid': CH_UDID,
        'device-type': 'Chrome: 146.0.0.0', 'accept': 'application/json',
        'origin': 'https://cricheroes.com', 'referer': 'https://cricheroes.com/',
        'user-agent': 'Mozilla/5.0', 'accept-encoding': 'gzip',
    }

def sb_call(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{('?' + params) if params else ''}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body else None,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        method=method)
    try:
        with urllib.request.urlopen(req) as r:
            resp = r.read()
            return r.status, json.loads(resp) if resp else None
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def ch_get(url, retries=3):
    for i in range(retries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=ch_headers()), timeout=25)
            raw = r.read()
            if r.headers.get('content-encoding') == 'gzip':
                raw = gzip.decompress(raw)
            return json.loads(raw).get('data', {})
        except Exception as e:
            if i == retries - 1:
                print(f"    ⚠️  fetch failed: {e}")
                return None
            time.sleep(1.5)

# ── Fuzzy name matching (commentary name → SCC member) ────────────────────────
def norm(s):
    s = re.sub(r'\([^)]*\)', ' ', (s or '').lower())   # drop "(wk)" / "(c)"
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def build_matcher(members):
    toks = {m['id']: set(norm(m['name']).split()) for m in members}
    names = {m['id']: norm(m['name']) for m in members}
    def match(raw):
        n = norm(raw)
        if not n:
            return None
        t = set(n.split())
        # 1. exact normalised
        for mid, nm in names.items():
            if nm == n:
                return mid
        # 2. member name fully inside the commentary name — "Shaan" in "Shaan Shaikh",
        #    "Rohan Rao" in "Rohan Kumar Rao". Most-specific (most tokens) wins.
        contained = [mid for mid, mt in toks.items() if mt and mt <= t]
        if contained:
            return max(contained, key=lambda mid: len(toks[mid]))
        # 3. commentary name is a subset of a member — "Raushan" → "Raushan Kumar".
        #    Unambiguous only if exactly one member contains all commentary tokens.
        supersets = [mid for mid, mt in toks.items() if t <= mt]
        if len(supersets) == 1:
            return supersets[0]
        if len(supersets) > 1:  # shared token (e.g. two Adityas) — pick closest
            return max(supersets, key=lambda mid: SequenceMatcher(None, n, names[mid]).ratio())
        # 4. fuzzy fallback
        best, best_score = None, 0.0
        for mid, nm in names.items():
            score = SequenceMatcher(None, n, nm).ratio()
            if score > best_score:
                best, best_score = mid, score
        return best if best_score >= 0.82 else None
    return match

def season_of(date_str):
    """Cricket season Sep→Aug. '2026-06-23' → '2025-26'."""
    y, m = int(date_str[:4]), int(date_str[5:7])
    start = y if m >= 9 else y - 1
    return f"{start}-{str(start + 1)[2:]}"

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0, help='Only process N most recent matches (0 = all)')
    ap.add_argument('--match-id', help='Only this CricHeroes match id')
    args = ap.parse_args()

    print(f"\n🏏 Ball-by-ball dot sync — {datetime.datetime.now():%Y-%m-%d %H:%M}\n")

    # Members for name matching
    code, members = sb_call("GET", "members", params="select=id,name")
    if code != 200:
        print("❌ Could not load members:", members); sys.exit(1)
    match_member = build_matcher(members)
    print(f"Loaded {len(members)} members for name matching")

    # SCC matches that have a CricHeroes id and were actually played
    code, matches = sb_call("GET", "matches",
        params="select=ch_match_id,date,opponent&ch_match_id=not.is.null&result=in.(won,lost,draw)&order=date.desc")
    if code != 200:
        print("❌ Could not load matches:", matches); sys.exit(1)
    if args.match_id:
        matches = [m for m in matches if str(m['ch_match_id']) == str(args.match_id)]
    if args.limit:
        matches = matches[:args.limit]
    print(f"Processing {len(matches)} matches\n")

    # (member_id, season) → {faced, dots}
    tally = defaultdict(lambda: {'faced': 0, 'dots': 0})
    unmatched = defaultdict(int)
    processed = skipped = 0

    for i, m in enumerate(matches, 1):
        cid, date = m['ch_match_id'], m['date']
        season = season_of(date)
        d = ch_get(f"https://api.cricheroes.in/api/v1/scorecard/get-commentary/{cid}")
        if not d:
            skipped += 1
            continue
        balls = [b for g in d.get('commentary_with_over_summary', []) for b in (g.get('match_over_balls') or [])]
        our = [b for b in balls if b.get('team_id') == TEAM_ID]
        if not our:
            skipped += 1
            continue
        mfaced = mdots = 0
        for b in our:
            cm = re.search(r' to (.+?),', b.get('commentary', '') or '')
            if not cm:
                continue
            if str(b.get('extra_type_code', '')).lower() == 'wd':
                continue  # wide isn't a ball faced
            mid = match_member(cm.group(1))
            if not mid:
                unmatched[cm.group(1).strip()] += 1
                continue
            tally[(mid, season)]['faced'] += 1
            mfaced += 1
            if int(b.get('run', 0)) == 0:
                tally[(mid, season)]['dots'] += 1
                mdots += 1
        processed += 1
        print(f"  [{i}/{len(matches)}] {date} vs {m.get('opponent','?')[:22]:22} balls={mfaced:3} dots={mdots:3}")
        time.sleep(0.4)

    # Write: clear + bulk insert (full recompute)
    rows = [{'member_id': mid, 'season': s, 'balls_faced': v['faced'], 'dot_balls': v['dots'],
             'updated_at': datetime.datetime.utcnow().isoformat()}
            for (mid, s), v in tally.items() if v['faced'] > 0]

    print(f"\nWriting {len(rows)} (member,season) rows…")
    sb_call("DELETE", "player_ball_stats", params="season=neq.__none__")
    for chunk_start in range(0, len(rows), 200):
        code, err = sb_call("POST", "player_ball_stats", body=rows[chunk_start:chunk_start + 200])
        if code >= 300:
            print("  ❌ insert error:", code, err); sys.exit(1)

    print(f"\n✅ Done. Matches: {processed} processed, {skipped} skipped.")
    if unmatched:
        top = sorted(unmatched.items(), key=lambda x: -x[1])[:8]
        print("  ⚠️  Unmatched batsman names (check fuzzy matcher):", top)

if __name__ == '__main__':
    main()
