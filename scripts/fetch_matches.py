#!/usr/bin/env python3
"""
CricHeroes → Supabase match sync for SCC.
Run: python3 scripts/fetch_matches.py

Fetches all SCC matches from CricHeroes and optionally syncs them to Supabase.
Auth token rotates — grab a fresh 'authorization' header from DevTools if needed.
"""
import json, urllib.request, urllib.error, datetime, sys, time

# ── CricHeroes API config ─────────────────────────────────────────────────────
CH_API_KEY   = "cr!CkH3r0s"
CH_AUTH      = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"   # ← update if auth expires
CH_UDID      = "3833274f1b23ae81b995ebfdfb7f948b"
CH_UA        = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
TEAM_ID      = 7927431
DATETIME_MS  = int(time.time() * 1000)  # current timestamp in ms

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

# ── CricHeroes player_id → member name (for display) ─────────────────────────
CH_PLAYER_NAMES = {
    680643: "Shaan Shaikh",
    3855641: "Avinash Singh",
    26474497: "Adarsh Dwivedi",
    5447632: "Aaditya Jaiswal",
    20844962: "Aditya Purohit",
    1450076: "Ajinkya Gharpure",
    4391800: "Akash Jadhav",
    30975147: "Anand",
    26769238: "Animesh Saxena",
    14518769: "Aprmay Kumar",
    2793490: "Arpan Thakur",
    36043018: "Bharat Mishra",
    26733102: "Dhawal Jain",
    27853017: "Gourav Shrivastava",
    26218657: "Harshit Upadhyay",
    3142063: "Honey Porwal",
    30974333: "Mayank Nayak",
    26805965: "Nikhil",
    4842518: "Niraj Parmeshwar",
    16794243: "Piyush Pankaj",
    16937743: "Prateek Singh",
    6100183: "Pratik Patil",
    15337300: "Rajat",
    30406057: "Raushan",
    33275197: "Rishi Gupta",
    26739447: "Ritik Lodha",
    3954444: "Rohan Kumar Rao",
    14464945: "Saurabh Lele",
    4541847: "Shakhil Srivastava",
    34079971: "Shubham Chavhan",
    26805068: "Shubham Garethiya",
    29767342: "Shubham Patil",
    26769030: "Soumyaranjan Mohapatra",
    26869497: "Sudhakar Dama",
    5536842: "Sushil Yadav",
    26769283: "Tarang",
    26804704: "Vaibhav Shrivastav",
    32434601: "Vinay Raut",
    42750501: "Abhishek Manhas",
}

def ch_headers():
    return {
        "api-key": CH_API_KEY,
        "authorization": CH_AUTH,
        "udid": CH_UDID,
        "device-type": "Chrome: 146.0.0.0",
        "accept": "application/json",
        "origin": "https://cricheroes.com",
        "referer": "https://cricheroes.com/",
        "user-agent": CH_UA,
    }

def fetch_matches_page(pageno):
    url = (f"https://api.cricheroes.in/api/v1/team/get-team-match/{TEAM_ID}"
           f"?pagesize=12&teamId={TEAM_ID}&pageno={pageno}&datetime={DATETIME_MS}")
    req = urllib.request.Request(url, headers=ch_headers())
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read()[:200]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

def innings_score(innings_list, team_id):
    """Get score string for a given team from innings list."""
    if not innings_list:
        return "—"
    for inn in innings_list:
        if str(inn.get('team_id')) == str(team_id):
            s = inn.get('summary', {})
            return f"{s.get('score','?')} {s.get('over','')}"
    # fallback: first innings
    s = innings_list[0].get('summary', {})
    return f"{s.get('score','?')} {s.get('over','')}"

def parse_match(m):
    """Extract clean match summary from CricHeroes match object."""
    scc_is_team_a = str(m.get('team_a_id')) == str(TEAM_ID)
    their_team    = m.get('team_b') if scc_is_team_a else m.get('team_a')
    their_id      = m.get('team_b_id') if scc_is_team_a else m.get('team_a_id')

    # innings lists contain both teams' innings; find by team_id
    all_innings = (m.get('team_a_innings') or []) + (m.get('team_b_innings') or [])
    our_score   = innings_score(all_innings, TEAM_ID)
    their_score = innings_score(all_innings, their_id)

    winning_team_id = m.get('winning_team_id')
    match_result    = m.get('match_result', '')
    ts              = m.get('match_start_time', '')

    if not match_result or match_result.strip() == '':
        result = 'upcoming'
    elif str(winning_team_id) == str(TEAM_ID):
        result = 'won'
    elif winning_team_id:
        result = 'lost'
    else:
        result = 'draw'

    pom_id   = m.get('pom_player_id')
    pom_name = CH_PLAYER_NAMES.get(pom_id, f"ID:{pom_id}") if pom_id else None

    date_str = str(ts)[:10] if ts else None

    return {
        'ch_match_id':    m.get('match_id'),
        'date':           date_str,
        'opponent':       their_team,
        'venue':          m.get('ground_name', ''),
        'result':         result,
        'our_score':      our_score,
        'opponent_score': their_score,
        'win_by':         m.get('win_by', ''),
        'overs':          m.get('overs', ''),
        'tournament':     m.get('tournament_name', ''),
        'man_of_match':   pom_name,
        'toss':           m.get('toss_details', ''),
    }

def fetch_all_matches():
    all_matches = []
    pageno = 1
    while True:
        print(f"  Fetching page {pageno}...", end=' ', flush=True)
        resp = fetch_matches_page(pageno)
        if not resp or not resp.get('status'):
            print("no data / error — stopping")
            break
        matches_raw = resp.get('data', [])
        if isinstance(matches_raw, dict):
            matches_raw = matches_raw.get('data', [])
        if not matches_raw:
            print("empty — done")
            break
        print(f"{len(matches_raw)} matches")
        for m in matches_raw:
            all_matches.append(parse_match(m))
        next_page = resp.get('page', {}).get('next', '')
        if not next_page:
            break
        pageno += 1
        time.sleep(2)
    return all_matches

def main():
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}] Fetching SCC matches from CricHeroes...\n")

    matches = fetch_all_matches()

    if not matches:
        print("No matches found. Auth token may have expired.")
        print("Grab a fresh 'authorization' header from DevTools > Network on cricheroes.com")
        sys.exit(1)

    # Sort by date desc
    matches.sort(key=lambda x: x.get('date') or '', reverse=True)

    print(f"\n{'='*90}")
    print(f"{'Date':<12} {'Result':<8} {'Opponent':<30} {'SCC Score':<22} {'Opposition':<22}")
    print(f"{'='*90}")
    for m in matches:
        date    = m['date'] or '—'
        result  = m['result'].upper()[:6]
        opp     = (m['opponent'] or '—')[:29]
        our_s   = m['our_score'][:21]
        their_s = m['opponent_score'][:21]
        print(f"{date:<12} {result:<8} {opp:<30} {our_s:<22} {their_s:<22}")

    print(f"\nTotal: {len(matches)} matches")

    # Stats summary
    results = [m['result'] for m in matches if m['result'] != 'upcoming']
    won  = results.count('won')
    lost = results.count('lost')
    draw = results.count('draw')
    total_played = won + lost + draw
    print(f"\nRecord: {won}W / {lost}L / {draw}D  ({total_played} played)")
    if total_played:
        print(f"Win rate: {won/total_played*100:.1f}%")

    # MoM breakdown
    mom_counts = {}
    for m in matches:
        if m.get('man_of_match'):
            mom_counts[m['man_of_match']] = mom_counts.get(m['man_of_match'], 0) + 1
    if mom_counts:
        print("\nMan of Match awards:")
        for name, count in sorted(mom_counts.items(), key=lambda x: -x[1]):
            print(f"  {name}: {count}")

    # Save to JSON
    out_file = 'scc_matches.json'
    with open(out_file, 'w') as f:
        json.dump(matches, f, indent=2, default=str)
    print(f"\n✅ Saved {len(matches)} matches to {out_file}")

if __name__ == '__main__':
    main()
