#!/usr/bin/env python3
# Auto-mirrored to ~/.scc-sync after each commit (see scripts/hooks/post-commit)
"""
CricHeroes → Supabase match sync for SCC.
Run: python3 scripts/sync_matches.py

Fetches all SCC matches from CricHeroes and syncs them to Supabase matches table:
  - Upcoming matches: created/updated so they appear in Matches + Calendar tabs
  - Past matches: synced if not already present (no overwrite of manually-edited rows)
  - Uses ch_match_id for deduplication (run `supabase/migrations/add_ch_match_id.sql` first)

Auth token rotates — grab a fresh 'authorization' header from DevTools if needed.
"""
import json, urllib.request, urllib.error, urllib.parse, datetime, sys, time, argparse, re

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
# Defaults: only sync upcoming matches. Use --past-days N to backfill past matches
# (safe: script only fills missing fields, never overwrites manual edits).
SYNC_PAST_DAYS = 0
SYNC_FUTURE_DAYS = 60

# ── CricHeroes player_id → SCC member name (for MOM mapping) ──────────────────
CH_PLAYER_NAMES = {
    680643: "Shaan Shaikh", 3855641: "Avinash", 26474497: "Adarsh Dwivedi",
    5447632: "Aaditya Jaiswal", 20844962: "Aditya Purohit", 1450076: "Ajinkya Gharpure",
    4391800: "Akash Jadhav", 30975147: "Anand", 26769238: "Animesh Saxena",
    14518769: "Aprmay Kumar", 2793490: "Arpan Thakur", 36043018: "Bharat Mishra",
    26733102: "Dhawal Jain", 27853017: "Gourav Shrivastava", 26218657: "Harshit Upadhyay",
    3142063: "Honey Porwal", 30974333: "Mayank Nayak", 26805965: "Nikhil",
    4842518: "Niraj Parmeshwar", 16794243: "Piyush Pankaj", 16937743: "Prateek Singh",
    6100183: "Pratik Patil", 15337300: "Rajat", 30406057: "Raushan",
    33275197: "Rishi Gupta", 26739447: "Ritik Lodha", 3954444: "Rohan Rao",
    14464945: "Saurabh Lele", 4541847: "Shakhil Srivastava", 34079971: "Shubham Chavhan",
    26805068: "Shubham Garethiya", 29767342: "Shubham Patil",
    26769030: "Soumyaranjan Mohapatra", 26869497: "Sudhakar Dama", 5536842: "Sushil Yadav",
    26769283: "Tarang", 26804704: "Vaibhav Shrivastav", 32434601: "Vinay Raut",
    42750501: "Abhishek Manhas",
}

# Populated at startup from Supabase: lowercased member name → member UUID
MEMBER_NAME_TO_ID = {}

# Set by --update-mom CLI flag. When True, CH's MOM overwrites the existing
# value in Supabase (default behaviour: only fill in missing MOMs, never
# overwrite — protects admin's manual picks).
FORCE_UPDATE_MOM = False

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

def resolve_mom_member_id(pom_player_id):
    """CricHeroes pom_player_id → Supabase member UUID (or None if not found).

    Lookup strategy (in order):
      1. Exact name match (lowercased)
      2. First-name match (Supabase has "Avinash" but CH map has "Avinash Singh")
      3. Last-name match (rare, but covers "AKASH JADHAV" vs "Akash")
    """
    if not pom_player_id:
        return None
    ch_name = CH_PLAYER_NAMES.get(pom_player_id)
    if not ch_name:
        return None

    norm = ch_name.lower().strip()
    # 1. Exact match
    if norm in MEMBER_NAME_TO_ID:
        return MEMBER_NAME_TO_ID[norm]

    # 2. First-name fallback (Supabase has only "Avinash"; CH map has "Avinash Singh")
    parts = norm.split()
    if parts and parts[0] in MEMBER_NAME_TO_ID:
        return MEMBER_NAME_TO_ID[parts[0]]

    # 3. Last-name fallback
    if len(parts) > 1 and parts[-1] in MEMBER_NAME_TO_ID:
        return MEMBER_NAME_TO_ID[parts[-1]]

    # 4. Substring fallback — any Supabase name that starts with the CH first name
    if parts:
        first = parts[0]
        for member_name, member_id in MEMBER_NAME_TO_ID.items():
            if member_name.split()[0] == first:
                return member_id

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
    mom_id   = resolve_mom_member_id(m.get('pom_player_id'))

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
        'man_of_match_id': mom_id,
    }

def fetch_all_ch_matches(past_days=None, future_days=None):
    all_matches, pageno = [], 1
    pd = past_days if past_days is not None else SYNC_PAST_DAYS
    fd = future_days if future_days is not None else SYNC_FUTURE_DAYS
    cutoff_past   = (datetime.date.today() - datetime.timedelta(days=pd)).isoformat()
    cutoff_future = (datetime.date.today() + datetime.timedelta(days=fd)).isoformat()

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

# ── Fuzzy opponent matching — prevents duplicate rows when the manual entry
# ──  used a different spelling (e.g. "Yashwin Hinjewadi" vs "Yashwin Hinjawadi"),
# ──  an abbreviation ("YNR" vs "Yashwin Night Riders"), or minor typos.
_FILLERS = {'xi', '11', 'x1', 'cricket', 'club', 'the'}

def _norm(name):
    """Lowercase, strip punctuation/parens, collapse spaces, drop filler words."""
    if not name:
        return ''
    s = re.sub(r'\([^)]*\)', ' ', name.lower())
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(t for t in s.split() if t and t not in _FILLERS).strip()

def _lev(a, b):
    """Levenshtein edit distance."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        cur = [i + 1]
        for j, cb in enumerate(b):
            cur.append(min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (ca != cb)))
        prev = cur
    return prev[-1]

def _raw_initials(name):
    s = re.sub(r'\([^)]*\)', ' ', name or '')
    words = re.sub(r'[^a-zA-Z ]+', ' ', s).split()
    return ''.join(w[0].lower() for w in words if w)

def same_team(a, b):
    """True if two opponent names look like the same team."""
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    short, long = (a, b) if len(a) < len(b) else (b, a)
    short_raw = re.sub(r'[^a-z]', '', short.lower())
    if 2 <= len(short_raw) <= 6 and _raw_initials(long) == short_raw:
        return True
    d = _lev(na, nb)
    if d <= 2 and min(len(na), len(nb)) >= 4:
        return True
    if max(len(na), len(nb)) > 0 and d / max(len(na), len(nb)) <= 0.25:
        return True
    pa = na.split()[0] if na.split() else ''
    pb = nb.split()[0] if nb.split() else ''
    return bool(pa and pb and pa[:4] == pb[:4] and len(pa) >= 4)

def find_existing(ch_id, date, opponent):
    """Find existing match by ch_match_id, or fuzzy date+opponent match.

    For the fuzzy step, we deliberately SKIP rows that already have a
    different ch_match_id assigned. Otherwise a same-day doubleheader
    against the same team (e.g. two matches vs The Renegades on May 2)
    would conflate the second sync into the first row.
    """
    # 1. Exact match by ch_match_id (fastest, always wins)
    code, data = sb_call("GET", "matches",
                          params=f"ch_match_id=eq.{ch_id}&select=id,result,ch_match_id,date,venue,opponent,man_of_match_id")
    if code == 200 and data:
        return data[0]

    # 2. Fetch matches on this date; fuzzy-match opponent in Python — but
    # only against rows whose ch_match_id is null (i.e. unlinked manual
    # entries). Rows with a different ch_match_id are different matches.
    code2, data2 = sb_call("GET", "matches",
                            params=f"date=eq.{date}&select=id,result,ch_match_id,date,venue,opponent,man_of_match_id")
    if code2 == 200 and data2:
        for row in data2:
            if row.get('ch_match_id'):
                continue  # already linked to a different CH match — don't conflate
            if same_team(row.get('opponent', ''), opponent):
                return row
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

    # Existing match found — build update payload
    update = {}
    if not existing.get('ch_match_id'):
        update['ch_match_id'] = ch_id

    # Result changed from upcoming → completed: pull in scores
    if existing['result'] == 'upcoming' and row['result'] != 'upcoming':
        update.update({'result': row['result'], 'our_score': row['our_score'],
                       'opponent_score': row['opponent_score']})
        if row.get('notes'):
            update['notes'] = row['notes']

    # Still upcoming: sync date/venue/opponent in case match was rescheduled
    if existing['result'] == 'upcoming' and row['result'] == 'upcoming':
        if existing.get('date') != row['date']:
            update['date'] = row['date']
        if existing.get('venue') != row.get('venue') and row.get('venue'):
            update['venue'] = row['venue']
        if existing.get('opponent') != row.get('opponent') and row.get('opponent'):
            update['opponent'] = row['opponent']

    # Man of the Match handling:
    #   - Default: only fill in if missing (preserves admin's manual picks)
    #   - With --update-mom: overwrite from CricHeroes whenever CH has one
    #     (use when CH later updates the MOM after the match was scored)
    if row.get('man_of_match_id'):
        if not existing.get('man_of_match_id'):
            update['man_of_match_id'] = row['man_of_match_id']
        elif FORCE_UPDATE_MOM and existing.get('man_of_match_id') != row.get('man_of_match_id'):
            update['man_of_match_id'] = row['man_of_match_id']

    if update:
        code2, _ = sb_call("PATCH", "matches", body=update, params=f"id=eq.{existing['id']}")
        return 'updated' if code2 in (200, 204) else 'error'
    return 'skipped'

# ── Internal-match (Dhurandars vs Bazigars) reconciliation ────────────────────
# Internal matches are SCC-vs-SCC, so they do NOT appear in the SCC team feed that
# the main sync walks (their CricHeroes teams are separate "Sangria Dhurandhars" /
# "Sangria Baazigars" sides). They're created manually in the app with a ch_match_id.
# This step pulls their result/scores straight from the CricHeroes match page once
# the game is over, so admins don't have to enter it by hand.

_INTERNAL_BUILD_ID = None

def _ch_build_id():
    """Scrape the Next.js buildId from cricheroes.com (used by the public SSR page)."""
    global _INTERNAL_BUILD_ID
    if _INTERNAL_BUILD_ID:
        return _INTERNAL_BUILD_ID
    req = urllib.request.Request('https://cricheroes.com/', headers={'user-agent': CH_UA})
    html = urllib.request.urlopen(req, timeout=15).read().decode()
    m = re.search(r'"buildId":"([^"]+)"', html)
    if not m:
        raise RuntimeError('Could not find Next.js buildId on cricheroes.com')
    _INTERNAL_BUILD_ID = m.group(1)
    return _INTERNAL_BUILD_ID

def _ch_match_summary(ch_match_id):
    """Return summaryData.data for a match via the public SSR endpoint, or None."""
    url = (f'https://cricheroes.com/_next/data/{_ch_build_id()}'
           f'/scorecard/{ch_match_id}/x/x/scorecard.json')
    req = urllib.request.Request(url, headers={'user-agent': CH_UA, 'accept': 'application/json'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=20).read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    sd = (data.get('pageProps', {}) or {}).get('summaryData', {}) or {}
    return sd.get('data') if sd.get('status') else None

def _internal_team_of(name):
    n = (name or '').lower()
    if 'dhurand' in n:
        return 'dhurandars'
    if 'baazig' in n or 'bazig' in n:
        return 'bazigars'
    return None

def _strip_super_over(score):
    """'134/10 & 7/1' → '134/10' (drop the super-over portion)."""
    return (score or '').split('&')[0].strip()

def reconcile_internal_matches():
    """Update any still-'upcoming' internal match whose CricHeroes game is now over."""
    code, rows = sb_call(
        "GET", "matches",
        params="select=id,date,result,ch_match_id&match_type=eq.internal"
               "&result=eq.upcoming&ch_match_id=not.is.null")
    if code != 200 or not rows:
        return 0
    updated = 0
    for r in rows:
        ch_id = r['ch_match_id']
        try:
            s = _ch_match_summary(ch_id)
        except Exception as e:
            print(f"  ⚠️  internal ch={ch_id}: fetch failed ({type(e).__name__})")
            continue
        if not s:
            continue
        # Only act once the match has actually finished
        finished = str(s.get('status', '')).lower() == 'past' or \
                   str(s.get('match_result', '')).lower() == 'resulted'
        if not finished:
            print(f"  · internal ch={ch_id} not finished yet ({s.get('status')})")
            continue
        ta, tb = s.get('team_a', {}) or {}, s.get('team_b', {}) or {}
        a_side = _internal_team_of(ta.get('name'))
        b_side = _internal_team_of(tb.get('name'))
        # Map Dhurandars → our_score, Bazigars → opponent_score (app convention)
        dhur = ta if a_side == 'dhurandars' else tb if b_side == 'dhurandars' else None
        baz  = ta if a_side == 'bazigars' else tb if b_side == 'bazigars' else None
        winner = _internal_team_of(s.get('winning_team'))
        update = {
            'result':         'won' if winner else 'draw',
            'winning_team':   winner,
            'our_score':      _strip_super_over((dhur or {}).get('summary')),
            'opponent_score': _strip_super_over((baz or {}).get('summary')),
        }
        win_by = s.get('win_by') or ''
        if win_by:
            update['notes'] = win_by
        code2, _ = sb_call("PATCH", "matches", body=update, params=f"id=eq.{r['id']}")
        if code2 in (200, 204):
            updated += 1
            print(f"  🏏 internal ch={ch_id} → {winner or 'draw'}  "
                  f"({update['our_score']} vs {update['opponent_score']}) | {win_by}")
        else:
            print(f"  ⚠️  internal ch={ch_id}: update failed (HTTP {code2})")
    return updated

def load_supabase_members():
    """Fetch members from Supabase and populate MEMBER_NAME_TO_ID (lowercased names)."""
    code, data = sb_call("GET", "members", params="select=id,name")
    if code != 200 or not data:
        return 0
    for row in data:
        if row.get('name') and row.get('id'):
            MEMBER_NAME_TO_ID[row['name'].lower().strip()] = row['id']
    return len(MEMBER_NAME_TO_ID)

def main():
    global FORCE_UPDATE_MOM
    parser = argparse.ArgumentParser(description='Sync CricHeroes matches → Supabase')
    parser.add_argument('--past-days', type=int, default=SYNC_PAST_DAYS,
                        help='How many past days to include (default 0 = upcoming only). '
                             'Use a larger value to backfill historic data.')
    parser.add_argument('--future-days', type=int, default=SYNC_FUTURE_DAYS,
                        help='How many future days to fetch (default 60).')
    parser.add_argument('--update-mom', action='store_true',
                        help='Overwrite the existing Man of the Match in Supabase with '
                             'whatever CricHeroes currently has. Use this when CH updates '
                             'a match\'s MOM after it was already synced. Default: never '
                             'overwrites (only fills missing MOMs).')
    args = parser.parse_args()
    FORCE_UPDATE_MOM = args.update_mom

    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f"[{now}] Starting CricHeroes → Supabase match sync...")
    print(f"  Window: past {args.past_days}d + next {args.future_days}d\n")

    # Check prerequisite migration
    if not check_column_exists():
        print("❌ ch_match_id column missing from matches table!")
        print("   Run this SQL in Supabase Dashboard > SQL Editor:")
        print("   ALTER TABLE matches ADD COLUMN IF NOT EXISTS ch_match_id TEXT UNIQUE;")
        print("   CREATE INDEX IF NOT EXISTS idx_matches_ch_match_id ON matches(ch_match_id);")
        sys.exit(1)

    # Load members to enable Man of the Match resolution
    n_members = load_supabase_members()
    print(f"Loaded {n_members} members from Supabase for MOM mapping\n")

    print("Fetching matches from CricHeroes...", end=' ', flush=True)
    ch_matches = fetch_all_ch_matches(past_days=args.past_days, future_days=args.future_days)
    print(f"{len(ch_matches)} in window")

    if not ch_matches:
        print("Nothing to sync. Auth token may have expired.")
        sys.exit(1)

    upcoming = [m for m in ch_matches if m['result'] == 'upcoming']
    past     = [m for m in ch_matches if m['result'] != 'upcoming']
    print(f"  Upcoming: {len(upcoming)}  |  Past (in window): {len(past)}")

    counts = {'inserted': 0, 'updated': 0, 'skipped': 0}
    mom_resolved = 0
    for m in ch_matches:
        action = upsert_match(m)
        counts[action] += 1
        tag = '🆕' if action == 'inserted' else ('✏️' if action == 'updated' else '·')
        mom_tag = ''
        if m.get('man_of_match_id'):
            mom_resolved += 1
            mom_tag = ' ⭐MOM'
        print(f"  {tag} {m['date']} {m['result'].upper():<8} vs {m['opponent'][:30]}{mom_tag}")

    # Internal (Dhurandars vs Bazigars) matches aren't in the team feed above —
    # reconcile their results straight from each match's CricHeroes page.
    print("\nReconciling internal matches...")
    internal_updated = reconcile_internal_matches()

    print(f"\n{'='*50}")
    print(f"  Inserted: {counts['inserted']}  Updated: {counts['updated']}  Skipped: {counts['skipped']}")
    print(f"  Internal results updated: {internal_updated}")
    print(f"  MOM resolved: {mom_resolved} / {len(ch_matches)}")
    print(f"  ✅ Sync complete!")

if __name__ == '__main__':
    main()
