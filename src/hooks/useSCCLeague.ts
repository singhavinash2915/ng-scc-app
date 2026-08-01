import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── SCC League: registration + captain elections ──────────────────────────────

export type LeagueStatus = 'in' | 'out';   // confirmed players only — no maybes
export type LeagueRole = 'batter' | 'bowler' | 'allrounder' | 'keeper';

export interface LeagueRegistration {
  id: string;
  season: string;
  member_id: string;
  status: LeagueStatus;
  role: LeagueRole | null;
  base_price: number;
  pitch: string | null;
  can_commit: boolean;
}

export interface LeagueVote {
  id: string;
  season: string;
  voter_id: string;
  captain_id: string | null;
}

export const ROLE_LABELS: Record<LeagueRole, string> = {
  batter: '🏏 Batter',
  bowler: '🎯 Bowler',
  allrounder: '⚡ All-rounder',
  keeper: '🧤 Keeper',
};

/** Two XIs need this many committed players before an auction makes sense. */
export const SQUAD_TARGET = 22;

// ─── Auction economics (IPL-flavoured, all values in ₹ LAKH) ──────────────────
// Big numbers are half the fun — nobody brags about being sold for ₹200.
export const PURSE_LAKH = 5000;                       // ₹50 Cr per team
export const SQUAD_SIZE = 11;                         // captain + 10 bought
export const BID_STEP_SMALL = 10;                     // +₹10L while under ₹1 Cr
export const BID_STEP_BIG = 25;                       // +₹25L at ₹1 Cr and above

// ─── Base-price tiers ─────────────────────────────────────────────────────────
// Base price is EARNED, not chosen. If players picked their own, everyone would
// pick the top slab and it would mean nothing. Instead we grade them from the
// club's own ICC-style rating (the same one behind SCC Rankings / market value),
// so the tier is objective — and arguing about it is half the fun 😄
export interface PriceTier {
  key: 'marquee' | 'a' | 'b' | 'c';
  label: string;
  emoji: string;
  price: number;      // ₹ lakh
  minRating: number;  // SCC rating needed
  cls: string;
}

export const PRICE_TIERS: PriceTier[] = [
  { key: 'marquee', label: 'Marquee', emoji: '💎', price: 200, minRating: 750, cls: 'from-violet-500 to-fuchsia-500' },
  { key: 'a',       label: 'Grade A', emoji: '🥇', price: 100, minRating: 500, cls: 'from-amber-400 to-orange-500' },
  { key: 'b',       label: 'Grade B', emoji: '🥈', price: 50,  minRating: 250, cls: 'from-slate-400 to-slate-500' },
  { key: 'c',       label: 'Grade C', emoji: '🥉', price: 20,  minRating: 0,   cls: 'from-orange-600 to-amber-700' },
];

/** Grade a player from their SCC rating (0–1000). Unrated players start at C. */
export function tierForRating(rating: number | undefined): PriceTier {
  return PRICE_TIERS.find(t => (rating ?? 0) >= t.minRating) ?? PRICE_TIERS[PRICE_TIERS.length - 1];
}

/** 20 → "₹20 L" · 100 → "₹1 Cr" · 250 → "₹2.5 Cr" */
export function formatPrice(lakh: number): string {
  if (lakh >= 100) {
    const cr = lakh / 100;
    return `₹${Number.isInteger(cr) ? cr : cr.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  }
  return `₹${lakh} L`;
}

const isMissingTable = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message);

export function useSCCLeague(season: string) {
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);
  const [votes, setVotes] = useState<LeagueVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [regRes, voteRes] = await Promise.all([
      supabase.from('scc_league_registrations').select('*').eq('season', season),
      supabase.from('scc_league_captain_votes').select('*').eq('season', season),
    ]);
    if (regRes.error) {
      if (isMissingTable(regRes.error)) setTableMissing(true);
      setRegistrations([]);
    } else {
      setTableMissing(false);
      setRegistrations((regRes.data as LeagueRegistration[]) || []);
    }
    setVotes(voteRes.error ? [] : ((voteRes.data as LeagueVote[]) || []));
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Registration ────────────────────────────────────────────────────────
  const register = useCallback(async (input: {
    memberId: string;
    status: LeagueStatus;
    role: LeagueRole | null;
    basePrice: number;   // graded from rating, not chosen
    pitch: string;
    canCommit: boolean;
  }) => {
    const { error } = await supabase.from('scc_league_registrations').upsert({
      season,
      member_id: input.memberId,
      status: input.status,
      role: input.role,
      base_price: input.basePrice,
      pitch: input.pitch.trim() || null,
      can_commit: input.canCommit,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'season,member_id' });
    if (error) return { success: false, error: error.message };
    await fetchAll();
    return { success: true };
  }, [season, fetchAll]);

  const myRegistration = useCallback(
    (memberId: string | null) => (memberId ? registrations.find(r => r.member_id === memberId) ?? null : null),
    [registrations],
  );

  // ── Captain election ────────────────────────────────────────────────────
  const castVote = useCallback(async (voterId: string, captainId: string) => {
    const { error } = await supabase.from('scc_league_captain_votes').upsert({
      season, voter_id: voterId, captain_id: captainId,
    }, { onConflict: 'season,voter_id' });
    if (error) return { success: false, error: error.message };
    await fetchAll();
    return { success: true };
  }, [season, fetchAll]);

  const myVote = useCallback(
    (memberId: string | null) => (memberId ? votes.find(v => v.voter_id === memberId) ?? null : null),
    [votes],
  );

  // ── Derived ─────────────────────────────────────────────────────────────
  const going = useMemo(() => registrations.filter(r => r.status === 'in'), [registrations]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { batter: 0, bowler: 0, allrounder: 0, keeper: 0 };
    going.forEach(r => { if (r.role) c[r.role] = (c[r.role] || 0) + 1; });
    return c;
  }, [going]);

  /** Captain vote tally, most-voted first. */
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    votes.forEach(v => { if (v.captain_id) m.set(v.captain_id, (m.get(v.captain_id) || 0) + 1); });
    const captains = [...m.entries()]
      .map(([id, n]) => ({ id, n }))
      .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    return { captains, ballots: votes.length };
  }, [votes]);

  /** The two most-voted players captain the two teams. */
  const leadership = useMemo(
    () => ({ captains: tally.captains.slice(0, 2).map(c => c.id) }),
    [tally],
  );

  return {
    registrations, votes, loading, tableMissing,
    register, myRegistration, castVote, myVote,
    going, roleCounts, tally, leadership,
    refetch: fetchAll,
  };
}
