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
import json, urllib.request, urllib.error, urllib.parse, datetime, sys, time, argparse, re

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

WEB_HEADERS = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}

# Cached Next.js buildId — refreshed at startup
_BUILD_ID = None

def get_build_id():
    """Scrape the Next.js buildId from cricheroes.com home page."""
    global _BUILD_ID
    if _BUILD_ID:
        return _BUILD_ID
    req = urllib.request.Request('https://cricheroes.com/', headers=WEB_HEADERS)
    html = urllib.request.urlopen(req, timeout=15).read().decode()
    m = re.search(r'"buildId":"([^"]+)"', html)
    if not m:
        raise RuntimeError('Could not find Next.js buildId on cricheroes.com home page')
    _BUILD_ID = m.group(1)
    return _BUILD_ID

def fetch_scorecard(ch_match_id, max_retries=3):
    """Returns the parsed pageProps.scorecard list, or None if not found / no data.

    Retries transient network errors (e.g. ConnectionResetError [Errno 54])
    with exponential backoff so a single flaky connection doesn't crash the
    entire batch sync.
    """
    build_id = get_build_id()
    url = f'https://cricheroes.com/_next/data/{build_id}/scorecard/{ch_match_id}/x/x/scorecard.json'

    last_err = None
    for attempt in range(max_retries):
        req = urllib.request.Request(url, headers=WEB_HEADERS)
        try:
            data = json.loads(urllib.request.urlopen(req, timeout=20).read())
            pp = data.get('pageProps', {})
            sc = pp.get('scorecard', [])
            return sc if sc else None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # match doesn't exist on CH — don't retry
            last_err = e
        except (ConnectionResetError, urllib.error.URLError, TimeoutError, OSError) as e:
            # Transient network issue → back off and retry
            last_err = e
            time.sleep(1.5 * (attempt + 1))  # 1.5s, 3s, 4.5s
            continue

    # Exhausted all retries — log but don't crash the whole batch
    print(f"    ⚠️  ch={ch_match_id} failed after {max_retries} retries: {type(last_err).__name__}")
    return 'ERROR'  # sentinel so main loop knows to count it as error, not "no-data"

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
        'raw': scorecard,
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
    print(f"[{now}] Detailed scorecard sync (CricHeroes → Supabase)\n")

    # Verify build_id is reachable up-front
    try:
        bid = get_build_id()
        print(f"✓ Found Next.js buildId: {bid}\n")
    except Exception as e:
        print(f"❌ Could not get CricHeroes buildId: {e}")
        sys.exit(1)

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
