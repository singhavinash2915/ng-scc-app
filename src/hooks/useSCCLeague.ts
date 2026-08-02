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
  /** Willing to captain a side. Undefined until add_league_captaincy_optout.sql
   *  has run — treated as willing, which is the pre-existing behaviour. */
  wants_captaincy?: boolean;
}

/** Nobody is forced onto the ballot; missing column == willing. */
export const isWillingCaptain = (r: LeagueRegistration) => r.wants_captaincy !== false;

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

/** Two full squads before an auction makes sense. 26 = 13 a side. */
export const SQUAD_TARGET = 26;

/** Late joiners aren't turned away — the next 4 go in as IMPACT PLAYERS,
 *  2 per squad, auctioned last out of what's left in the purse. */
export const IMPACT_SLOTS_PER_TEAM = 2;
export const SQUAD_MAX = SQUAD_TARGET + IMPACT_SLOTS_PER_TEAM * 2;   // 30

/** Captain voting stays locked until this many players have confirmed.
 *  Opening it earlier lets a handful of early birds stitch up the result
 *  before most of the squad has even registered. */
export const VOTE_UNLOCK_AT = 22;

// ─── Auction economics (IPL-flavoured, all values in ₹ LAKH) ──────────────────
// Big numbers are half the fun — nobody brags about being sold for ₹200.
// Purse is deliberately tight. The pool's total base value is ~₹17 Cr, so
// ₹15 Cr a side puts about 1.8x that much money on the table — enough to
// fight over two or three stars, not enough to buy everyone. At ₹50 Cr the
// money never ran out and every bid was meaningless.
export const PURSE_LAKH = 1500;                       // ₹15 Cr per team
export const SQUAD_SIZE = 13;                         // captain + 12 bought (+2 impact)
export const BID_STEP_SMALL = 5;                      // +₹5L while under ₹1 Cr
export const BID_STEP_BIG = 10;                       // +₹10L at ₹1 Cr and above

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

/** The order players come up on auction night: Marquee first, while every
 *  captain still has a full purse and the room is loudest. */
export const AUCTION_SETS = [
  { key: 'marquee', label: 'Marquee Set', emoji: '💎', price: 200, blurb: 'The headline names. Full purses, no mercy.' },
  { key: 'a',       label: 'Set A',       emoji: '🥇', price: 100, blurb: 'Proven match-winners.' },
  { key: 'b',       label: 'Set B',       emoji: '🥈', price: 50,  blurb: 'The engine room — squads are won here.' },
  { key: 'c',       label: 'Set C',       emoji: '🥉', price: 20,  blurb: 'Bargains, punts and future stars.' },
] as const;

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
    wantsCaptaincy: boolean;
  }) => {
    const base = {
      season,
      member_id: input.memberId,
      status: input.status,
      role: input.role,
      base_price: input.basePrice,
      pitch: input.pitch.trim() || null,
      can_commit: input.canCommit,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('scc_league_registrations')
      .upsert({ ...base, wants_captaincy: input.wantsCaptaincy }, { onConflict: 'season,member_id' });

    // Migration not run yet? Save everything else rather than losing the
    // registration entirely — the captaincy flag defaults to willing anyway.
    if (error?.code === '42703' || /wants_captaincy/.test(error?.message ?? '')) {
      ({ error } = await supabase.from('scc_league_registrations')
        .upsert(base, { onConflict: 'season,member_id' }));
    }
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
    // Only confirmed players get a say. Registration status is the whole
    // eligibility rule, so it is enforced here as well as in the UI —
    // sitting out (or never registering) must not buy you a ballot.
    const voter = registrations.find(r => r.member_id === voterId);
    if (voter?.status !== 'in') {
      return { success: false, error: 'Only players registered as IN can vote.' };
    }
    const { error } = await supabase.from('scc_league_captain_votes').upsert({
      season, voter_id: voterId, captain_id: captainId,
    }, { onConflict: 'season,voter_id' });
    if (error) return { success: false, error: error.message };
    await fetchAll();
    return { success: true };
  }, [season, fetchAll, registrations]);

  const myVote = useCallback(
    (memberId: string | null) => (memberId ? votes.find(v => v.voter_id === memberId) ?? null : null),
    [votes],
  );

  // ── Derived ─────────────────────────────────────────────────────────────
  const going = useMemo(() => registrations.filter(r => r.status === 'in'), [registrations]);
  const sittingOut = useMemo(() => registrations.filter(r => r.status === 'out'), [registrations]);

  /** Only players who are in AND up for the job appear on the captain ballot. */
  const captainCandidates = useMemo(() => going.filter(isWillingCaptain), [going]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { batter: 0, bowler: 0, allrounder: 0, keeper: 0 };
    going.forEach(r => { if (r.role) c[r.role] = (c[r.role] || 0) + 1; });
    return c;
  }, [going]);

  /**
   * Captain vote tally, most-voted first.
   * Counts only ballots from players currently registered IN — a vote cast by
   * someone sitting out (or never registered) is not a vote.
   */
  const eligibleVotes = useMemo(() => {
    const inIds = new Set(going.map(r => r.member_id));
    return votes.filter(v => inIds.has(v.voter_id));
  }, [votes, going]);

  const tally = useMemo(() => {
    const m = new Map<string, number>();
    eligibleVotes.forEach(v => { if (v.captain_id) m.set(v.captain_id, (m.get(v.captain_id) || 0) + 1); });
    const captains = [...m.entries()]
      .map(([id, n]) => ({ id, n }))
      .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    return { captains, ballots: eligibleVotes.length, discarded: votes.length - eligibleVotes.length };
  }, [eligibleVotes, votes]);

  /** The two most-voted players captain the two teams. */
  const leadership = useMemo(
    () => ({ captains: tally.captains.slice(0, 2).map(c => c.id) }),
    [tally],
  );

  return {
    registrations, votes, loading, tableMissing,
    register, myRegistration, castVote, myVote,
    going, sittingOut, captainCandidates, roleCounts, tally, leadership,
    refetch: fetchAll,
  };
}
