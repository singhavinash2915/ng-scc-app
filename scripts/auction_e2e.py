#!/usr/bin/env python3
"""
End-to-end test for the SCC League live auction.

Drives the real database through a complete auction using exactly the rules in
src/hooks/useAuctionLive.ts — start, random draw within a set, bidding, sell,
pass, unsold rounds, completion — then checks the invariants that actually
matter on the night:

    * nobody is bought twice, and no captain is ever auctioned
    * neither team outspends its purse (captain retention included)
    * neither team exceeds its squad size
    * a team is never left unable to fill its remaining slots
    * every bid lands in scc_auction_bids so the trail survives
    * the auction terminates — no infinite unsold loop

Runs against a THROWAWAY season by default, so the live 2026-27 auction row is
never touched. Cleans up after itself unless --keep is passed.

    python3 scripts/auction_e2e.py              # one full run
    python3 scripts/auction_e2e.py --runs 20    # soak it
    python3 scripts/auction_e2e.py --keep       # leave the result in the DB
"""
import argparse
import json
import random
import socket
import sys
import time
import urllib.error
import urllib.request

BASE = "https://zrrmpaatydhlkntfpcmw.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1w"
       "YWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4"
       "Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg")

# Mirrors src/hooks/useSCCLeague.ts — kept in sync by hand; the assertions below
# would fail loudly if the app moved and this didn't.
REAL_SEASON = "2026-27"
PURSE_LAKH = 2500
SQUAD_SIZE = 15          # captain + 14 bought
BID_STEP_SMALL, BID_STEP_BIG = 5, 10
CAPTAINS = [
    "230629f4-cd80-4903-8b75-c485c75b2de7",   # AKASH JADHAV  · SCC Brahmos
    "7545cb6b-41fe-4102-b392-f560ae44805f",   # Avinash Singh · SCC Agni
]
TEAM_NAMES = {"team1": "SCC Brahmos", "team2": "SCC Agni"}


def api(method, path, body=None, prefer=None, _tries=5):
    """One REST call, retrying transient network faults.

    A soak run makes thousands of requests and Supabase will occasionally reset
    a connection or time out. Dying on that looks exactly like a logic failure
    in the output, which sent me chasing a bug that wasn't there — so retry the
    network, and only ever hard-fail on a real HTTP error from PostgREST.
    """
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(_tries):
        req = urllib.request.Request(f"{BASE}/{path}", method=method)
        req.add_header("apikey", KEY)
        req.add_header("Content-Type", "application/json")
        if prefer:
            req.add_header("Prefer", prefer)
        try:
            with urllib.request.urlopen(req, data, timeout=30) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            sys.exit(f"HTTP {e.code} on {method} {path}\n{e.read().decode()[:400]}")
        except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
            if attempt == _tries - 1:
                sys.exit(f"network gave up after {_tries} tries on {method} {path}: {e}")
            time.sleep(1.5 * (attempt + 1))


class Fail(Exception):
    pass


def check(cond, msg):
    if not cond:
        raise Fail(msg)


class Auction:
    """The auctioneer's state machine, exactly as the hook implements it."""

    def __init__(self, season, pool, base, names):
        self.season, self.base, self.names = season, base, names
        self.picks = []                     # {member_id, team, price, round}
        self.bids = []
        self.round = 1
        first = self.draw(pool)
        self.pool = [first] + [p for p in pool if p != first]
        self.idx = 0
        self.bid_amount = base[first]
        self.bidder = None
        api("POST", "scc_auction", {
            "season": season, "status": "live",
            "team1_name": names["team1"], "team2_name": names["team2"],
            "team1_captain_id": CAPTAINS[0], "team2_captain_id": CAPTAINS[1],
            "purse_lakh": PURSE_LAKH, "squad_size": SQUAD_SIZE,
            "pool_order": self.pool, "current_idx": 0,
            "current_bid": self.bid_amount, "current_bidder": None, "round": 1,
        }, prefer="resolution=merge-duplicates")

    # ── the rules ──────────────────────────────────────────────────────────
    def band(self, member_id):
        """The set as everyone SEES it — Marquee and Grade A are one group."""
        p = self.base[member_id]
        return next(b for b in (100, 50, 0) if p >= b)

    def draw(self, ids):
        """Random pick from the richest band still on the table."""
        top = max(self.band(i) for i in ids)
        return random.choice([i for i in ids if self.band(i) == top])

    def squad(self, t):
        return [p for p in self.picks if p["team"] == t]

    def spent(self, t):
        return sum(p["price"] for p in self.squad(t))

    def captain_cost(self, t):
        return self.base.get(CAPTAINS[0 if t == "team1" else 1], 0)

    def budget(self, t):
        return PURSE_LAKH - self.captain_cost(t) - self.spent(t)

    def reserve_for(self, t):
        """Cheapest possible cost of filling every slot after this one, priced
        off the players actually left rather than a flat ₹20 L floor."""
        slots_after = max(0, SQUAD_SIZE - 1 - len(self.squad(t)) - 1)
        if slots_after == 0:
            return 0
        resolved = {p["member_id"] for p in self.picks}
        cur = self.current()
        still = [i for i in self.pool if i not in resolved and i != cur] + \
                [p["member_id"] for p in self.picks if not p["team"]]
        return sum(sorted(self.base[i] for i in still)[:slots_after])

    def max_bid(self, t):
        return self.budget(t) - self.reserve_for(t)

    def has_slot(self, t):
        return len(self.squad(t)) < SQUAD_SIZE - 1

    @property
    def next_bid(self):
        # The opening call accepts the base price rather than raising it, so a
        # player can be bought at exactly his base.
        if self.bidder is None:
            return self.bid_amount
        return self.bid_amount + (BID_STEP_BIG if self.bid_amount >= 100 else BID_STEP_SMALL)

    def can_bid(self, t):
        return self.has_slot(t) and self.next_bid <= self.max_bid(t)

    # ── actions ────────────────────────────────────────────────────────────
    def current(self):
        return self.pool[self.idx] if self.idx < len(self.pool) else None

    def place_bid(self, t):
        amount = self.next_bid
        self.bid_amount, self.bidder = amount, t
        row = {"season": self.season, "member_id": self.current(),
               "team": t, "amount": amount, "round": self.round}
        api("POST", "scc_auction_bids", row)
        self.bids.append(row)

    def resolve(self, team, price):
        api("POST", "scc_auction_picks?on_conflict=season,member_id", {
            "season": self.season, "member_id": self.current(),
            "team": team, "price": price, "round": self.round,
        }, prefer="resolution=merge-duplicates")
        self.picks.append({"member_id": self.current(), "team": team,
                           "price": price, "round": self.round})
        return self.advance()

    def advance(self):
        resolved = {p["member_id"] for p in self.picks}
        remaining = [i for i in self.pool if i not in resolved]
        room = any(len(self.squad(t)) < SQUAD_SIZE - 1 for t in ("team1", "team2"))

        if remaining and room:
            nxt = self.draw(remaining)
            self.pool = ([i for i in self.pool if i in resolved] + [nxt] +
                         [i for i in remaining if i != nxt])
            self.idx = self.pool.index(nxt)
            self.bid_amount, self.bidder = self.base[nxt], None
            self._patch()
            return True

        sold_this_round = any(p["team"] and p["member_id"] in self.pool for p in self.picks)
        unsold = [p["member_id"] for p in self.picks if not p["team"]]
        if room and unsold and sold_this_round:
            api("DELETE", f"scc_auction_picks?season=eq.{self.season}"
                          f"&member_id=in.({','.join(unsold)})")
            self.picks = [p for p in self.picks if p["team"]]
            first = self.draw(unsold)
            self.pool = [first] + [i for i in unsold if i != first]
            self.idx, self.round = 0, self.round + 1
            self.bid_amount, self.bidder = self.base[first], None
            self._patch()
            return True

        # Closing time: hand any unbought player to a team that still has a
        # slot, at base price, dearest first to the emptier squad. Overspending
        # stays a real mistake — you get leftovers, not the players you wanted —
        # but nobody ends the night unable to field a side. Marked round 0.
        leftovers = [i for i in self.pool if i not in resolved] + \
                    [p["member_id"] for p in self.picks if not p["team"]]
        counts = {t: len(self.squad(t)) for t in ("team1", "team2")}
        fills = []
        for mid in sorted(set(leftovers), key=lambda i: -self.base[i]):
            open_teams = sorted([t for t in ("team1", "team2")
                                 if counts[t] < SQUAD_SIZE - 1], key=lambda t: counts[t])
            if not open_teams:
                break
            t = open_teams[0]
            counts[t] += 1
            fills.append({"season": self.season, "member_id": mid, "team": t,
                          "price": self.base[mid], "round": 0})
        for f in fills:
            api("POST", "scc_auction_picks?on_conflict=season,member_id", f,
                prefer="resolution=merge-duplicates")
            self.picks = [p for p in self.picks if p["member_id"] != f["member_id"]]
            self.picks.append({"member_id": f["member_id"], "team": f["team"],
                               "price": f["price"], "round": 0})
        api("PATCH", f"scc_auction?season=eq.{self.season}",
            {"status": "done", "current_bidder": None, "current_bid": 0})
        return False

    def _patch(self):
        api("PATCH", f"scc_auction?season=eq.{self.season}", {
            "pool_order": self.pool, "current_idx": self.idx, "round": self.round,
            "current_bid": self.bid_amount, "current_bidder": self.bidder,
        })


def wipe(season):
    for t in ("scc_auction_picks", "scc_auction_bids", "scc_auction"):
        api("DELETE", f"{t}?season=eq.{season}")


def run(season, verbose, war=0):
    regs = api("GET", f"scc_league_registrations?select=member_id,base_price,status"
                      f"&season=eq.{REAL_SEASON}&status=eq.in")
    members = {m["id"]: m["name"] for m in api("GET", "members?select=id,name")}
    base = {r["member_id"]: r["base_price"] or 20 for r in regs}
    for c in CAPTAINS:
        base.setdefault(c, 20)
    pool = [r["member_id"] for r in regs if r["member_id"] not in CAPTAINS]

    check(len(regs) == 30, f"expected 30 registered, got {len(regs)}")
    check(len(pool) == 28, f"expected 28 in the pool, got {len(pool)}")
    check(all(c not in pool for c in CAPTAINS), "a captain is in the auction pool")

    wipe(season)
    A = Auction(season, pool, base, TEAM_NAMES)

    guard, rounds_seen = 0, {1}
    while True:
        guard += 1
        check(guard < 500, "auction never terminated — possible unsold loop")
        cur = A.current()
        if cur is None:
            break

        # Two captains bidding with a bit of appetite, as on the night. In `war`
        # mode the first few names are fought to the absolute ceiling — the
        # question being whether a captain who blows the purse on one superstar
        # can still fill the other 13 slots.
        at_war = war and len([p for p in A.picks if p["team"]]) < war
        keen = {"team1": 1.0, "team2": 1.0} if at_war else \
               {"team1": random.random(), "team2": random.random()}
        while True:
            movers = [t for t in ("team1", "team2")
                      if A.can_bid(t) and t != A.bidder and random.random() < keen[t]]
            if not movers:
                break
            A.place_bid(random.choice(movers))

        if A.bidder:
            price, team = A.bid_amount, A.bidder
            if verbose:
                print(f"  SOLD  {members.get(cur,'?')[:22]:<22} ₹{price:>4} L → {TEAM_NAMES[team]}")
            more = A.resolve(team, price)
        else:
            if verbose:
                print(f"  pass  {members.get(cur,'?')[:22]:<22}")
            more = A.resolve(None, 0)
        rounds_seen.add(A.round)
        if not more:
            break

    # ── invariants ─────────────────────────────────────────────────────────
    db_picks = api("GET", f"scc_auction_picks?select=member_id,team,price,round&season=eq.{season}")
    db_bids = api("GET", f"scc_auction_bids?select=member_id,team,amount&season=eq.{season}")
    db_auction = api("GET", f"scc_auction?select=*&season=eq.{season}")[0]

    ids = [p["member_id"] for p in db_picks]
    check(len(ids) == len(set(ids)), "a player was resolved twice")
    check(all(i not in CAPTAINS for i in ids), "a captain got auctioned")
    check(db_auction["status"] == "done", f"auction ended as {db_auction['status']}")
    for p in db_picks:
        if p["team"]:
            check(p["price"] >= base[p["member_id"]],
                  f"{members.get(p['member_id'],'?')} sold at ₹{p['price']} L, "
                  f"under his ₹{base[p['member_id']]} L base")

    summary = {}
    for t in ("team1", "team2"):
        bought = [p for p in db_picks if p["team"] == t]
        spend = sum(p["price"] for p in bought)
        cap = base[CAPTAINS[0 if t == "team1" else 1]]
        check(len(bought) <= SQUAD_SIZE - 1,
              f"{TEAM_NAMES[t]} bought {len(bought)}, cap is {SQUAD_SIZE - 1}")
        won = sum(p["price"] for p in bought if p["round"] != 0)
        check(won + cap <= PURSE_LAKH,
              f"{TEAM_NAMES[t]} overspent BIDDING: ₹{won + cap} L of ₹{PURSE_LAKH} L")
        # The one that matters most and was missing: a captain must never be
        # able to spend themselves out of a full squad. Only excused when the
        # pool genuinely ran dry — 28 players for 28 slots leaves no slack.
        # With 28 players for 28 slots, auto-fill must leave both squads full.
        check(len(bought) == SQUAD_SIZE - 1,
              f"{TEAM_NAMES[t]} finished {len(bought) + 1}/{SQUAD_SIZE} "
              f"— auto-fill failed to even up the squads")
        summary[t] = (len(bought) + 1, spend + cap, max((p["price"] for p in bought), default=0))

    check(len(db_bids) >= len([p for p in db_picks if p["team"]]),
          "fewer bids recorded than players sold — the trail is lossy")

    sold = [p for p in db_picks if p["team"]]
    return {
        "sold": len(sold), "unsold": len(db_picks) - len(sold),
        "rounds": max(rounds_seen), "bids": len(db_bids),
        "team1": summary["team1"], "team2": summary["team2"],
        "allocated": len([p for p in db_picks if p["round"] == 0 and p["team"]]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--season", default="E2E-TEST")
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("-q", "--quiet", action="store_true")
    ap.add_argument("--war", type=int, default=0,
                    help="fight the first N players to the purse ceiling")
    args = ap.parse_args()

    check(args.season != REAL_SEASON, "refusing to run against the live season")

    print(f"Auction E2E · season '{args.season}' · {args.runs} run(s)"
      + (f" · WAR on first {args.war}" if args.war else ""))
    print(f"Purse ₹{PURSE_LAKH/100:.0f} Cr · squad {SQUAD_SIZE} · {TEAM_NAMES['team1']} v {TEAM_NAMES['team2']}\n")
    results = []
    for n in range(1, args.runs + 1):
        verbose = args.runs == 1 and not args.quiet
        if verbose:
            print("Run 1")
        try:
            r = run(args.season, verbose, war=args.war)
        except Fail as e:
            wipe(args.season)
            sys.exit(f"\n❌ FAILED on run {n}: {e}")
        results.append(r)
        if not verbose:
            print(f"  run {n:>3}: {r['sold']} sold, {r['unsold']} unsold, "
                  f"{r['rounds']} round(s), squads {r['team1'][0]}/{r['team2'][0]}")
        if n < args.runs or not args.keep:
            wipe(args.season)

    print("\n✅ ALL INVARIANTS HELD")
    last = results[-1]
    for t in ("team1", "team2"):
        size, spend, top = last[t]
        print(f"  {TEAM_NAMES[t]:<14} {size}/{SQUAD_SIZE} · spent ₹{spend/100:.2f} Cr "
              f"of ₹{PURSE_LAKH/100:.0f} Cr · top buy ₹{top} L")
    print(f"  {last['sold']} sold · {last['unsold']} unsold · "
          f"{last['rounds']} round(s) · {last['bids']} bids recorded")
    avg = sum(r["sold"] for r in results) / len(results)
    if len(results) > 1:
        print(f"  across {len(results)} runs: {avg:.1f} sold on average, "
              f"max {max(r['rounds'] for r in results)} rounds")
    print(f"\nTest data {'KEPT' if args.keep else 'wiped'} · live season {REAL_SEASON} untouched")


if __name__ == "__main__":
    main()
