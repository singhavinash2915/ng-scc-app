#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SCC League — captain vote audit (admin, terminal only)
#
#   ./scripts/league_votes.sh            # tally + who voted for whom + who hasn't
#   ./scripts/league_votes.sh tally      # just the tally
#   ./scripts/league_votes.sh ballots    # just who voted for whom
#   ./scripts/league_votes.sh pending    # just who hasn't voted
#
# Deliberately NOT in the app: the counts and the ballots stay out of every
# browser, including admins'. This is the one place they can be read.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

URL="https://zrrmpaatydhlkntfpcmw.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"
SEASON="${SEASON:-2026-27}"
WHAT="${1:-all}"

fetch() { curl -s "$URL/$1" -H "apikey: $KEY"; }

MEMBERS=$(fetch "members?select=id,name")
REGS=$(fetch "scc_league_registrations?select=member_id,status&season=eq.$SEASON")
VOTES=$(fetch "scc_league_captain_votes?select=voter_id,captain_id,created_at&season=eq.$SEASON&order=created_at")

MEMBERS="$MEMBERS" REGS="$REGS" VOTES="$VOTES" WHAT="$WHAT" SEASON="$SEASON" python3 <<'PY'
import json, os, collections

mem = {m['id']: m['name'].strip() for m in json.loads(os.environ['MEMBERS'])}
regs = json.loads(os.environ['REGS'])
votes = json.loads(os.environ['VOTES'])
what, season = os.environ['WHAT'], os.environ['SEASON']
name = lambda i: mem.get(i, '(unknown)')

ins = {r['member_id'] for r in regs if r['status'] == 'in'}
eligible = [v for v in votes if v['voter_id'] in ins]
ignored  = [v for v in votes if v['voter_id'] not in ins]

print(f"\n  SCC LEAGUE {season} — CAPTAIN VOTE\n  {'='*58}")

if what in ('all', 'tally'):
    print(f"\n  TALLY  ({len(eligible)} of {len(ins)} eligible players voted)\n")
    counts = collections.Counter(v['captain_id'] for v in eligible)
    for pos, (cid, n) in enumerate(sorted(counts.items(), key=lambda x: (-x[1], name(x[0]))), 1):
        bar = '█' * n
        print(f"   {pos:>2}. {name(cid):<28} {n:>2}  {bar}")
    tied = [n for n, c in collections.Counter(counts.values()).items() if c > 1]
    if tied:
        print(f"\n   ⚠️  tie(s) on {', '.join(str(t) for t in sorted(tied, reverse=True))} vote(s)"
              f" — rulebook: break by SCC Rankings rating, then coin toss")

if what in ('all', 'ballots'):
    print(f"\n  WHO VOTED FOR WHOM\n")
    print(f"   {'VOTER':<28} {'VOTED FOR':<28} WHEN")
    print(f"   {'-'*28} {'-'*28} ----------")
    for v in eligible:
        print(f"   {name(v['voter_id']):<28} {name(v['captain_id']):<28} {v['created_at'][:16].replace('T',' ')}")
    if ignored:
        print(f"\n   NOT COUNTED (voter is not registered IN):")
        for v in ignored:
            print(f"   {name(v['voter_id']):<28} {name(v['captain_id']):<28} {v['created_at'][:16].replace('T',' ')}")

if what in ('all', 'pending'):
    pending = sorted(ins - {v['voter_id'] for v in votes}, key=name)
    print(f"\n  NOT VOTED YET ({len(pending)})\n")
    for i, mid in enumerate(pending, 1):
        print(f"   {i:>2}. {name(mid)}")
    if not pending:
        print("   Everyone has voted 🎉")

print()
PY
