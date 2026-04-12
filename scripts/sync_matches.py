#!/usr/bin/env python3
"""
CricHeroes → Supabase match sync for SCC.
Run: python3 scripts/sync_matches.py

Fetches all SCC matches from CricHeroes and syncs them to Supabase matches table:
  - Upcoming matches: created/updated so they appear in Matches + Calendar tabs
  - Past matches: synced if not already present (no overwrite of manually-edited rows)
  - Uses ch_match_id for deduplication (run `supabase/migrations/add_ch_match_id.sql` first)

Auth token rotates — grab a fresh 'authorization' header from DevTools if needed.
"""
import json, urllib.request, urllib.error, urllib.parse, datetime, sys, time

# ── CricHeroes API config ─────────────────────────────────────────────────────
CH_API_KEY   = "cr!CkH3r0s"
CH_AUTH      = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"   # ← update if auth expires
CH_UDID      = "3833274f1b23ae81b995ebfdfb7f948b"
CH_UA        = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
TEAM_ID      = 7927431
DATETIME_MS  = int(time.time() * 1000)

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

# ── Settings ──────────────────────────────────────────────────────────────────
# Only sync upcoming matches (from today onwards) — never touch past manually-entered matches
SYNC_PAST_DAYS = 0
SYNC_FUTURE_DAYS = 60

def ch_headers():
    return {
        "api-key": CH_API_KEY, "authorization": CH_AUTH, "udid": CH_UDID,
        "device-type": "Chrome: 146.0.0.0", "accept": "application/json",
        "origin": "https://cricheroes.com", "referer": "https://cricheroes.com/",
        "user-agent": CH_UA,
    }

def sb_call(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{('?' + params) if params else ''}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body else None,
        headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        }, method=method
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = r.read()
            return r.status, json.loads(resp) if resp else None
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, body

def innings_score(all_innings, team_id):
    for inn in (all_innings or []):
        if str(inn.get('team_id')) == str(team_id):
            s = inn.get('summary', {})
            return f"{s.get('score','?')} {s.get('over','')}".strip()
    return None

def parse_ch_match(m):
    """Convert CricHeroes match → Supabase matches row."""
    scc_is_team_a = str(m.get('team_a_id')) == str(TEAM_ID)
    their_team    = m.get('team_b') if scc_is_team_a else m.get('team_a')
    their_id      = m.get('team_b_id') if scc_is_team_a else m.get('team_a_id')

    all_innings   = (m.get('team_a_innings') or []) + (m.get('team_b_innings') or [])
    our_score     = innings_score(all_innings, TEAM_ID)
    their_score   = innings_score(all_innings, their_id)

    winning_team_id = m.get('winning_team_id')
    match_result    = m.get('match_result', '')

    if not match_result or not match_result.strip():
        result = 'upcoming'
    elif str(winning_team_id) == str(TEAM_ID):
        result = 'won'
    elif winning_team_id:
        result = 'lost'
    else:
        result = 'draw'

    ts       = m.get('match_start_time', '')
    date_str = str(ts)[:10] if ts else None
    win_by   = m.get('win_by', '') or ''
    venue    = m.get('ground_name', '') or ''
    notes    = f"Tournament: {m['tournament_name']}" if m.get('tournament_name') else None

    return {
        'ch_match_id':    str(m['match_id']),
        'date':           date_str,
        'opponent':       their_team or 'Unknown',
        'venue':          venue,
        'result':         result,
        'our_score':      our_score,
        'opponent_score': their_score,
        'notes':          (notes + f" | Win by: {win_by}" if win_by and notes else
                           (f"Win by: {win_by}" if win_by else notes)),
        'match_type':     'external',
        'match_fee':      0,
        'ground_cost':    0,
        'other_expenses': 0,
        'deduct_from_balance': False,
        'polling_enabled': False,
        'winning_team':   None,
    }

def fetch_all_ch_matches():
    all_matches, pageno = [], 1
    cutoff_past   = datetime.date.today().isoformat()  # today — no past matches touched
    cutoff_future = (datetime.date.today() + datetime.timedelta(days=SYNC_FUTURE_DAYS)).isoformat()

    while True:
        url = (f"https://api.cricheroes.in/api/v1/team/get-team-match/{TEAM_ID}"
               f"?pagesize=12&teamId={TEAM_ID}&pageno={pageno}&datetime={DATETIME_MS}")
        req = urllib.request.Request(url, headers=ch_headers())
        try:
            with urllib.request.urlopen(req) as r:
                resp = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}: {e.read()[:100]}")
            break

        if not resp.get('status'):
            break

        matches_raw = resp.get('data', [])
        if not matches_raw:
            break

        stop = False
        for m in matches_raw:
            ts = m.get('match_start_time', '')
            date_str = str(ts)[:10] if ts else None
            if date_str and date_str < cutoff_past:
                stop = True  # matches are ordered desc — nothing older needed
                break
            if date_str and date_str > cutoff_future:
                continue  # too far ahead
            all_matches.append(parse_ch_match(m))

        if stop:
            break

        next_page = resp.get('page', {}).get('next', '')
        if not next_page:
            break
        pageno += 1
        time.sleep(2)

    return all_matches

def check_column_exists():
    """Return True if ch_match_id column exists in matches table."""
    code, data = sb_call("GET", "matches", params="select=ch_match_id&limit=1")
    return code == 200

def get_existing_ch_ids():
    """Get set of ch_match_ids already in Supabase."""
    code, data = sb_call("GET", "matches", params="select=ch_match_id&ch_match_id=not.is.null")
    if code != 200 or not data:
        return set()
    return {row['ch_match_id'] for row in data if row.get('ch_match_id')}

def find_existing(ch_id, date, opponent):
    """Find existing match by ch_match_id or by date+opponent (manual entries)."""
    # 1. By ch_match_id (fastest, exact)
    code, data = sb_call("GET", "matches", params=f"ch_match_id=eq.{ch_id}&select=id,result,ch_match_id")
    if code == 200 and data:
        return data[0]
    # 2. By date + normalized opponent (catches manually entered matches)
    opp_enc = urllib.parse.quote(opponent[:30])
    code2, data2 = sb_call("GET", "matches",
                            params=f"date=eq.{date}&opponent=ilike.{opp_enc}*&select=id,result,ch_match_id&limit=1")
    if code2 == 200 and data2:
        return data2[0]
    return None

def upsert_match(row):
    """Insert if new, or update ch_match_id + result on existing match."""
    ch_id  = row['ch_match_id']
    date   = row['date']
    opp    = row['opponent']

    existing = find_existing(ch_id, date, opp)

    if not existing:
        # Brand new match — insert
        code, _ = sb_call("POST", "matches", row)
        return 'inserted' if code == 201 else 'error'

    # Existing match found — patch ch_match_id if missing, update result if changed
    update = {}
    if not existing.get('ch_match_id'):
        update['ch_match_id'] = ch_id
    if existing['result'] == 'upcoming' and row['result'] != 'upcoming':
        update.update({'result': row['result'], 'our_score': row['our_score'],
                       'opponent_score': row['opponent_score']})
        if row.get('notes'):
            update['notes'] = row['notes']

    if update:
        code2, _ = sb_call("PATCH", "matches", body=update, params=f"id=eq.{existing['id']}")
        return 'updated' if code2 in (200, 204) else 'error'
    return 'skipped'

def main():
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f"[{now}] Starting CricHeroes → Supabase match sync...")
    print(f"  Window: past {SYNC_PAST_DAYS}d + next {SYNC_FUTURE_DAYS}d\n")

    # Check prerequisite migration
    if not check_column_exists():
        print("❌ ch_match_id column missing from matches table!")
        print("   Run this SQL in Supabase Dashboard > SQL Editor:")
        print("   ALTER TABLE matches ADD COLUMN IF NOT EXISTS ch_match_id TEXT UNIQUE;")
        print("   CREATE INDEX IF NOT EXISTS idx_matches_ch_match_id ON matches(ch_match_id);")
        sys.exit(1)

    print("Fetching matches from CricHeroes...", end=' ', flush=True)
    ch_matches = fetch_all_ch_matches()
    print(f"{len(ch_matches)} in window")

    if not ch_matches:
        print("Nothing to sync. Auth token may have expired.")
        sys.exit(1)

    upcoming = [m for m in ch_matches if m['result'] == 'upcoming']
    past     = [m for m in ch_matches if m['result'] != 'upcoming']
    print(f"  Upcoming: {len(upcoming)}  |  Past (in window): {len(past)}")

    counts = {'inserted': 0, 'updated': 0, 'skipped': 0}
    for m in ch_matches:
        action = upsert_match(m)
        counts[action] += 1
        tag = '🆕' if action == 'inserted' else ('✏️' if action == 'updated' else '·')
        print(f"  {tag} {m['date']} {m['result'].upper():<8} vs {m['opponent'][:30]}")

    print(f"\n{'='*50}")
    print(f"  Inserted: {counts['inserted']}  Updated: {counts['updated']}  Skipped: {counts['skipped']}")
    print(f"  ✅ Sync complete!")

if __name__ == '__main__':
    main()
