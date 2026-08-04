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

/** A ranked position with NO vote count attached — equal positions = a tie. */
export interface CaptainStanding {
  captain_id: string;
  position: number;
}

/** How many leaders the app is ever allowed to reveal. */
export const REVEAL_TOP_N = 3;

/** Ballots close 5pm IST, Mon 3 Aug 2026 (= 11:30 UTC). */
export const VOTING_CLOSES_AT = new Date('2026-08-03T11:30:00Z');
export const votingHasClosed = () => Date.now() >= VOTING_CLOSES_AT.getTime();

/** Own ballot, mirrored on the device. Once the ballots table is locked down
 *  the app can no longer read even your own row back, so this is what lets it
 *  still show you your pick. */
const myBallotKey = (season: string) => `scc-league-ballot-${season}`;

export const ROLE_LABELS: Record<LeagueRole, string> = {
  batter: '🏏 Batter',
  bowler: '🎯 Bowler',
  allrounder: '⚡ All-rounder',
  keeper: '🧤 Keeper',
};

/** Two full squads. 30 registered = 15 a side, and the maths lands exactly:
 *  2 captains retained + 28 auctioned = 14 bought per team. */
export const SQUAD_TARGET = 30;

/** No spare slots left at 30 — every registered player has a place. */
export const IMPACT_SLOTS_PER_TEAM = 0;
export const SQUAD_MAX = SQUAD_TARGET;

/** Captain voting stays locked until this many players have confirmed.
 *  Opening it earlier lets a handful of early birds stitch up the result
 *  before most of the squad has even registered. */
export const VOTE_UNLOCK_AT = 22;

// ─── Auction economics (IPL-flavoured, all values in ₹ LAKH) ──────────────────
// Big numbers are half the fun — nobody brags about being sold for ₹200.
// The pool's total base value is ~₹17 Cr, so ₹25 Cr a side puts about 3x that
// much money on the table: room for real bidding wars while still forcing
// choices late on. (At the original ₹50 Cr the money never ran out at all.)
export const PURSE_LAKH = 2500;                       // ₹25 Cr per team
export const SQUAD_SIZE = 15;                         // captain + 14 bought
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

export interface LeagueOptions {
  /** Admins get the ballots. Everyone else must never receive them — see below. */
  isAdmin?: boolean;
  /** Needed so a member can read back their OWN ballot without seeing others'. */
  myId?: string | null;
  /** SCC Rankings ratings, used to break ties the way the rulebook says. */
  ratingById?: Record<string, number>;
}

export function useSCCLeague(season: string, options: LeagueOptions = {}) {
  const { isAdmin = false, myId = null, ratingById } = options;
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);
  const [votes, setVotes] = useState<LeagueVote[]>([]);
  const [standings, setStandings] = useState<CaptainStanding[]>([]);
  const [ballotCount, setBallotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const regRes = await supabase.from('scc_league_registrations').select('*').eq('season', season);
    if (regRes.error) {
      if (isMissingTable(regRes.error)) setTableMissing(true);
      setRegistrations([]);
    } else {
      setTableMissing(false);
      setRegistrations((regRes.data as LeagueRegistration[]) || []);
    }

    // A secret ballot has to be secret in the NETWORK TAB too, not just on
    // screen — and the admin password is shared, so admins are no exception.
    // NOBODY's browser gets the ballots or the counts: everyone reads ranked
    // positions from a view, plus their own row so they can see their pick.
    const [standRes, countRes, mineRes] = await Promise.all([
      supabase.from('scc_league_captain_standings')
        .select('captain_id,position').eq('season', season).order('position'),
      supabase.from('scc_league_ballot_counts').select('ballots').eq('season', season).maybeSingle(),
      myId
        ? supabase.from('scc_league_captain_votes').select('*').eq('season', season).eq('voter_id', myId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const mineRows = (mineRes.data as LeagueVote[]) || [];
    if (mineRows.length) {
      setVotes(mineRows);
      localStorage.setItem(myBallotKey(season), mineRows[0].captain_id ?? '');
    } else {
      // Ballots may simply be unreadable now (by design). Fall back to the
      // copy this device kept when the vote was cast.
      const local = myId ? localStorage.getItem(myBallotKey(season)) : null;
      setVotes(local
        ? [{ id: 'local', season, voter_id: myId!, captain_id: local }]
        : []);
    }

    if (standRes.error && isMissingTable(standRes.error)) {
      // Views not created yet. Fall back to counting locally — but ONLY for an
      // admin. A member's browser must never pull the ballot rows: doing that
      // here once put every vote in every member's network tab, which is the
      // whole thing this design exists to prevent.
      if (!isAdmin) {
        const countRes2 = await supabase.from('scc_league_captain_votes')
          .select('id', { count: 'exact', head: true }).eq('season', season);
        setStandings([]);                       // members are shown no standings
        setBallotCount(countRes2.count ?? 0);   // a bare number, no identities
      } else {
        const voteRes = await supabase.from('scc_league_captain_votes').select('*').eq('season', season);
        const rows = voteRes.error ? [] : ((voteRes.data as LeagueVote[]) || []);
        const inIds = new Set((regRes.data as LeagueRegistration[] || [])
          .filter(r => r.status === 'in').map(r => r.member_id));
        const eligible = rows.filter(v => inIds.has(v.voter_id));
        const m = new Map<string, number>();
        eligible.forEach(v => { if (v.captain_id) m.set(v.captain_id, (m.get(v.captain_id) || 0) + 1); });
        const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
        setStandings(ranked.map(([id, n]) => ({
          captain_id: id,
          position: ranked.filter(([, o]) => o > n).length + 1,
        })));
        setBallotCount(eligible.length);
      }
    } else {
      setStandings((standRes.data as CaptainStanding[]) || []);
      setBallotCount((countRes.data as { ballots: number } | null)?.ballots ?? 0);
    }
    setLoading(false);
  }, [season, isAdmin, myId]);

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
    if (votingHasClosed()) {
      return { success: false, error: 'Voting has closed.' };
    }
    const { error } = await supabase.from('scc_league_captain_votes').upsert({
      season, voter_id: voterId, captain_id: captainId,
    }, { onConflict: 'season,voter_id' });
    if (error) return { success: false, error: error.message };
    localStorage.setItem(myBallotKey(season), captainId);
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
   * The leading few captain candidates — NAMES AND ORDER ONLY.
   * No counts anywhere: the admin password is shared around, so a number on
   * screen is a number the whole club can read. Ties (equal positions) are
   * settled on SCC Rankings rating, exactly as the rulebook says.
   */
  const tally = useMemo(() => {
    const rating = (id: string) => ratingById?.[id] ?? 0;
    const captains = [...standings]
      .sort((a, b) => a.position - b.position || rating(b.captain_id) - rating(a.captain_id))
      .map(x => ({
        id: x.captain_id,
        position: x.position,
        rating: rating(x.captain_id),
        tied: standings.some(o => o.captain_id !== x.captain_id && o.position === x.position),
      }));
    return { captains, ballots: ballotCount };
  }, [standings, ratingById, ballotCount]);

  /** The two most-voted players captain the two teams. */
  const leadership = useMemo(
    () => ({ captains: tally.captains.slice(0, 2).map(c => c.id) }),
    [tally],
  );

  const revealed = useMemo(() => tally.captains.slice(0, REVEAL_TOP_N), [tally]);

  return {
    registrations, votes, loading, tableMissing,
    register, myRegistration, castVote, myVote,
    going, sittingOut, captainCandidates, roleCounts, tally, leadership, revealed,
    refetch: fetchAll,
  };
}
