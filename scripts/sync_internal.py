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

# CricHeroes player_id → SCC member UUID (for Man of the Match resolution).
# Keep in sync with CH_TO_SB in sync_cricheroes.py.
CH_TO_SB = {
    680643:"5d623102-766a-4243-83ef-2fb941ae96f3", 3855641:"7545cb6b-41fe-4102-b392-f560ae44805f",
    26474497:"329137e8-ea3d-4a68-94a3-718e24e610cb", 5447632:"8fc244d3-cbfb-4c9c-8c5b-efd47143d902",
    20844962:"b8c4f216-25f5-4e85-881c-4973ab4cb042", 1450076:"c800fdc4-92e0-4b58-832d-0672dff61a9c",
    4391800:"230629f4-cd80-4903-8b75-c485c75b2de7", 30975147:"35e097af-b2b0-468c-b0e0-6220de787cf4",
    26769238:"4fc80954-a105-4570-9c4a-88fac57b45be", 14518769:"69035791-1be6-4cab-8315-120eccefe44b",
    2793490:"c5e6cb6d-394d-4623-ab3d-c28705b77514", 36043018:"45a04053-f886-40a5-967c-f581d5b4ffeb",
    26733102:"01491044-fbf0-48db-ae71-561d153d28e6", 27853017:"3505303e-3288-49ef-b1cc-44285ecedbed",
    26218657:"055558d1-2999-44f5-881e-38d80ae4d92f", 3142063:"da957ad5-baa8-44b9-9dc6-56f2afa6e7ea",
    30974333:"35481bee-823f-4fbb-9f84-9c9a716c616e", 26805965:"8cfc8965-bb5b-4718-a2ba-d1ca202760a5",
    4842518:"6571e062-9ac5-414f-b0d6-12e53b680327", 16794243:"d9729561-fead-488c-9d8f-8a7b52c93567",
    16937743:"6ee157f3-e24c-4f1b-aad8-542145f5c828", 6100183:"2d43ae38-6a5d-4c88-841e-3ccc06a1671d",
    15337300:"f258b017-932e-4a63-b217-34410199a1a5", 30406057:"1c6cb1c4-f523-4b16-9997-0764190931fc",
    33275197:"6c00436e-cd4c-4c86-bc49-e0ba36179223", 26739447:"ef718518-322a-4cb6-a843-dba1bdc8fc1f",
    3954444:"1046e698-8d6e-4f14-8c2d-c7759764f02e", 14464945:"e412ba18-86c9-4896-ad06-f687b0bdc88c",
    4541847:"49439c54-f8bb-45af-81d0-d99a3875f214", 34079971:"afeea407-dd39-4894-ba6b-e7d81fad005e",
    26805068:"7c466077-bd02-4f23-ad4d-218bd8d70fff", 29767342:"3f98ee10-fa48-4c60-b4fb-f85ecc5af1d4",
    26769030:"04e8130d-78c4-44b7-a54e-e50c206941c6", 26869497:"09a4ec82-55fa-4ffd-915e-a2bfe71e8768",
    5536842:"1f68f840-b4ec-49a2-bcde-49d7fcf17dd0", 26769283:"9dcb188f-b007-4427-8114-86984c2c209f",
    26804704:"85762f91-6b6d-46fe-a6cf-9a2b38f07338", 32434601:"64d33e23-8e61-4406-b1c2-e540da9c9da5",
    42750501:"13972b5b-0423-42e2-9490-1ae2f892218c",
}

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


def team_score(m, team_id):
    """A team's score like '126/10 (16.0 Ov)' from the match feed, by team id."""
    summary = m.get("team_a_summary") if str(m.get("team_a_id")) == str(team_id) else \
              m.get("team_b_summary") if str(m.get("team_b_id")) == str(team_id) else None
    innings = m.get("team_a_innings") if str(m.get("team_a_id")) == str(team_id) else \
              m.get("team_b_innings") if str(m.get("team_b_id")) == str(team_id) else None
    if not summary:
        return None
    over = ""
    try:
        over = (innings[0].get("summary", {}) or {}).get("over", "") if innings else ""
    except Exception:
        over = ""
    return f"{summary} {over}".strip()


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
    row = {
        "date": date,
        "venue": m.get("ground_name") or "Four Star Cricket Ground",
        "opponent": OPPONENT_LABEL,
        "match_type": "internal",
        "result": result,
        "winning_team": wt,
        "ch_match_id": str(m.get("match_id")),
    }
    # Scores — Dhurandhars → our_score, Baazigars → opponent_score (matches the
    # "Dhurandars vs Bazigars" label order). Only once the match has been played.
    if result != "upcoming":
        dhur = team_score(m, DHURANDHARS_ID)
        baz = team_score(m, BAAZIGARS_ID)
        if dhur:
            row["our_score"] = dhur
        if baz:
            row["opponent_score"] = baz
        # Man of the Match from CricHeroes' player-of-the-match id
        pom = m.get("pom_player_id")
        try:
            mom_uid = CH_TO_SB.get(int(pom)) if pom else None
        except (ValueError, TypeError):
            mom_uid = None
        if mom_uid:
            row["man_of_match_id"] = mom_uid
    return row


def main():
    dry = "--dry-run" in sys.argv
    print(f"\n🏏 SCC Internal Match Sync — {datetime.datetime.now():%Y-%m-%d %H:%M}"
          f"{'  (DRY RUN)' if dry else ''}")

    ch_matches = fetch_internal_matches()
    print(f"  CricHeroes internal matches: {len(ch_matches)}")

    existing = sb("GET", "matches",
                  params="select=id,date,result,winning_team,ch_match_id,match_type,venue,our_score,opponent_score,man_of_match_id&match_type=eq.internal")
    by_chid = {e["ch_match_id"]: e for e in existing if e.get("ch_match_id")}
    by_date = {}
    for e in existing:
        by_date.setdefault(e["date"], e)

    inserted = updated = unchanged = 0
    for m in ch_matches:
        row = to_row(m)
        target = by_chid.get(row["ch_match_id"]) or by_date.get(row["date"])
        if target:
            # what would change? (only fields present in row)
            changes = {k: row[k] for k in ("result", "winning_team", "ch_match_id", "venue", "our_score", "opponent_score", "man_of_match_id")
                       if k in row and str(target.get(k)) != str(row[k])}
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
