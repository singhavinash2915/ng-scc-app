import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BID_STEP_SMALL, BID_STEP_BIG, PURSE_LAKH } from './useSCCLeague';

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

export function useAuctionLive(season: string, opts: { live?: boolean } = {}) {
  const { live = true } = opts;
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const busy = useRef(false);

  const fetchAll = useCallback(async () => {
    // Never let a slow poll stack up behind another one.
    if (busy.current) return;
    busy.current = true;
    const [aRes, pRes] = await Promise.all([
      supabase.from('scc_auction').select('*').eq('season', season).maybeSingle(),
      supabase.from('scc_auction_picks').select('*').eq('season', season).order('created_at'),
    ]);
    busy.current = false;
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

  const budget = useCallback((t: TeamKey) => purse - spent(t), [purse, spent]);

  /**
   * A captain may not bid away the money needed to fill their remaining slots
   * at the cheapest base price — otherwise they finish the night short.
   */
  const maxBid = useCallback((t: TeamKey) => {
    const bought = squad(t).length;
    const slotsLeft = Math.max(0, size - 1 - bought);   // -1 = the captain
    return budget(t) - Math.max(0, slotsLeft - 1) * 20;
  }, [squad, size, budget]);

  const currentMemberId = auction?.pool_order?.[auction.current_idx] ?? null;
  const bidStep = (auction?.current_bid ?? 0) >= 100 ? BID_STEP_BIG : BID_STEP_SMALL;
  const nextBid = (auction?.current_bid ?? 0) + bidStep;
  const canBid = useCallback((t: TeamKey) => nextBid <= maxBid(t), [nextBid, maxBid]);

  // ── Admin actions ──────────────────────────────────────────────────────
  const patch = useCallback(async (fields: Partial<AuctionRow>) => {
    const { error } = await supabase.from('scc_auction')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('season', season);
    if (!error) await fetchAll();
    return error?.message ?? null;
  }, [season, fetchAll]);

  const bid = useCallback(async (team: TeamKey) => {
    if (!auction || !canBid(team)) return;
    // Optimistic: the room should see the number jump the instant it's called.
    setAuction(a => a && ({ ...a, current_bid: nextBid, current_bidder: team }));
    await patch({ current_bid: nextBid, current_bidder: team });
  }, [auction, canBid, nextBid, patch]);

  const advance = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction) return;
    const next = auction.current_idx + 1;
    if (next >= auction.pool_order.length) {
      await patch({ status: 'done', current_bidder: null, current_bid: 0 });
    } else {
      await patch({
        current_idx: next,
        current_bid: basePriceOf(auction.pool_order[next]),
        current_bidder: null,
      });
    }
  }, [auction, patch]);

  const sell = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction || !currentMemberId || !auction.current_bidder) return;
    await supabase.from('scc_auction_picks').upsert({
      season, member_id: currentMemberId,
      team: auction.current_bidder, price: auction.current_bid, round: 1,
    }, { onConflict: 'season,member_id' });
    await advance(basePriceOf);
  }, [auction, currentMemberId, season, advance]);

  const passOver = useCallback(async (basePriceOf: (id: string) => number) => {
    if (!auction || !currentMemberId) return;
    await supabase.from('scc_auction_picks').upsert({
      season, member_id: currentMemberId, team: null, price: 0, round: 1,
    }, { onConflict: 'season,member_id' });
    await advance(basePriceOf);
  }, [auction, currentMemberId, season, advance]);

  /** Undo the last resolved player and put them back on the block. */
  const undo = useCallback(async () => {
    if (!auction || picks.length === 0) return;
    const last = [...picks].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()!;
    await supabase.from('scc_auction_picks').delete().eq('id', last.id);
    const backTo = auction.pool_order.indexOf(last.member_id);
    await patch({
      status: 'live',
      current_idx: backTo >= 0 ? backTo : Math.max(0, auction.current_idx - 1),
      current_bid: last.price || 20,
      current_bidder: null,
    });
  }, [auction, picks, patch]);

  const start = useCallback(async (input: {
    team1Name: string; team2Name: string;
    team1CaptainId: string; team2CaptainId: string;
    poolOrder: string[]; purseLakh: number; squadSize: number; firstBid: number;
  }) => {
    const { error } = await supabase.from('scc_auction').upsert({
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'season' });
    if (error) return error.message;
    await fetchAll();
    return null;
  }, [season, fetchAll]);

  /** Wipe the whole auction for this season — used by the mock drill. */
  const reset = useCallback(async () => {
    await supabase.from('scc_auction_picks').delete().eq('season', season);
    await supabase.from('scc_auction').delete().eq('season', season);
    await fetchAll();
  }, [season, fetchAll]);

  return {
    auction, picks, sold, unsold, loading, tableMissing,
    currentMemberId, bidStep, nextBid, canBid, maxBid, budget, spent, squad,
    bid, sell, passOver, undo, start, reset, patch, refetch: fetchAll,
  };
}
