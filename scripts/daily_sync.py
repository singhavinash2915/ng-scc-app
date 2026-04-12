#!/usr/bin/env python3
"""
SCC Daily Sync — CricHeroes → Supabase
Runs both: player stats + match sync

Usage:
  python3 scripts/daily_sync.py

Cron (6 AM daily):
  0 6 * * * cd /Users/avinashsingh/Documents/ng-scc-app && python3 scripts/daily_sync.py >> /tmp/scc_sync.log 2>&1

Auth token note:
  The CricHeroes 'authorization' token is session-based and may expire.
  If you see auth errors, open cricheroes.com in a browser, open DevTools > Network,
  copy the 'authorization' header value from any API request, and update CH_AUTH below
  (in both this file and sync_cricheroes.py / sync_matches.py).
"""
import subprocess, sys, datetime, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON     = sys.executable

def run(script, label):
    print(f"\n{'='*60}")
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {label}")
    print('='*60)
    result = subprocess.run([PYTHON, os.path.join(SCRIPT_DIR, script)], capture_output=False)
    if result.returncode != 0:
        print(f"  ⚠️  {label} exited with code {result.returncode}")
    return result.returncode

def main():
    print(f"\n🏏 SCC Daily Sync — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")

    code1 = run('sync_cricheroes.py', 'Step 1/2: Player Stats (CricHeroes → Supabase)')
    code2 = run('sync_matches.py',    'Step 2/2: Match History (CricHeroes → Supabase)')

    print(f"\n{'='*60}")
    if code1 == 0 and code2 == 0:
        print("✅ All syncs completed successfully!")
    else:
        print(f"⚠️  Completed with errors (stats:{code1} matches:{code2})")
        print("   Check auth token if seeing 401/403 errors.")
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Done.")

if __name__ == '__main__':
    main()
