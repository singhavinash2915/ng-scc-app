#!/usr/bin/env python3
"""
SCC MahaSangram sync — CricHeroes → Supabase

Pulls the Brahmos vs Agni fixtures into `matches` as match_type='internal'.

Why a separate script from sync_internal.py: that one is hard-wired to the older
Dhurandhars/Baazigars teams, and the club wants both rivalries kept apart rather
than merged. Same reconciliation approach, different teams.

Reconciliation (idempotent, never deletes):
  1. row with this ch_match_id  → update
  2. else an internal row on the same date → backfill ch_match_id
  3. else insert

Scores map Brahmos → our_score, Agni → opponent_score, matching how the internal
rivalry is stored elsewhere. `winning_team` is deliberately left alone: the
column only accepts the old dhurandars/bazigars values, so writing to it would
fail until that migration is run.

Usage:
  python3 scripts/sync_mahasangram.py --dry-run
  python3 scripts/sync_mahasangram.py
"""
import argparse
import gzip
import json
import sys
import urllib.error
import urllib.request

# Same credentials the other CricHeroes syncs use. Without api-key/authorization
# the team feed answers 200 with a null body rather than an error, which reads
# as "no fixtures" instead of "not authenticated" — worth knowing.
CH_API_KEY = "cr!CkH3r0s"
CH_AUTH = "db1df8c0-35c5-11f1-acbe-2f500bd24aef"
CH_UDID = "3833274f1b23ae81b995ebfdfb7f948b"
CH_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# From the tournament's own fixture feed — see MAHASANGRAM in src/config/season2.ts
TOURNAMENT_ID = 2154934
BRAHMOS_ID = 14361049
AGNI_ID = 14361070
VENUE_FALLBACK = "Four Star Cricket Ground"

SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1w"
    "YWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4"
    "Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"
)


def ch_get(url):
    req = urllib.request.Request(url, headers={
        "api-key": CH_API_KEY, "authorization": CH_AUTH, "udid": CH_UDID,
        "device-type": "Chrome: 146.0.0.0", "accept": "application/json",
        "origin": "https://cricheroes.com", "referer": "https://cricheroes.com/",
        "user-agent": CH_UA, "accept-encoding": "gzip",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        if r.headers.get("content-encoding") == "gzip":
            data = gzip.decompress(data)
        return json.loads(data)


def sb(method, path, body=None, prefer=None):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase {e.code} on {method} {path}: {e.read().decode()[:300]}")


def fixtures():
    """Every MahaSangram match, read off the Agni team feed (covers both sides)."""
    url = (f"https://api.cricheroes.in/api/v1/team/get-team-match/{AGNI_ID}"
           f"?pagesize=100&matchType=all&page=1")
    rows = ch_get(url).get("data") or []
    keep = []
    for r in rows:
        ids = {r.get("team_a_id"), r.get("team_b_id")}
        if ids == {BRAHMOS_ID, AGNI_ID} or r.get("tournament_id") == TOURNAMENT_ID:
            keep.append(r)
    return keep


def to_row(r):
    """One CricHeroes fixture → the columns `matches` actually has."""
    start = (r.get("match_start_time") or "")[:10]
    a_is_brahmos = r.get("team_a_id") == BRAHMOS_ID
    us = r.get("team_a_summary") if a_is_brahmos else r.get("team_b_summary")
    them = r.get("team_b_summary") if a_is_brahmos else r.get("team_a_summary")
    status = (r.get("status") or "").lower()

    row = {
        "date": start,
        "opponent": "SCC Brahmos vs SCC Agni",
        "venue": r.get("ground_name") or VENUE_FALLBACK,
        "match_type": "internal",
        "ch_match_id": str(r.get("match_id")),
        "result": "upcoming" if status == "upcoming" else "draw",
    }
    if status != "upcoming":
        # A completed game: record both innings as they stand.
        row["our_score"] = us or None
        row["opponent_score"] = them or None
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    found = fixtures()
    print(f"CricHeroes: {len(found)} MahaSangram fixture(s)\n")
    if not found:
        print("Nothing to sync — no Brahmos vs Agni matches published yet.")
        return

    existing = sb("GET", "matches?select=id,date,ch_match_id,match_type&match_type=eq.internal")
    by_chid = {m["ch_match_id"]: m for m in existing if m.get("ch_match_id")}
    by_date = {m["date"]: m for m in existing}

    for r in found:
        row = to_row(r)
        chid, date = row["ch_match_id"], row["date"]
        hit = by_chid.get(chid) or by_date.get(date)
        verb = "update" if hit else "INSERT"
        print(f"  {verb:<6} {date}  {row['result']:<8} ch={chid}  {row['venue']}")
        if args.dry_run:
            continue
        if hit:
            sb("PATCH", f"matches?id=eq.{hit['id']}", row)
        else:
            sb("POST", "matches", row)

    print("\n" + ("dry run — nothing written" if args.dry_run else "done"))


if __name__ == "__main__":
    main()
