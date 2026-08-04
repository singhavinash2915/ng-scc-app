#!/usr/bin/env python3
"""
SCC League — mock auction drill.

Runs a full auction against the REAL registered squad and REAL graded base
prices, using exactly the rules the app enforces:

  * ₹25 Cr purse per team, 13-player squads (captain + 12 bought)
  * bid steps: +₹5L below ₹1 Cr, +₹10L at ₹1 Cr and above
  * a captain may never bid away the money needed to fill their remaining
    slots at ₹20L each
  * players come up Marquee -> A -> B -> C, shuffled within each set

Two simple bot captains bid against each other so you can see how the squads
actually come out and whether the money runs out at the right time.

    python3 scripts/mock_auction.py            # one drill
    python3 scripts/mock_auction.py 200        # 200 drills, summary stats
"""
import json, random, sys, urllib.request
from collections import Counter

URL = "https://zrrmpaatydhlkntfpcmw.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRo"
       "bGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30."
       "kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg")
SEASON = "2026-27"

PURSE      = 2500   # ₹ lakh
SQUAD      = 13     # captain + 12
STEP_SMALL = 5
STEP_BIG   = 10
FLOOR      = 20     # Grade C base — the cheapest a slot can be filled for


def get(path):
    req = urllib.request.Request(f"{URL}/{path}", headers={"apikey": KEY})
    return json.load(urllib.request.urlopen(req))


def money(lakh):
    if lakh >= 100:
        cr = lakh / 100
        return f"₹{cr:g} Cr"
    return f"₹{lakh} L"


def max_bid(team):
    """Budget minus what must be reserved to fill the remaining slots."""
    slots_left = max(0, SQUAD - 1 - len(team["squad"]))
    return team["purse"] - max(0, slots_left - 1) * FLOOR


def run(players, captains, verbose):
    teams = {
        k: {"name": n, "captain": c, "purse": PURSE, "squad": []}
        for k, (n, c) in captains.items()
    }

    # Marquee first, shuffled inside each grade.
    pool = sorted(players, key=lambda p: (-p["base"], random.random()))
    unsold = []

    for p in pool:
        bid, holder = p["base"], None
        # Each captain wants a player up to a private valuation: the base price
        # times an appetite that runs hotter for the better grades.
        want = {k: p["base"] * random.uniform(1.0, 3.2) for k in teams}
        while True:
            movers = [
                k for k in teams
                if k != holder
                and bid + (STEP_BIG if bid >= 100 else STEP_SMALL) <= max_bid(teams[k])
                and bid + (STEP_BIG if bid >= 100 else STEP_SMALL) <= want[k]
                and len(teams[k]["squad"]) < SQUAD - 1
            ]
            if not movers:
                break
            k = random.choice(movers)
            bid += STEP_BIG if bid >= 100 else STEP_SMALL
            holder = k

        if holder:
            teams[holder]["purse"] -= bid
            teams[holder]["squad"].append((p["name"], bid, p["base"]))
            if verbose:
                print(f"   {p['name']:<26} {money(p['base']):>7} → {money(bid):>8}  {teams[holder]['name']}")
        else:
            unsold.append(p)
            if verbose:
                print(f"   {p['name']:<26} {money(p['base']):>7}    UNSOLD")

    return teams, unsold


def main():
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    mem = {m["id"]: m["name"].strip() for m in get("members?select=id,name")}
    regs = [r for r in get(f"scc_league_registrations?select=*&season=eq.{SEASON}")
            if r["status"] == "in"]

    # Captains: the two who won the election.
    votes = get(f"scc_league_captain_votes?select=voter_id,captain_id&season=eq.{SEASON}")
    ins = {r["member_id"] for r in regs}
    tally = Counter(v["captain_id"] for v in votes if v["voter_id"] in ins and v["captain_id"])
    top2 = [cid for cid, _ in tally.most_common(2)]
    captains = {
        "team1": ("Team 1", top2[0]),
        "team2": ("Team 2", top2[1]),
    }

    players = [
        {"name": mem.get(r["member_id"], "?"), "base": r["base_price"] or FLOOR}
        for r in regs if r["member_id"] not in top2
    ]

    print(f"\n  SCC LEAGUE — MOCK AUCTION DRILL")
    print("  " + "=" * 62)
    print(f"  {len(players)} players · purse {money(PURSE)}/team · squads of {SQUAD}")
    print(f"  Captains: {mem.get(top2[0])}  vs  {mem.get(top2[1])}")
    grades = Counter(p["base"] for p in players)
    print("  Pool: " + " · ".join(f"{money(b)} x{n}" for b, n in sorted(grades.items(), reverse=True)))

    if runs == 1:
        print(f"\n  THE AUCTION\n")
        teams, unsold = run(players, captains, verbose=True)

        print(f"\n  FINAL SQUADS\n")
        for k, t in teams.items():
            spent = PURSE - t["purse"]
            print(f"   {t['name']}  —  {len(t['squad'])+1}/{SQUAD} players · "
                  f"spent {money(spent)} · {money(t['purse'])} left")
            print(f"     👑 {mem.get(t['captain']):<26} (captain)")
            for n, price, base in sorted(t["squad"], key=lambda x: -x[1]):
                mult = price / base
                print(f"        {n:<26} {money(price):>8}   {mult:.1f}x base")
            print()
        if unsold:
            print(f"   UNSOLD ({len(unsold)}): " + ", ".join(p["name"] for p in unsold))
        return

    # Many runs — is the format healthy, or does it break?
    print(f"\n  {runs} DRILLS\n")
    full, left, top_prices, unsold_n = 0, [], [], []
    for _ in range(runs):
        teams, unsold = run(players, captains, verbose=False)
        if all(len(t["squad"]) == SQUAD - 1 for t in teams.values()):
            full += 1
        for t in teams.values():
            left.append(t["purse"])
            if t["squad"]:
                top_prices.append(max(s[1] for s in t["squad"]))
        unsold_n.append(len(unsold))

    avg = lambda xs: sum(xs) / len(xs)
    print(f"   both squads filled : {full}/{runs}  ({100*full//runs}%)")
    print(f"   purse left over    : {money(round(avg(left)))} avg   (min {money(min(left))}, max {money(max(left))})")
    print(f"   top price paid     : {money(round(avg(top_prices)))} avg  (max {money(max(top_prices))})")
    print(f"   unsold players     : {avg(unsold_n):.1f} avg")
    print()


if __name__ == "__main__":
    main()
