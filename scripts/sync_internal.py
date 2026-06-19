#!/usr/bin/env python3
"""
SCC Internal Match Sync — CricHeroes → Supabase

Auto-syncs the club's internal "El Clasico" matches (Sangria Dhurandhars vs
Sangria Baazigars, tournament "Sangria Internal Cricket League") into the
`matches` table as match_type='internal'. Mirrors what sync_matches.py does for
external matches, but for the two internal teams.

Why a separate script: internal matches live under their own CricHeroes teams
(not SCC's external team feed), and we deliberately keep internal data separate
from season/external stats.

Reconciliation (no duplicates, no deletes):
  1. match by ch_match_id  → update
  2. else match an existing internal row by exact date → backfill ch_match_id +
     winning_team + result + venue
  3. else insert a new internal row

Usage:
  python3 sync_internal.py            # apply
  python3 sync_internal.py --dry-run  # show plan only
"""
import urllib.request, json, gzip, datetime, sys

CH_API_KEY = "cr!CkH3r0s"
CH_AUTH    = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"   # ← update if auth expires
CH_UDID    = "3833274f1b23ae81b995ebfdfb7f948b"
CH_UA      = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Internal CricHeroes team ids (from the internal tournament scorecards)
DHURANDHARS_ID = 12538514
BAAZIGARS_ID   = 12538560

SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

OPPONENT_LABEL = "Sangria Dhurandars vs Sangria Bazigars"


def ch_headers():
    return {
        "api-key": CH_API_KEY, "authorization": CH_AUTH, "udid": CH_UDID,
        "device-type": "Chrome: 146.0.0.0", "accept": "application/json",
        "origin": "https://cricheroes.com", "referer": "https://cricheroes.com/",
        "user-agent": CH_UA, "accept-encoding": "gzip",
    }


def ch_get(url):
    req = urllib.request.Request(url, headers=ch_headers())
    r = urllib.request.urlopen(req)
    data = r.read()
    if r.headers.get("content-encoding") == "gzip":
        data = gzip.decompress(data)
    return json.loads(data)


def sb(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{('?' + params) if params else ''}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        }, method=method,
    )
    with urllib.request.urlopen(req) as r:
        resp = r.read()
        return json.loads(resp) if resp else None


def fetch_internal_matches():
    """All internal matches from the Dhurandhars team feed (covers both teams)."""
    ms = int(datetime.datetime.now().timestamp() * 1000)
    out, page = [], 1
    while True:
        url = (f"https://api.cricheroes.in/api/v1/team/get-team-match/{DHURANDHARS_ID}"
               f"?pagesize=20&teamId={DHURANDHARS_ID}&pageno={page}&datetime={ms}")
        items = ch_get(url)
        items = items if isinstance(items, list) else items.get("data", [])
        if not items:
            break
        out.extend(items)
        if len(items) < 20:
            break
        page += 1
    # keep only Dhurandhars-vs-Baazigars internal matches
    return [m for m in out
            if {m.get("team_a_id"), m.get("team_b_id")} == {DHURANDHARS_ID, BAAZIGARS_ID}]


def winning_team(m):
    wid = str(m.get("winning_team_id") or "")
    if wid == str(DHURANDHARS_ID):
        return "dhurandars"
    if wid == str(BAAZIGARS_ID):
        return "bazigars"
    return None


def to_row(m):
    date = (m.get("match_start_time") or "")[:10]
    status = (m.get("status") or "").lower()
    wt = winning_team(m)
    if status == "upcoming":
        result = "upcoming"
    elif wt:
        result = "won"            # internal: one team "won" (super-over counts)
    else:
        result = "draw"
    return {
        "date": date,
        "venue": m.get("ground_name") or "Four Star Cricket Ground",
        "opponent": OPPONENT_LABEL,
        "match_type": "internal",
        "result": result,
        "winning_team": wt,
        "ch_match_id": str(m.get("match_id")),
    }


def main():
    dry = "--dry-run" in sys.argv
    print(f"\n🏏 SCC Internal Match Sync — {datetime.datetime.now():%Y-%m-%d %H:%M}"
          f"{'  (DRY RUN)' if dry else ''}")

    ch_matches = fetch_internal_matches()
    print(f"  CricHeroes internal matches: {len(ch_matches)}")

    existing = sb("GET", "matches",
                  params="select=id,date,result,winning_team,ch_match_id,match_type&match_type=eq.internal")
    by_chid = {e["ch_match_id"]: e for e in existing if e.get("ch_match_id")}
    by_date = {}
    for e in existing:
        by_date.setdefault(e["date"], e)

    inserted = updated = unchanged = 0
    for m in ch_matches:
        row = to_row(m)
        target = by_chid.get(row["ch_match_id"]) or by_date.get(row["date"])
        if target:
            # what would change?
            changes = {k: row[k] for k in ("result", "winning_team", "ch_match_id", "venue")
                       if str(target.get(k)) != str(row[k])}
            if not changes:
                unchanged += 1
                continue
            print(f"  ~ UPDATE {row['date']} ch={row['ch_match_id']} {row['result']}/{row['winning_team']}  changes={changes}")
            if not dry:
                sb("PATCH", "matches", body=changes, params=f"id=eq.{target['id']}")
            updated += 1
        else:
            print(f"  + INSERT {row['date']} ch={row['ch_match_id']} {row['result']}/{row['winning_team']}")
            if not dry:
                sb("POST", "matches", body=row)
            inserted += 1

    print(f"\n  Inserted: {inserted}  Updated: {updated}  Unchanged: {unchanged}")
    print("  ✅ Done." if not dry else "  (dry run — no writes)")


if __name__ == "__main__":
    main()
