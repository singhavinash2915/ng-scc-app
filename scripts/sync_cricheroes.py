#!/usr/bin/env python3
"""
CricHeroes → Supabase daily sync script for SCC.
Run: python3 scripts/sync_cricheroes.py

Fetches SCC-specific batting/bowling/fielding stats from CricHeroes API
and upserts them into Supabase member_cricket_stats table.

Auth token rotates — if you get auth errors, grab a fresh 'authorization'
header value from DevTools > Network on any cricheroes.com page.
"""
import json, urllib.request, urllib.error, datetime, sys

# ── CricHeroes API config ─────────────────────────────────────────────────────
CH_API_KEY   = "cr!CkH3r0s"
CH_AUTH      = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"   # ← update if auth expires
CH_UDID      = "3833274f1b23ae81b995ebfdfb7f948b"
CH_UA        = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
CH_BASE      = "https://api.cricheroes.in/api/v1/leaderboard"
CH_PARAMS    = "teamId=7927431&teamName=sangria-cricket-club&tabName=leaderboard&tz=asia/calcutta"

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"
SEASON       = "2025-26"

# ── CricHeroes player_id → Supabase member UUID ───────────────────────────────
CH_TO_SB = {
    680643:"5d623102-766a-4243-83ef-2fb941ae96f3",    # Shaan Shaikh
    3855641:"7545cb6b-41fe-4102-b392-f560ae44805f",   # Avinash Singh
    26474497:"329137e8-ea3d-4a68-94a3-718e24e610cb",  # Adarsh Dwivedi
    5447632:"8fc244d3-cbfb-4c9c-8c5b-efd47143d902",   # Aditya (Aaditya Jaiswal)
    20844962:"b8c4f216-25f5-4e85-881c-4973ab4cb042",  # Aditya P (Aditya Purohit)
    1450076:"c800fdc4-92e0-4b58-832d-0672dff61a9c",   # Ajinkya Gharpure
    4391800:"230629f4-cd80-4903-8b75-c485c75b2de7",   # Akash Jadhav
    30975147:"35e097af-b2b0-468c-b0e0-6220de787cf4",  # Anand
    26769238:"4fc80954-a105-4570-9c4a-88fac57b45be",  # Animesh Saxena
    14518769:"69035791-1be6-4cab-8315-120eccefe44b",  # Aprmay Kumar
    2793490:"c5e6cb6d-394d-4623-ab3d-c28705b77514",   # Arpan Thakur
    36043018:"45a04053-f886-40a5-967c-f581d5b4ffeb",  # Bharat Mishra
    26733102:"01491044-fbf0-48db-ae71-561d153d28e6",  # Dhawal Jain
    27853017:"3505303e-3288-49ef-b1cc-44285ecedbed",  # Gourav Shrivastava
    26218657:"055558d1-2999-44f5-881e-38d80ae4d92f",  # Harshit Upadhyay
    3142063:"da957ad5-baa8-44b9-9dc6-56f2afa6e7ea",   # Honey Porwal
    30974333:"35481bee-823f-4fbb-9f84-9c9a716c616e",  # Mayank Nayak
    26805965:"8cfc8965-bb5b-4718-a2ba-d1ca202760a5",  # Nikhil
    4842518:"6571e062-9ac5-414f-b0d6-12e53b680327",   # Niraj Parmeshwar
    16794243:"d9729561-fead-488c-9d8f-8a7b52c93567",  # Piyush Pankaj
    16937743:"6ee157f3-e24c-4f1b-aad8-542145f5c828",  # Prateek Singh
    6100183:"2d43ae38-6a5d-4c88-841e-3ccc06a1671d",   # PRATIK PATIL
    15337300:"f258b017-932e-4a63-b217-34410199a1a5",  # Rajat
    30406057:"1c6cb1c4-f523-4b16-9997-0764190931fc",  # Raushan
    33275197:"6c00436e-cd4c-4c86-bc49-e0ba36179223",  # Rishi Gupta
    26739447:"ef718518-322a-4cb6-a843-dba1bdc8fc1f",  # Ritik Lodha
    3954444:"1046e698-8d6e-4f14-8c2d-c7759764f02e",   # Rohan Kumar Rao
    14464945:"e412ba18-86c9-4896-ad06-f687b0bdc88c",  # Saurabh Lele
    4541847:"49439c54-f8bb-45af-81d0-d99a3875f214",   # Shakhil Srivastava
    34079971:"afeea407-dd39-4894-ba6b-e7d81fad005e",  # Shubham Chavhan
    26805068:"7c466077-bd02-4f23-ad4d-218bd8d70fff",  # Shubham Garethiya
    29767342:"3f98ee10-fa48-4c60-b4fb-f85ecc5af1d4",  # Shubham Patil
    26769030:"04e8130d-78c4-44b7-a54e-e50c206941c6",  # Soumyaranjan Mohapatra
    26869497:"09a4ec82-55fa-4ffd-915e-a2bfe71e8768",  # Sudhakar Dama
    5536842:"1f68f840-b4ec-49a2-bcde-49d7fcf17dd0",   # Sushil Yadav
    26769283:"9dcb188f-b007-4427-8114-86984c2c209f",  # Tarang
    26804704:"85762f91-6b6d-46fe-a6cf-9a2b38f07338",  # Vaibhav Shrivastav
    32434601:"64d33e23-8e61-4406-b1c2-e540da9c9da5",  # Vinay Raut
    42750501:"13972b5b-0423-42e2-9490-1ae2f892218c",  # Abhishek Manhas
}

import time

def ch_fetch_all(endpoint_name):
    import time
    all_data, page = [], 1
    url = f"{CH_BASE}/{endpoint_name}/7927431?{CH_PARAMS}"
    while url:
        req = urllib.request.Request(url, headers={
            "api-key": CH_API_KEY, "authorization": CH_AUTH, "udid": CH_UDID,
            "device-type": "Chrome: 146.0.0.0", "accept": "application/json",
            "origin": "https://cricheroes.com", "referer": "https://cricheroes.com/",
            "user-agent": CH_UA
        })
        try:
            with urllib.request.urlopen(req) as r:
                resp = json.loads(r.read())
            if not resp.get('status'):
                print(f"  API error: {resp}")
                break
            all_data.extend(resp.get('data', []))
            next_path = resp.get('page', {}).get('next', '')
            url = f"https://api.cricheroes.in/api/v1{next_path}" if next_path else None
            page += 1
            if url: time.sleep(2)
        except Exception as e:
            print(f"  Fetch error: {e}")
            break
    return all_data

def sf(v):
    try: return float(v) if v not in (None, '-', '', 'N/A') else 0.0
    except: return 0.0

def si(v):
    try: return int(float(v)) if v not in (None, '-', '', 'N/A') else 0
    except: return 0

def sb_call(method, path, body=None):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        method=method
    )
    try:
        with urllib.request.urlopen(req) as r: return r.status, None
    except urllib.error.HTTPError as e: return e.code, e.read()

def main():
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}] Starting CricHeroes sync...")

    DEFAULTS = {
        'season': SEASON, 'batting_matches':0, 'batting_innings':0, 'batting_runs':0,
        'batting_highest_score':0, 'batting_average':0.0, 'batting_strike_rate':0.0,
        'batting_fours':0, 'batting_sixes':0, 'batting_fifties':0, 'batting_hundreds':0, 'batting_ducks':0,
        'bowling_matches':0, 'bowling_innings':0, 'bowling_overs':0.0, 'bowling_wickets':0,
        'bowling_runs_conceded':0, 'bowling_economy':0.0, 'bowling_average':0.0,
        'bowling_strike_rate':0.0, 'bowling_best_figures':'0/0', 'bowling_five_wickets':0,
        'fielding_catches':0, 'fielding_stumpings':0, 'fielding_run_outs':0,
        'last_synced_at': datetime.datetime.utcnow().isoformat() + 'Z',
    }

    print("Fetching batting...", end=' ', flush=True)
    batting = ch_fetch_all("get-team-batting-leaderboard")
    print(f"{len(batting)} rows")
    time.sleep(3)

    print("Fetching bowling...", end=' ', flush=True)
    bowling = ch_fetch_all("get-team-bowling-leaderboard")
    print(f"{len(bowling)} rows")
    time.sleep(3)

    print("Fetching fielding...", end=' ', flush=True)
    fielding = ch_fetch_all("get-team-fielding-leaderboard")
    print(f"{len(fielding)} rows")

    stats = {}
    for row in batting:
        uid = CH_TO_SB.get(row['player_id'])
        if not uid: continue
        s = stats.setdefault(uid, {**DEFAULTS, 'member_id': uid})
        s.update({'batting_matches':si(row.get('total_match')), 'batting_innings':si(row.get('innings')),
                  'batting_runs':si(row.get('total_runs')), 'batting_highest_score':si(row.get('highest_run')),
                  'batting_average':sf(row.get('average')), 'batting_strike_rate':sf(row.get('strike_rate')),
                  'batting_fours':si(row.get('4s')), 'batting_sixes':si(row.get('6s')),
                  'batting_fifties':si(row.get('50s')), 'batting_hundreds':si(row.get('100s'))})

    for row in bowling:
        uid = CH_TO_SB.get(row['player_id'])
        if not uid: continue
        s = stats.setdefault(uid, {**DEFAULTS, 'member_id': uid})
        s.update({'bowling_matches':si(row.get('total_match')), 'bowling_innings':si(row.get('innings')),
                  'bowling_overs':sf(row.get('overs')), 'bowling_wickets':si(row.get('total_wickets')),
                  'bowling_runs_conceded':si(row.get('runs')), 'bowling_economy':sf(row.get('economy')),
                  'bowling_average':sf(row.get('avg')), 'bowling_strike_rate':sf(row.get('SR')),
                  'bowling_best_figures':f"{si(row.get('highest_wicket'))}/0"})

    for row in fielding:
        uid = CH_TO_SB.get(row['player_id'])
        if not uid: continue
        s = stats.setdefault(uid, {**DEFAULTS, 'member_id': uid})
        s.update({'fielding_catches':si(row.get('catches')), 'fielding_stumpings':si(row.get('stumpings')),
                  'fielding_run_outs':si(row.get('run_outs'))})

    rows = list(stats.values())
    print(f"\nSyncing {len(rows)} members to Supabase...")

    code, err = sb_call("DELETE", f"member_cricket_stats?season=eq.{SEASON}")
    if err: print(f"  Delete warning: {err[:100]}")

    code, err = sb_call("POST", "member_cricket_stats", rows)
    if err:
        print(f"  ❌ Insert failed ({code}): {err[:200]}")
        sys.exit(1)

    print(f"  ✅ {len(rows)} records synced! (HTTP {code})")
    print(f"\nTop 5 batters:")
    for r in sorted(rows, key=lambda x: -x['batting_runs'])[:5]:
        name = next((row['name'] for row in batting if CH_TO_SB.get(row['player_id'])==r['member_id']), '?')
        print(f"  {name:<25} Runs:{r['batting_runs']:>5}  Wkts:{r['bowling_wickets']:>4}  Catches:{r['fielding_catches']:>3}")

if __name__ == '__main__':
    main()
