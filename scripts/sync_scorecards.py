#!/usr/bin/env python3
# Auto-mirrored to ~/.scc-sync after each commit (see scripts/hooks/post-commit)
"""
Detailed scorecard sync — fetches per-batter and per-bowler stats from
CricHeroes' Next.js SSR endpoint and stores in Supabase match_scorecards.

Run: python3 scripts/sync_scorecards.py [--past-days 30] [--match-id 123]

Notes:
  - Source is the public Next.js SSR endpoint that powers cricheroes.in's
    own /scorecard/{id}/x/x/scorecard pages. No auth required, no API key.
  - Re-fetches match scorecards if they are missing OR older than 24 hours
    (so MOM/score corrections trickle in automatically).
  - Skips matches without ch_match_id (manual entries).
"""
import json, re, urllib.request, urllib.error, urllib.parse, datetime, sys, time, argparse, gzip

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://nptvrfqonfmafvbzjrih.supabase.co"
SUPABASE_KEY = "sb_publishable_NC3gqU5FnEFEhSO9KWPKNg_WpLnfo9G"

# ── CricHeroes API (site scraping died when CricHeroes moved to App Router; the
#    authenticated API is the reliable source). Update CH_AUTH if it expires.
CH_API_KEY = "cr!CkH3r0s"
CH_AUTH    = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"
CH_UDID    = "3833274f1b23ae81b995ebfdfb7f948b"

def ch_api_headers():
    return {
        'api-key': CH_API_KEY, 'authorization': CH_AUTH, 'udid': CH_UDID,
        'device-type': 'Chrome: 146.0.0.0', 'accept': 'application/json',
        'origin': 'https://cricheroes.com', 'referer': 'https://cricheroes.com/',
        'user-agent': 'Mozilla/5.0', 'accept-encoding': 'gzip',
    }

def fetch_scorecard(ch_match_id, max_retries=3):
    """Fetch the full scorecard from the CricHeroes API and return a list of
    innings dicts in the legacy shape ({team_id, teamName, inning{...}, batting,
    bowling, extras}), or None if not found, or 'ERROR' on repeated failure.

    Source: /api/v1/scorecard/v2/get-scorecard/{matchId}
    """
    url = f'https://api.cricheroes.in/api/v1/scorecard/v2/get-scorecard/{ch_match_id}'
    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=ch_api_headers())
            r = urllib.request.urlopen(req, timeout=20)
            raw = r.read()
            if r.headers.get('content-encoding') == 'gzip':
                raw = gzip.decompress(raw)
            data = (json.loads(raw) or {}).get('data') or {}

            innings = []
            for side in ('team_a', 'team_b'):
                team = data.get(side) or {}
                meta_by_num = {i.get('inning'): i for i in (team.get('innings') or [])}
                for sc in (team.get('scorecard') or []):
                    num = sc.get('inning')
                    # CricHeroes returns super-over innings as strings ('3'/'4');
                    # coerce to int so meta-lookup and sorting are consistent.
                    try: num = int(num) if num is not None else None
                    except (TypeError, ValueError): pass
                    meta = meta_by_num.get(num, meta_by_num.get(str(num), {}))
                    innings.append({
                        'team_id':  team.get('id'),
                        'teamName': team.get('name', ''),
                        'inning': {
                            'summary':      meta.get('summary') or {},
                            'total_run':    meta.get('total_run'),
                            'total_wicket': meta.get('total_wicket'),
                            'total_extra':  meta.get('total_extra'),
                            'overs_played': meta.get('overs_played'),
                            'is_allout':    meta.get('is_allout'),
                            'inning_num':   num,
                        },
                        'batting': sc.get('batting', []),
                        'bowling': sc.get('bowling', []),
                        'extras':  sc.get('extras', {}),
                    })
            def _key(x):
                v = x['inning'].get('inning_num')
                try: return int(v) if v is not None else 0
                except (TypeError, ValueError): return 0
            innings.sort(key=_key)
            return innings if innings else None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # match doesn't exist on CH — don't retry
            last_err = e
        except (ConnectionResetError, urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))  # 1.5s, 3s, 4.5s
            continue

    print(f"    ⚠️  ch={ch_match_id} failed after {max_retries} retries: {type(last_err).__name__}")
    return 'ERROR'

def sb(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{('?' + params) if params else ''}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body else None,
        headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        }, method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = r.read()
            return r.status, json.loads(resp) if resp else None
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def get_matches_to_sync(past_days, single_id=None):
    """Returns list of {id, ch_match_id, date} for completed matches with ch_match_id."""
    if single_id:
        # Look it up by ID
        params = f"id=eq.{single_id}&select=id,ch_match_id,date&ch_match_id=not.is.null"
    else:
        cutoff = (datetime.date.today() - datetime.timedelta(days=past_days)).isoformat()
        params = (
            f"select=id,ch_match_id,date&"
            f"ch_match_id=not.is.null&"
            # A match scored ball by ball in the app publishes its own card,
            # with every dismissal and the fielder who took it. CricHeroes'
            # version of the same match is a summary entry at best, so pulling
            # it would replace a full scorecard with a thinner one.
            f"or=(scoring_source.is.null,scoring_source.neq.app)&"
            f"date=gte.{cutoff}&"
            f"result=in.(won,lost,draw)&"
            f"order=date.desc"
        )
    code, data = sb("GET", "matches", params=params)
    if code != 200:
        print(f"❌ Failed to fetch matches list ({code})")
        return []
    return data or []

def get_existing_scorecard_freshness():
    """Returns { match_id: fetched_at_iso } for already-synced scorecards."""
    code, data = sb("GET", "match_scorecards", params="select=match_id,fetched_at")
    if code != 200:
        return {}
    return {row['match_id']: row['fetched_at'] for row in (data or [])}

def is_stale(fetched_iso, hours=24):
    if not fetched_iso:
        return True
    try:
        fetched = datetime.datetime.fromisoformat(fetched_iso.replace('Z', '+00:00'))
        delta = datetime.datetime.now(datetime.timezone.utc) - fetched
        return delta.total_seconds() > hours * 3600
    except Exception:
        return True

def normalize_innings(inn):
    """Pull what we need out of one innings dict from CH."""
    inning_obj = inn.get('inning', {})
    return {
        'team_id': inn.get('team_id'),
        'team_name': inn.get('teamName', ''),
        'summary': inning_obj.get('summary') or {},
        'inning_meta': {
            'total_run': inning_obj.get('total_run'),
            'total_wicket': inning_obj.get('total_wicket'),
            'total_extra': inning_obj.get('total_extra'),
            'overs_played': inning_obj.get('overs_played'),
            'is_allout': inning_obj.get('is_allout'),
        },
        'batting': inn.get('batting', []),
        'bowling': inn.get('bowling', []),
        'extras': inn.get('extras', {}),
    }

SCC_TEAM_ID = 7927431
MEMBERS_CACHE = []


def _norm(x):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", (x or "").lower().strip()))


def resolve_member(ch_name, members):
    """CricHeroes name -> SCC member id, or None.

    Deliberately strict, and the same rules the app uses (src/lib/nameMatch.ts):
    an exact name, or "First X" where X initials exactly one member's surname,
    or a first name only one member has. Anything ambiguous returns None —
    putting the wrong Aditya down as captain is worse than leaving it blank.
    """
    n = _norm(ch_name)
    if not n:
        return None
    for m in members:
        if _norm(m["name"]) == n:
            return m["id"]
    parts = n.split(" ")
    by_first = [m for m in members if _norm(m["name"]).split(" ")[0] == parts[0]]
    if len(parts) == 2 and len(parts[1]) == 1:
        hits = [m for m in by_first if _norm(m["name"]).split(" ")[-1].startswith(parts[1])]
        if len(hits) == 1:
            return hits[0]["id"]
    if len(parts) >= 2:
        hits = [m for m in members
                if _norm(m["name"]).split(" ")[0] == parts[0]
                and (_norm(m["name"]).split(" ")[-1].startswith(parts[-1])
                     or parts[-1].startswith(_norm(m["name"]).split(" ")[-1]))]
        if len(hits) == 1:
            return hits[0]["id"]
    return by_first[0]["id"] if len(by_first) == 1 else None


def captain_from_card(payload, members):
    """CricHeroes marks the captain in the batting card: "Avinash Singh  (c)".

    That marker has been in every scorecard this script has ever synced and was
    thrown away each time, so the app knew a captain for 24 matches out of 191
    while the answer for 110 more sat in the JSON it had already stored.
    """
    rows = None
    if payload.get("innings1_team_id") == SCC_TEAM_ID:
        rows = payload.get("innings1_batting")
    elif payload.get("innings2_team_id") == SCC_TEAM_ID:
        rows = payload.get("innings2_batting")
    if not rows:
        return None
    for r in rows:
        name = (r or {}).get("name") or ""
        if re.search(r"\(\s*c\s*\)|\(\s*c\s*&\s*wk\s*\)|\(\s*wk\s*&\s*c\s*\)", name, re.I):
            clean = re.sub(r"\s*\((?:c|wk|c\s*&\s*wk|wk\s*&\s*c)\)", "", name, flags=re.I).strip()
            return resolve_member(clean, members)
    return None


def set_captain_if_missing(match_id, payload, members):
    """Fill the fixture's captain, never overwrite one somebody chose."""
    cid = captain_from_card(payload, members)
    if not cid:
        return False
    code, rows = sb("GET", "matches", params=f"id=eq.{match_id}&select=captain_id,match_type")
    if code != 200 or not rows:
        return False
    row = rows[0]
    # Internal matches have two SCC captains; the single column can't hold that.
    if row.get("captain_id") or row.get("match_type") == "internal":
        return False
    code2, _ = sb("PATCH", "matches", body={"captain_id": cid}, params=f"id=eq.{match_id}")
    return code2 in (200, 204)


def upsert_scorecard(match_id, ch_match_id, scorecard):
    """Save a fetched scorecard. Returns 'inserted'/'updated'/'error'."""
    if not scorecard or len(scorecard) < 1:
        return 'no-data'

    inn1 = normalize_innings(scorecard[0])
    inn2 = normalize_innings(scorecard[1]) if len(scorecard) > 1 else None

    payload = {
        'match_id': match_id,
        'ch_match_id': str(ch_match_id),
        'innings1_team_id': inn1['team_id'],
        'innings1_team_name': inn1['team_name'],
        'innings1_summary': {**inn1['summary'], **inn1['inning_meta']},
        'innings1_batting': inn1['batting'],
        'innings1_bowling': inn1['bowling'],
        'innings1_extras': inn1['extras'],
        'fetched_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        # No 'raw'. It stored the whole unparsed CricHeroes response — 14 KB a
        # row, more than half the table — and nothing ever read it: not the app,
        # not the edge functions, not any other script. It was costing every
        # member half a megabyte on each cold app open, which is what pushed the
        # Supabase org past its egress quota. The parsed columns above are the
        # ones everything downstream actually uses; if the CricHeroes format
        # ever changes, re-fetching is a better answer than hoarding.
    }
    if inn2:
        payload.update({
            'innings2_team_id': inn2['team_id'],
            'innings2_team_name': inn2['team_name'],
            'innings2_summary': {**inn2['summary'], **inn2['inning_meta']},
            'innings2_batting': inn2['batting'],
            'innings2_bowling': inn2['bowling'],
            'innings2_extras': inn2['extras'],
        })

    # The captain is in the card CricHeroes just gave us — take it while it's here.
    try:
        if MEMBERS_CACHE and set_captain_if_missing(match_id, payload, MEMBERS_CACHE):
            print("    👑 captain filled from the scorecard")
    except Exception as e:
        print(f"    captain lookup skipped ({type(e).__name__})")

    # Check if exists
    code, existing = sb("GET", "match_scorecards", params=f"match_id=eq.{match_id}&select=id&limit=1")
    if existing and len(existing) > 0:
        eid = existing[0]['id']
        code2, _ = sb("PATCH", "match_scorecards", body=payload, params=f"id=eq.{eid}")
        return 'updated' if code2 in (200, 204) else 'error'
    else:
        code2, _ = sb("POST", "match_scorecards", payload)
        return 'inserted' if code2 == 201 else 'error'

def main():
    parser = argparse.ArgumentParser(description='Sync detailed scorecards (CricHeroes → Supabase)')
    parser.add_argument('--past-days', type=int, default=30,
                        help='Sync match scorecards from the last N days (default 30)')
    parser.add_argument('--match-id', type=str, default=None,
                        help='Sync just one specific Supabase match ID')
    parser.add_argument('--force', action='store_true',
                        help='Re-fetch even if already synced and not stale')
    parser.add_argument('--stale-hours', type=int, default=24,
                        help='Refetch scorecards older than this many hours (default 24)')
    args = parser.parse_args()

    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f"[{now}] Detailed scorecard sync (CricHeroes API → Supabase)\n")

    global MEMBERS_CACHE
    code, mem = sb("GET", "members", params="select=id,name")
    MEMBERS_CACHE = mem if code == 200 and mem else []

    matches = get_matches_to_sync(args.past_days, args.match_id)
    print(f"Eligible matches: {len(matches)}\n")

    if not matches:
        print("Nothing to sync.")
        return

    freshness = get_existing_scorecard_freshness()

    counts = {'inserted': 0, 'updated': 0, 'skipped-fresh': 0, 'no-data': 0, 'error': 0}
    for m in matches:
        mid = m['id']
        cid = m['ch_match_id']
        date = m['date']

        if not args.force and mid in freshness and not is_stale(freshness[mid], args.stale_hours):
            counts['skipped-fresh'] += 1
            continue

        try:
            sc = fetch_scorecard(cid)
        except Exception as e:
            print(f"  ⚠️  {date}  ch={cid}  fetch failed: {e}")
            counts['error'] += 1
            continue

        if sc == 'ERROR':
            counts['error'] += 1
            continue
        if not sc:
            print(f"  · {date}  ch={cid}  no scorecard yet on CH")
            counts['no-data'] += 1
            continue

        action = upsert_scorecard(mid, cid, sc)
        counts[action] = counts.get(action, 0) + 1
        tag = '🆕' if action == 'inserted' else ('✏️' if action == 'updated' else '·')
        bat_count = sum(len(inn.get('batting', [])) for inn in sc)
        bowl_count = sum(len(inn.get('bowling', [])) for inn in sc)
        print(f"  {tag} {date}  ch={cid}  innings={len(sc)} batters={bat_count} bowlers={bowl_count}")

        # Politeness — don't hammer CricHeroes
        time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"  Inserted: {counts.get('inserted', 0)}  "
          f"Updated: {counts.get('updated', 0)}  "
          f"Skipped (fresh): {counts.get('skipped-fresh', 0)}  "
          f"No data: {counts.get('no-data', 0)}  "
          f"Errors: {counts.get('error', 0)}")
    print(f"  ✅ Scorecard sync done.")

if __name__ == '__main__':
    main()
