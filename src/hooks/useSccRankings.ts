import { useMemo } from 'react';
import type { Match, Member } from '../types';
import type { MatchScorecard, BatterRow, BowlerRow } from './useMatchScorecard';

const SCC_TEAM_ID = 7927431;

// ─── Tunable constants (the "ICC-style" knobs) ─────────────────────────────
const FIFTY_BONUS       = 25;
const HUNDRED_BONUS     = 75;
const SR_MIN            = 0.7;
const SR_MAX            = 1.4;
const NOT_OUT_BONUS     = 10;
const DUCK_PENALTY      = 5;

const WICKET_POINTS     = 25;
const FIVE_FOR_BONUS    = 75;
const THREE_FOR_BONUS   = 30;
const ECO_MIN           = 0.5;
const ECO_MAX           = 1.6;
const MAIDEN_BONUS      = 8;

const CATCH_POINTS      = 10;
const STUMPING_POINTS   = 15;
const RUN_OUT_POINTS    = 12;
const MOM_BONUS         = 50;

const OPP_STRONG_MULT   = 1.25;
const OPP_AVERAGE_MULT  = 1.00;
const OPP_WEAK_MULT     = 0.80;
const STRONG_THRESHOLD  = 0.50;   // opponent wins ≥ 50% of decisive games vs SCC
const WEAK_THRESHOLD    = 0.25;

const WIN_MULT          = 1.10;
const DRAW_MULT         = 1.00;
const LOSS_MULT         = 0.95;

const TIME_DECAY_STEPS = [
  { days:  30, mult: 1.00 },
  { days:  90, mult: 0.85 },
  { days: 180, mult: 0.65 },
  { days: 365, mult: 0.40 },
];
const TIME_DECAY_OLD    = 0.15;

// All-rounder threshold — must be respectable in BOTH disciplines
const ALL_ROUNDER_MIN_PER_DISCIPLINE = 200;

// ─── Public types ──────────────────────────────────────────────────────────
export interface RankedPlayer {
  rank: number;
  member: Member;
  rating: number;          // normalized 0-1000
  rawTotal: number;        // raw weighted sum before normalization
  matchesCounted: number;  // how many matches contributed
  bestMatch: { date: string; opponent: string; points: number } | null;
  // Discipline-specific breakdown (filled per ranking type)
  battingTotal?: number;
  bowlingTotal?: number;
  fieldingTotal?: number;
  momBonus?: number;
}

export interface SccRankings {
  batters: RankedPlayer[];
  bowlers: RankedPlayer[];
  allRounders: RankedPlayer[];
}

// ─── Utility helpers ──────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const normalizeName = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

// Match a CricHeroes scorecard name to an SCC member. Returns the member id or null.
// Uses progressive fuzzy matching: exact normalized → first-word → substring.
function buildNameMatcher(members: Member[]) {
  const exact: Record<string, string> = {};
  const firstWord: Record<string, string> = {};
  for (const m of members) {
    const norm = normalizeName(m.name);
    exact[norm] = m.id;
    const first = m.name.toLowerCase().split(/\s+/)[0];
    if (first) firstWord[normalizeName(first)] = m.id;
  }
  return (chName: string): string | null => {
    const norm = normalizeName(chName);
    if (!norm) return null;
    if (exact[norm]) return exact[norm];
    // Try first word
    const firstChWord = chName.toLowerCase().split(/\s+/)[0];
    const firstNorm = normalizeName(firstChWord);
    if (firstNorm && firstWord[firstNorm]) return firstWord[firstNorm];
    // Substring match either direction
    for (const m of members) {
      const memberNorm = normalizeName(m.name);
      if (memberNorm.length >= 4 && norm.includes(memberNorm)) return m.id;
      if (norm.length >= 4 && memberNorm.includes(norm)) return m.id;
    }
    return null;
  };
}

// Time-decay multiplier based on how many days ago the match was.
function timeDecay(daysAgo: number): number {
  for (const step of TIME_DECAY_STEPS) {
    if (daysAgo <= step.days) return step.mult;
  }
  return TIME_DECAY_OLD;
}

// Parse a CricHeroes SR string (like "143.5") to a number; tolerant of empties.
function parseNum(s: string | number | undefined | null): number {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Compute batting performance points for a single innings.
function battingPoints(b: BatterRow): number {
  const runs = b.runs || 0;
  const balls = b.balls || 0;
  const sr = parseNum(b.SR);
  const isOut = !!(b.how_to_out && b.how_to_out.trim() !== '');
  const isDuck = runs === 0 && isOut && balls > 0;

  let pts = runs;
  if (runs >= 100) pts += HUNDRED_BONUS;
  else if (runs >= 50) pts += FIFTY_BONUS;

  // Strike-rate multiplier — only meaningful if they faced enough balls
  const srMult = balls >= 6 ? clamp(sr / 100, SR_MIN, SR_MAX) : 1.0;
  pts = pts * srMult;

  if (!isOut && balls > 0) pts += NOT_OUT_BONUS;
  if (isDuck) pts -= DUCK_PENALTY;
  return Math.max(0, pts);
}

// Compute bowling performance points for a single innings.
function bowlingPoints(b: BowlerRow): number {
  const wkts = b.wickets || 0;
  const overs = b.overs || 0;
  const balls = b.balls || 0;
  const eco = parseNum(b.economy_rate);
  // Did the bowler bowl anything?
  const totalBalls = overs * 6 + balls;
  if (totalBalls === 0) return 0;

  let pts = wkts * WICKET_POINTS;
  if (wkts >= 5) pts += FIVE_FOR_BONUS;
  else if (wkts >= 3) pts += THREE_FOR_BONUS;

  // Economy multiplier: better economy → higher multiplier
  // formula: 2.0 - eco/6 → at eco 0 → 2.0, at eco 6 → 1.0, at eco 12 → 0.0
  const ecoMult = clamp(2.0 - eco / 6, ECO_MIN, ECO_MAX);
  pts = pts * ecoMult;

  // Maiden bonus (small)
  pts += (b.maidens || 0) * MAIDEN_BONUS;

  return Math.max(0, pts);
}

// Determine opposition multiplier from SCC's historical record vs the opponent.
function buildOppositionMultiplier(matches: Match[]): (opponent: string | null) => number {
  const record: Record<string, { wins: number; losses: number }> = {};
  for (const m of matches) {
    if (!m.opponent) continue;
    if (m.match_type === 'internal') continue;
    if (!['won', 'lost'].includes(m.result)) continue;
    const key = m.opponent.trim();
    if (!record[key]) record[key] = { wins: 0, losses: 0 };
    if (m.result === 'won') record[key].wins++;
    else record[key].losses++;
  }
  return (opponent: string | null): number => {
    if (!opponent) return OPP_AVERAGE_MULT;
    const r = record[opponent.trim()];
    if (!r) return OPP_AVERAGE_MULT;
    const total = r.wins + r.losses;
    if (total < 2) return OPP_AVERAGE_MULT; // need at least 2 games for confidence
    const oppWinRate = r.losses / total; // opposition's win rate from SCC's perspective
    if (oppWinRate >= STRONG_THRESHOLD) return OPP_STRONG_MULT;
    if (oppWinRate < WEAK_THRESHOLD) return OPP_WEAK_MULT;
    return OPP_AVERAGE_MULT;
  };
}

// ─── Season-mode option ────────────────────────────────────────────────────
// "all" = every external match SCC has ever played (with time-decay weighting)
// "2025-26" / "2024-25" / "2023-24" = only matches within that season's
//   window (Oct→Sep), with time-decay re-baselined so the most recent match in
//   the season is treated as "this week" (decay = 1.0).
export type RankingMode = 'all' | '2025-26' | '2024-25' | '2023-24';

interface SeasonWindow { start: string; end: string }
const SEASON_WINDOWS: Record<Exclude<RankingMode, 'all'>, SeasonWindow> = {
  '2025-26': { start: '2025-10-01', end: '2026-09-30' },
  '2024-25': { start: '2024-10-01', end: '2025-09-30' },
  '2023-24': { start: '2023-10-01', end: '2024-09-30' },
};

// ─── Main hook ─────────────────────────────────────────────────────────────
export function useSccRankings(
  matches: Match[],
  members: Member[],
  scorecards: MatchScorecard[] | null,
  mode: RankingMode = 'all',
): SccRankings {
  return useMemo(() => {
    if (!scorecards || scorecards.length === 0 || members.length === 0) {
      return { batters: [], bowlers: [], allRounders: [] };
    }

    const matchById: Record<string, Match> = {};
    for (const m of matches) matchById[m.id] = m;

    const resolveName = buildNameMatcher(members);
    const oppMult    = buildOppositionMultiplier(matches);

    // Time-decay behaviour:
    //   - All-time mode: decay relative to TODAY (recent matches matter more)
    //   - Season mode: NO decay — every match within the selected season
    //     counts equally, so we get a fair "who was the best in 2024-25?" view
    //     rather than just rewarding late-season form.
    const window = mode === 'all' ? null : SEASON_WINDOWS[mode];
    const baselineDate = Date.now();

    // member_id → accumulator
    type Acc = { battingTotal: number; bowlingTotal: number; fieldingTotal: number; momBonus: number; matchesCounted: number; bestMatch: { date: string; opponent: string; points: number } | null };
    const acc: Record<string, Acc> = {};
    const ensureAcc = (id: string): Acc => {
      if (!acc[id]) acc[id] = { battingTotal: 0, bowlingTotal: 0, fieldingTotal: 0, momBonus: 0, matchesCounted: 0, bestMatch: null };
      return acc[id];
    };

    for (const sc of scorecards) {
      const match = matchById[sc.match_id];
      if (!match) continue;
      if (match.match_type === 'internal') continue;
      if (!['won', 'lost', 'draw'].includes(match.result)) continue;

      // Season filter — skip matches outside the chosen window
      if (window && (match.date < window.start || match.date > window.end)) continue;

      // Time decay only applies in all-time mode. In a single-season view we
      // treat every match in the season as equally weighted (decay = 1.0).
      const decay = window
        ? 1.0
        : timeDecay(Math.floor(Math.max(0, (baselineDate - new Date(match.date).getTime()) / 86400000)));
      const opponentMultiplier = oppMult(match.opponent);
      const resultMult = match.result === 'won' ? WIN_MULT : match.result === 'lost' ? LOSS_MULT : DRAW_MULT;
      const matchMult = decay * opponentMultiplier * resultMult;

      // Per-player tally for THIS match (so we know who participated → bestMatch & matchesCounted)
      const matchPlayerPoints: Record<string, { bat: number; bowl: number; field: number; mom: number }> = {};
      const bump = (mid: string, key: 'bat'|'bowl'|'field'|'mom', pts: number) => {
        if (!matchPlayerPoints[mid]) matchPlayerPoints[mid] = { bat: 0, bowl: 0, field: 0, mom: 0 };
        matchPlayerPoints[mid][key] += pts;
      };

      // SCC batting innings (whichever inning belongs to SCC)
      const sccBatting = sc.innings1_team_id === SCC_TEAM_ID ? sc.innings1_batting
                       : sc.innings2_team_id === SCC_TEAM_ID ? sc.innings2_batting : null;
      // SCC bowled in the OPPONENT'S batting innings
      const sccBowling = sc.innings1_team_id === SCC_TEAM_ID ? sc.innings2_bowling
                       : sc.innings2_team_id === SCC_TEAM_ID ? sc.innings1_bowling : null;

      // Fielding dismissals — parse from OPPONENT's batting innings how_to_out strings
      const oppBatting = sc.innings1_team_id === SCC_TEAM_ID ? sc.innings2_batting
                       : sc.innings2_team_id === SCC_TEAM_ID ? sc.innings1_batting : null;

      if (sccBatting) {
        for (const b of sccBatting) {
          const mid = resolveName(b.name);
          if (!mid) continue;
          const pts = battingPoints(b);
          if (pts > 0) bump(mid, 'bat', pts);
        }
      }

      if (sccBowling) {
        for (const b of sccBowling) {
          const mid = resolveName(b.name);
          if (!mid) continue;
          const pts = bowlingPoints(b);
          if (pts > 0) bump(mid, 'bowl', pts);
        }
      }

      if (oppBatting) {
        for (const b of oppBatting) {
          const how = (b.how_to_out || '').trim();
          if (!how) continue;
          const lower = how.toLowerCase();
          // Caught by ...
          let m: RegExpMatchArray | null;
          if ((m = how.match(/^c\s*&\s*b\s+(.+)/i))) {
            const mid = resolveName(m[1]);
            if (mid) bump(mid, 'field', CATCH_POINTS);
          } else if ((m = how.match(/^c\s+([^b]+?)\s+b\s+/i))) {
            const mid = resolveName(m[1].trim());
            if (mid) bump(mid, 'field', CATCH_POINTS);
          } else if ((m = how.match(/^st\s+([^b]+?)\s+b\s+/i))) {
            const mid = resolveName(m[1].trim());
            if (mid) bump(mid, 'field', STUMPING_POINTS);
          } else if (lower.includes('run out')) {
            const ro = how.match(/run out\s*\(?\s*([^)/\n]+)/i);
            if (ro) {
              const mid = resolveName(ro[1].trim());
              if (mid) bump(mid, 'field', RUN_OUT_POINTS);
            }
          }
        }
      }

      // MOM bonus
      if (match.man_of_match_id && matchPlayerPoints[match.man_of_match_id]) {
        matchPlayerPoints[match.man_of_match_id].mom = MOM_BONUS;
      }

      // Roll up into per-player accumulators with the match multiplier applied
      for (const [mid, p] of Object.entries(matchPlayerPoints)) {
        const a = ensureAcc(mid);
        const matchPoints = (p.bat + p.bowl + p.field + p.mom) * matchMult;
        a.battingTotal  += p.bat   * matchMult;
        a.bowlingTotal  += p.bowl  * matchMult;
        a.fieldingTotal += p.field * matchMult;
        a.momBonus      += p.mom   * matchMult;
        a.matchesCounted++;
        if (!a.bestMatch || matchPoints > a.bestMatch.points) {
          a.bestMatch = { date: match.date, opponent: match.opponent || 'Internal', points: Math.round(matchPoints) };
        }
      }
    }

    // Build raw lists for each discipline
    const memberById: Record<string, Member> = {};
    for (const m of members) memberById[m.id] = m;

    const allEntries = Object.entries(acc)
      .map(([mid, a]) => ({
        member: memberById[mid],
        ...a,
        // Composite for each discipline (batting includes some fielding/MOM credit)
        compositeBatter:    a.battingTotal + a.fieldingTotal * 0.3 + a.momBonus * 0.5,
        compositeBowler:    a.bowlingTotal + a.fieldingTotal * 0.3 + a.momBonus * 0.5,
        compositeAllRound:  Math.sqrt(Math.max(0, a.battingTotal + a.fieldingTotal * 0.3) * Math.max(0, a.bowlingTotal + a.fieldingTotal * 0.3)) + a.momBonus * 0.5,
      }))
      .filter(e => e.member); // drop unresolved

    const buildRanked = (
      sortKey: 'compositeBatter' | 'compositeBowler' | 'compositeAllRound',
      filter?: (e: typeof allEntries[0]) => boolean,
    ): RankedPlayer[] => {
      const filtered = filter ? allEntries.filter(filter) : allEntries;
      const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);
      const maxRaw = sorted[0]?.[sortKey] || 1;
      return sorted.map((e, i) => ({
        rank: i + 1,
        member: e.member!,
        rating: Math.round((e[sortKey] / maxRaw) * 1000),
        rawTotal: Math.round(e[sortKey]),
        matchesCounted: e.matchesCounted,
        bestMatch: e.bestMatch,
        battingTotal: Math.round(e.battingTotal),
        bowlingTotal: Math.round(e.bowlingTotal),
        fieldingTotal: Math.round(e.fieldingTotal),
        momBonus: Math.round(e.momBonus),
      }));
    };

    // All-rounder threshold scales down for single-season views (smaller
    // sample size → fewer players hit a high cutoff). 50% of the all-time bar.
    const arThreshold = window
      ? Math.round(ALL_ROUNDER_MIN_PER_DISCIPLINE * 0.5)
      : ALL_ROUNDER_MIN_PER_DISCIPLINE;

    const batters = buildRanked('compositeBatter', e => e.battingTotal > 0);
    const bowlers = buildRanked('compositeBowler', e => e.bowlingTotal > 0);
    const allRounders = buildRanked('compositeAllRound', e =>
      e.battingTotal >= arThreshold &&
      e.bowlingTotal >= arThreshold
    );

    return { batters, bowlers, allRounders };
  }, [matches, members, scorecards, mode]);
}

// Export the constants so the "How it's calculated" UI can show real numbers
export const RANKING_CONSTANTS = {
  FIFTY_BONUS, HUNDRED_BONUS, SR_MIN, SR_MAX, NOT_OUT_BONUS, DUCK_PENALTY,
  WICKET_POINTS, FIVE_FOR_BONUS, THREE_FOR_BONUS, ECO_MIN, ECO_MAX, MAIDEN_BONUS,
  CATCH_POINTS, STUMPING_POINTS, RUN_OUT_POINTS, MOM_BONUS,
  OPP_STRONG_MULT, OPP_AVERAGE_MULT, OPP_WEAK_MULT,
  WIN_MULT, DRAW_MULT, LOSS_MULT,
  TIME_DECAY_STEPS, TIME_DECAY_OLD,
  ALL_ROUNDER_MIN_PER_DISCIPLINE,
};
