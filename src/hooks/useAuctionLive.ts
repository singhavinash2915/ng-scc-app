import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { bidStepFor, PURSE_LAKH, bandForPrice } from './useSCCLeague';

// ─── Live auction ──────────────────────────────────────────────────────────────
// All state lives in the database so every member watching sees the same thing.
// The admin writes; everyone polls. Polling (not realtime) on purpose — it needs
// no channel setup, survives flaky phone networks, and 2s is plenty for an
// auction where a human is calling the bids anyway.

export type TeamKey = 'team1' | 'team2';

export interface AuctionRow {
  season: string;
  status: 'setup' | 'live' | 'done';
  team1_name: string;
  team2_name: string;
  team1_captain_id: string | null;
  team2_captain_id: string | null;
  purse_lakh: number;
  squad_size: number;
  pool_order: string[];
  current_idx: number;
  current_bid: number;
  current_bidder: TeamKey | null;
  round?: number;
}

export interface Bid {
  id: number;
  member_id: string;
  team: TeamKey;
  amount: number;
  round: number;
  created_at: string;
}

export interface Pick {
  id: string;
  member_id: string;
  team: TeamKey | null;
  price: number;
  round: number;
  created_at: string;
}

const POLL_MS = 2000;

const isMissing = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(e.message));

export function useAuctionLive(
  season: string,
  opts: { live?: boolean; basePriceOf?: (id: string) => number } = {},
) {
  const { live = true, basePriceOf } = opts;
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const busy = useRef(false);

  const fetchAll = useCallback(async () => {
    // Never let a slow poll stack up behind another one.
    if (busy.current) return;
    busy.current = true;
    const [aRes, pRes, bRes] = await Promise.all([
      supabase.from('scc_auction').select('*').eq('season', season).maybeSingle(),
      supabase.from('scc_auction_picks').select('*').eq('season', season).order('created_at'),
      supabase.from('scc_auction_bids').select('*').eq('season', season).order('id'),
    ]);
    busy.current = false;
    setBids(bRes.error ? [] : ((bRes.data as Bid[]) ?? []));
    if (isMissing(aRes.error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);
    setAuction((aRes.data as AuctionRow) ?? null);
    setPicks((pRes.data as Pick[]) ?? []);
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(fetchAll, POLL_MS);
    return () => window.clearInterval(id);
  }, [live, fetchAll]);

  // ── Derived ────────────────────────────────────────────────────────────
  const sold = useMemo(() => picks.filter(p => p.team), [picks]);
  /** Handed out at the close to even up the squads, not won at auction. */
  const allocated = useMemo(() => picks.filter(p => p.team && p.round === 0), [picks]);
  const unsold = useMemo(() => picks.filter(p => !p.team), [picks]);

  const spent = useCallback(
    (t: TeamKey) => sold.filter(p => p.team === t).reduce((n, p) => n + p.price, 0),
    [sold],
  );
  const squad = useCallback(
    (t: TeamKey) => sold.filter(p => p.team === t),
    [sold],
  );

  const purse = auction?.purse_lakh ?? PURSE_LAKH;
  const size = auction?.squad_size ?? 13;

  /** What the captain costs their own team, deducted before a single bid. */
  const captainCost = useCallback((t: TeamKey) => {
    const id = t === 'team1' ? auction?.team1_captain_id : auction?.team2_captain_id;
    return id && basePriceOf ? basePriceOf(id) : 0;
  }, [auction, basePriceOf]);

  const budget = useCallback(
    (t: TeamKey) => purse - captainCost(t) - spent(t),
    [purse, captainCost, spent],
  );

  const currentMemberId = auction?.pool_order?.[auction.current_idx] ?? null;

  /**
   * The cheapest it can possibly cost to fill every slot AFTER the one being
   * bid on right now — priced off the players genuinely still available, not a
   * flat floor.
   *
   * This used to reserve ₹20 L a slot, on the assumption that a Grade C name
   * would always still be on the table. It isn't true late on, and a captain
   * who won a bidding war paid for it: a test where both sides fought the first
   * player to the ceiling left the winner with SEVEN players out of fifteen and
   * eight names unsold, because every remaining player's base was above what
   * the flat reserve had kept back. Reserving the real prices means a captain
   * can still go big — they simply can't bid past the point where the squad
   * stops being fillable.
   */
  const reserveFor = useCallback((t: TeamKey) => {
    const slotsAfterThis = Math.max(0, size - 1 - squad(t).length - 1);
    if (slotsAfterThis === 0) return 0;
    const resolvedIds = new Set(picks.map(p => p.member_id));
    const stillAvailable = [
      // Yet to come up this round…
      ...(auction?.pool_order ?? []).filter(
        id => !resolvedIds.has(id) && id !== currentMemberId),
      // …plus everyone passed over, who returns in the next unsold round.
      ...picks.filter(p => !p.team).map(p => p.member_id),
    ];
    const cheapest = stillAvailable
      .map(id => basePriceOf?.(id) ?? 20)
      .sort((a, b) => a - b)
      .slice(0, slotsAfterThis);
    return cheapest.reduce((n, p) => n + p, 0);
  }, [size, squad, picks, auction, currentMemberId, basePriceOf]);

  /**
   * A captain may not bid away the money needed to fill their remaining slots.
   */
  const maxBid = useCallback(
    (t: TeamKey) => budget(t) - reserveFor(t),
    [budget, reserveFor],
  );
  const bidStep = bidStepFor(auction?.current_bid ?? 0);
  /**
   * The FIRST bid is the base price itself, as in a real auction — the
   * auctioneer opens at base and a raised hand accepts it. Previously the
   * opening bid was base + one step, so a player could never be sold at his
   * base price at all, and the cheapest possible buy was ₹25 L on a ₹20 L man.
   */
  const opening = !auction?.current_bidder;
  const nextBid = opening
    ? (auction?.current_bid ?? 0)
    : (auction?.current_bid ?? 0) + bidStep;
  /** A full squad cannot bid. maxBid alone doesn't stop it: once the last slot
   *  is filled slotsLeft hits 0, so the reserve falls away and the whole
   *  remaining purse looks spendable — a team ended a test run 14/13. */
  const hasSlot = useCallback((t: TeamKey) => squad(t).length < size - 1, [squad, size]);
  const canBid = useCallback(
    (t: TeamKey) => hasSlot(t) && nextBid <= maxBid(t),
    [hasSlot, nextBid, maxBid],
  );

  // ── Admin actions ──────────────────────────────────────────────────────
  const patch = useCallback(async (fields: Partial<AuctionRow>) => {
    const body = { ...fields, updated_at: new Date().toISOString() };
    let { error } = await supabase.from('scc_auction').update(body).eq('season', season);
    // add_scc_auction_rounds.sql not run yet? Everything except the round
    // counter still works, so drop it rather than losing the whole update.
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /round/.test(error.message))) {
      const { round: _drop, ...rest } = body as Record<string, unknown>;
      void _drop;
      ({ error } = await supabase.from('scc_auction').update(rest).eq('season', season));
    }
    if (!error) await fetchAll();
    return error?.message ?? null;
  }, [season, fetchAll]);

  const bid = useCallback(async (team: TeamKey) => {
    if (!auction || !canBid(team)) return;
    // Optimistic: the room should see the number jump the instant it's called.
    setAuction(a => a && ({ ...a, current_bid: nextBid, current_bidder: team }));
    const memberId = auction.pool_order[auction.current_idx];
    await Promise.all([
      patch({ current_bid: nextBid, current_bidder: team }),
      // The trail can only be captured live — nothing can rebuild it later.
      // Failing silently is deliberate: a missing history row must never stop
      // the auctioneer taking the next bid.
      memberId
        ? supabase.from('scc_auction_bids').insert({
            season, member_id: memberId, team, amount: nextBid,
            round: auction.round ?? 1,
          })
        : Promise.resolve(),
    ]);
  }, [auction, canBid, nextBid, patch, season]);

  /** Every bid for one player, newest first — the IPL-style auction trail. */
  const trailFor = useCallback(
    (memberId: string) => bids.filter(b => b.member_id === memberId).slice().reverse(),
    [bids],
  );

  const round = auction?.round ?? 1;

  /**
   * Draw the next name. Rather than following a fixed list, the auctioneer pulls
   * a RANDOM player from the richest set still on the table — Marquee first,
   * then A, B, C — so nobody knows who is coming up next even within a set.
   */
  const drawFrom = useCallback((ids: string[], priceOf: (id: string) => number) => {
    if (ids.length === 0) return null;
    // Group by the DISPLAY band, not the raw base price. Everyone sees Marquee
    // and Grade A merged into one SCC Icons set, but drawing on exact price
    // made both ₹2 Cr names come up before all five ₹1 Cr ones, every time —
    // which looks like the auctioneer is simply reading down the list.
    const band = (id: string) => bandForPrice(priceOf(id)).minPrice;
    const top = Math.max(...ids.map(band));
    const inSet = ids.filter(id => band(id) === top);
    return inSet[Math.floor(Math.random() * inSet.length)];
  }, []);

  /**
   * Move to the next name.
   *
   * `justResolved` is the player sell()/passOver() has this moment written to
   * the database. It has to be passed in: `picks` is the state from the last
   * render, so it does NOT yet contain them, and without this they stay in
   * `remaining` and can be drawn straight back onto the block at their base
   * price. That is the "I had to click SOLD two or three times, and the bid
   * dropped back to base" bug — the sale had gone through every time.
   */
  const advance = useCallback(async (
    priceOf: (id: string) => number,
    justResolved?: { member_id: string; team: TeamKey | null },
  ) => {
    if (!auction) return;
    // Everything decided so far, INCLUDING the sale that just happened.
    const resolved = justResolved
      ? [...picks.filter(p => p.member_id !== justResolved.member_id),
         { ...justResolved, id: '', price: 0, round, created_at: '' } as Pick]
      : picks;
    const resolvedIds = new Set(resolved.map(p => p.member_id));
    // Anyone in this round's pool who hasn't been resolved yet.
    const remaining = auction.pool_order.filter(id => !resolvedIds.has(id));
    const bought = (t: TeamKey) => resolved.filter(p => p.team === t).length;
    const roomLeft = (['team1', 'team2'] as TeamKey[]).some(t => bought(t) < size - 1);

    const next = remaining.length ? drawFrom(remaining, priceOf) : null;
    if (next && roomLeft) {
      // Keep pool_order as the running record: resolved first, drawn player next.
      const order = [...auction.pool_order.filter(id => resolvedIds.has(id)), next,
        ...remaining.filter(id => id !== next)];
      await patch({
        pool_order: order,
        current_idx: order.indexOf(next),
        current_bid: priceOf(next),
        current_bidder: null,
      });
      return;
    }

    // Round over. Unsold players get another go at base price, as the rulebook
    // promises — otherwise a team can finish short purely on running order.
    // But only if SOMETHING sold this round: a round where every name is passed
    // would otherwise restart forever, and the auctioneer can never close.
    const soldThisRound = resolved.some(p => p.team && auction.pool_order.includes(p.member_id));
    const unsoldIds = resolved.filter(p => !p.team).map(p => p.member_id);
    if (roomLeft && unsoldIds.length > 0 && soldThisRound) {
      await supabase.from('scc_auction_picks').delete()
        .eq('season', season).in('member_id', unsoldIds);
      const first = drawFrom(unsoldIds, priceOf)!;
      const order = [first, ...unsoldIds.filter(id => id !== first)];
      await patch({
        round: round + 1,
        pool_order: order,
        current_idx: 0,
        current_bid: priceOf(first),
        current_bidder: null,
      });
      return;
    }

    /**
     * Closing time. Any player nobody bought goes to a team that still has a
     * slot, at his base price — squads have to be even enough to actually field
     * a side, and there is no bidding left to make that happen.
     *
     * This exists because a captain CAN price themselves out: one player may
     * legally absorb ₹20.4 Cr of a ₹23 Cr purse, after which they can only ever
     * meet a base price and get outbid on everyone. A test run left the winner
     * of a bidding war with seven players. Overspending stays a real mistake —
     * they get the leftovers rather than the players they wanted — but they
     * still finish with a team.
     *
     * These picks are stored with round 0 to mark them as allocated, not won,
     * so the squad lists can label them and the purse maths can tell them apart.
     */
    const leftovers = [
      ...auction.pool_order.filter(id => !resolvedIds.has(id)),
      ...resolved.filter(p => !p.team).map(p => p.member_id),
    ];
    const counts: Record<TeamKey, number> = { team1: bought('team1'), team2: bought('team2') };
    const fills = [];
    // Dearest first, to the emptier squad — the closest thing to fair when
    // nobody is bidding any more.
    for (const id of [...leftovers].sort((a, b) => priceOf(b) - priceOf(a))) {
      const t = (['team1', 'team2'] as TeamKey[])
        .filter(x => counts[x] < size - 1)
        .sort((x, y) => counts[x] - counts[y])[0];
      if (!t) break;
      counts[t] += 1;
      fills.push({ season, member_id: id, team: t, price: priceOf(id), round: 0 });
    }
    if (fills.length) {
      await supabase.from('scc_auction_picks')
        .upsert(fills, { onConflict: 'season,member_id' });
    }

    await patch({ status: 'done', current_bidder: null, current_bid: 0 });
  }, [auction, picks, size, drawFrom, patch, season, round]);

  const sell = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction || !currentMemberId || !auction.current_bidder) return;
    const team = auction.current_bidder;
    await supabase.from('scc_auction_picks').upsert({
      season, member_id: currentMemberId,
      team, price: auction.current_bid, round,
    }, { onConflict: 'season,member_id' });
    await advance(basePriceOf, { member_id: currentMemberId, team });
  }, [auction, currentMemberId, season, advance, round]);

  const passOver = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction || !currentMemberId) return;
    await supabase.from('scc_auction_picks').upsert({
      season, member_id: currentMemberId, team: null, price: 0, round,
    }, { onConflict: 'season,member_id' });
    await advance(basePriceOf, { member_id: currentMemberId, team: null });
  }, [auction, currentMemberId, season, advance, round]);

  /**
   * Undo the last resolved player and put them back on the block, reopened at
   * their BASE price. Reopening at `last.price` looked right for a sale but
   * gave 0 for an unsold player, so undoing an unsold pass restarted a ₹2 Cr
   * marquee name at the ₹20 L floor.
   */
  /** Every bid on the player currently under the hammer, oldest first. */
  const bidsOnCurrent = useMemo(
    () => bids.filter(b => b.member_id === currentMemberId && b.round === round),
    [bids, currentMemberId, round],
  );

  /**
   * Take back the last BID — a mis-click on a team button, which is the mistake
   * that actually happens when the auctioneer is calling a room. Undo used to
   * only work at the level of a whole sale: the only way to unwind a stray bid
   * was to sell or pass the player and then undo that, throwing away the entire
   * bidding history and restarting him at base.
   */
  const undoBid = useCallback(async () => {
    if (!auction || bidsOnCurrent.length === 0) return;
    const last = bidsOnCurrent[bidsOnCurrent.length - 1];
    const prev = bidsOnCurrent[bidsOnCurrent.length - 2];
    await supabase.from('scc_auction_bids').delete().eq('id', last.id);
    await patch({
      // No earlier bid? Back to the opening call at base price, nobody leading.
      current_bid: prev ? prev.amount : (basePriceOf?.(last.member_id) ?? auction.current_bid),
      current_bidder: prev ? prev.team : null,
    });
  }, [auction, bidsOnCurrent, patch, basePriceOf]);

  /**
   * Reopen the last player who was resolved. This unwinds his WHOLE auction —
   * the sale and every bid on him — and puts him back at base price, which is
   * the point: it's for "that shouldn't have been sold", not "wrong number".
   * For a stray bid use undoBid().
   */
  const undo = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction || picks.length === 0) return;

    // The end-of-auction allocation is one action, so undo it as one — picking
    // off a single auto-assigned player would leave the squads half-evened and
    // the auction stuck between finished and not.
    const allocatedPicks = picks.filter(p => p.round === 0 && p.team);
    if (auction.status === 'done' && allocatedPicks.length > 0) {
      await supabase.from('scc_auction_picks').delete()
        .eq('season', season).in('id', allocatedPicks.map(p => p.id));
      await patch({ status: 'live', current_bidder: null });
      return;
    }

    const last = [...picks].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()!;
    await Promise.all([
      supabase.from('scc_auction_picks').delete().eq('id', last.id),
      // His bids have to go too. Left behind, they'd show up as a phantom trail
      // on a player who is about to be auctioned again from scratch.
      supabase.from('scc_auction_bids').delete()
        .eq('season', season).eq('member_id', last.member_id).eq('round', round),
    ]);

    // A new unsold round rewrites pool_order to just the unsold names, so a
    // player sold in an earlier round isn't in it any more. Undoing him without
    // putting him back would drop him out of the auction altogether.
    const inPool = auction.pool_order.indexOf(last.member_id);
    const order = inPool >= 0
      ? auction.pool_order
      : [...auction.pool_order.slice(0, auction.current_idx), last.member_id,
         ...auction.pool_order.slice(auction.current_idx)];

    await patch({
      status: 'live',
      pool_order: order,
      current_idx: inPool >= 0 ? inPool : auction.current_idx,
      current_bid: basePriceOf(last.member_id),
      current_bidder: null,
    });
  }, [auction, picks, patch, season, round]);

  const start = useCallback(async (input: {
    team1Name: string; team2Name: string;
    team1CaptainId: string; team2CaptainId: string;
    poolOrder: string[]; purseLakh: number; squadSize: number; firstBid: number;
  }) => {
    const row = {
      season,
      status: 'live',
      team1_name: input.team1Name,
      team2_name: input.team2Name,
      team1_captain_id: input.team1CaptainId,
      team2_captain_id: input.team2CaptainId,
      purse_lakh: input.purseLakh,
      squad_size: input.squadSize,
      pool_order: input.poolOrder,
      current_idx: 0,
      current_bid: input.firstBid,
      current_bidder: null,
      round: 1,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('scc_auction').upsert(row, { onConflict: 'season' });
    // Same fallback as patch(): without add_scc_auction_rounds.sql the round
    // column is absent and PostgREST rejects the WHOLE insert, so the auction
    // could never start at all.
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /round/.test(error.message))) {
      const { round: _drop, ...rest } = row;
      void _drop;
      ({ error } = await supabase.from('scc_auction').upsert(rest, { onConflict: 'season' }));
    }
    if (error) return error.message;
    await fetchAll();
    return null;
  }, [season, fetchAll]);

  /** Wipe the whole auction for this season — used by the mock drill. */
  const reset = useCallback(async () => {
    await supabase.from('scc_auction_picks').delete().eq('season', season);
    // The bid trail has to go too. Left behind, a rehearsal's bids would show
    // up under the real players on auction night with prices nobody ever called.
    await supabase.from('scc_auction_bids').delete().eq('season', season);
    await supabase.from('scc_auction').delete().eq('season', season);
    await fetchAll();
  }, [season, fetchAll]);

  return {
    auction, picks, bids, sold, unsold, allocated, loading, tableMissing, trailFor,
    currentMemberId, bidStep, nextBid, canBid, maxBid, budget, spent, squad,
    bid, sell, passOver, undo, undoBid, bidsOnCurrent, start, reset, patch,
    hasSlot, captainCost, round, opening,
    refetch: fetchAll,
  };
}
