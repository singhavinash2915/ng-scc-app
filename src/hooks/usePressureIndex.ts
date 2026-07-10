import { useMemo } from 'react';
import type { Match, Member } from '../types';
import type { MatchScorecard, BatterRow, BowlerRow } from './useMatchScorecard';
import { SCC_TEAM_ID, buildNameMatcher } from './useSccRankings';
import { CH_PLAYER_TO_MEMBER } from './useStatSync';

// ─── Pressure Performance Index ────────────────────────────────────────────────
// Scoring runs / taking wickets in a NORMAL match is one thing — doing it when
// the game is on a knife's edge is what wins titles. This weights each player's
// per-match contribution by how much PRESSURE that match carried, so the players
// who deliver in tight, low-scoring, knockout or losing games rise to the top.
//
// Pressure per match (weight ≈ 1.0 baseline, up to ~2.6):
//   • Close finish (small run margin)     → biggest factor
//   • Low-scoring game (every run counts)
//   • Knockout stage (final / semi)
//   • Performing in a defeat (team failed, you stood up)

const num = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

const KNOCKOUT = /final|semi|quarter|knockout|eliminator|playoff/i;

export interface PressureRow {
  member: Member;
  // batting
  pressureRuns: number;       // pressure-weighted runs
  rawRuns: number;            // actual runs in pressure matches
  pInnings: number;           // innings in pressure matches
  pAvg: number;               // raw runs / pressure innings
  // bowling
  pressureWkts: number;       // pressure-weighted wickets
  rawWkts: number;
  // combined index (0–1000, normalised within the squad)
  index: number;
}

export interface PressureIndex {
  batting: PressureRow[];
  bowling: PressureRow[];
  overall: PressureRow[];
  pressureMatchCount: number;
  loading: boolean;
}

/** Pressure weight for a completed external match (≈1.0 baseline). */
export function matchPressure(match: Match): number {
  const our = num(match.our_score);
  const opp = num(match.opponent_score);
  let w = 1.0;

  // Close finish — the tighter the margin, the more pressure.
  if (our != null && opp != null) {
    const margin = Math.abs(our - opp);
    if (margin <= 10) w += 0.9;
    else if (margin <= 20) w += 0.6;
    else if (margin <= 35) w += 0.3;
    // Low-scoring game — bowler-friendly, every run/wkt precious.
    const total = Math.max(our, opp);
    if (total > 0 && total < 110) w += 0.35;
    else if (total < 140) w += 0.15;
  }
  // Knockout stage (from the notes, e.g. "Tournament: … | Final").
  if (match.notes && KNOCKOUT.test(match.notes)) w += 0.6;
  // Stood up in a loss.
  if (match.result === 'lost') w += 0.2;

  return Math.min(w, 2.6);
}

const norm01to1000 = (rows: PressureRow[], key: (r: PressureRow) => number) => {
  const max = Math.max(1, ...rows.map(key));
  rows.forEach(r => { r.index = Math.round((key(r) / max) * 1000); });
};

export function usePressureIndex(
  matches: Match[],
  members: Member[],
  scorecards: MatchScorecard[] | null,
): PressureIndex {
  return useMemo(() => {
    if (!scorecards || scorecards.length === 0 || members.length === 0) {
      return { batting: [], bowling: [], overall: [], pressureMatchCount: 0, loading: !scorecards };
    }

    const matchById: Record<string, Match> = {};
    matches.forEach(m => { matchById[m.id] = m; });
    const memberById: Record<string, Member> = {};
    members.forEach(m => { memberById[m.id] = m; });

    const resolveName = buildNameMatcher(members);
    const memberIdSet = new Set(members.map(m => m.id));
    const resolveRow = (row: BatterRow | BowlerRow): string | null => {
      const byId = CH_PLAYER_TO_MEMBER[row.player_id];
      if (byId && memberIdSet.has(byId)) return byId;
      return resolveName(row.name);
    };

    type Acc = { pRuns: number; rawRuns: number; pInn: number; pWkt: number; rawWkt: number };
    const acc: Record<string, Acc> = {};
    const ensure = (id: string) => (acc[id] ??= { pRuns: 0, rawRuns: 0, pInn: 0, pWkt: 0, rawWkt: 0 });
    const pressureMatches = new Set<string>();

    for (const sc of scorecards) {
      const match = matchById[sc.match_id];
      if (!match || match.match_type === 'internal') continue;
      if (!['won', 'lost', 'draw'].includes(match.result)) continue;

      const P = matchPressure(match);
      // Only matches that carry real pressure count towards the index.
      if (P < 1.25) continue;
      pressureMatches.add(match.id);

      const sccBatting = sc.innings1_team_id === SCC_TEAM_ID ? sc.innings1_batting
                       : sc.innings2_team_id === SCC_TEAM_ID ? sc.innings2_batting : null;
      const sccBowling = sc.innings1_team_id === SCC_TEAM_ID ? sc.innings2_bowling
                       : sc.innings2_team_id === SCC_TEAM_ID ? sc.innings1_bowling : null;

      for (const b of (sccBatting || [])) {
        const id = resolveRow(b);
        if (!id) continue;
        const a = ensure(id);
        a.rawRuns += b.runs || 0;
        a.pRuns += (b.runs || 0) * P;
        if ((b.balls || 0) > 0) a.pInn += 1;
      }
      for (const bo of (sccBowling || [])) {
        const id = resolveRow(bo);
        if (!id) continue;
        const a = ensure(id);
        a.rawWkt += bo.wickets || 0;
        a.pWkt += (bo.wickets || 0) * P;
      }
    }

    const rowsFor = (): PressureRow[] => Object.entries(acc).map(([id, a]) => ({
      member: memberById[id],
      pressureRuns: Math.round(a.pRuns),
      rawRuns: a.rawRuns,
      pInnings: a.pInn,
      pAvg: a.pInn > 0 ? a.rawRuns / a.pInn : 0,
      pressureWkts: Math.round(a.pWkt * 10) / 10,
      rawWkts: a.rawWkt,
      index: 0,
    })).filter(r => r.member);

    const batting = rowsFor().filter(r => r.rawRuns > 0).sort((a, b) => b.pressureRuns - a.pressureRuns);
    const bowling = rowsFor().filter(r => r.rawWkts > 0).sort((a, b) => b.pressureWkts - a.pressureWkts);
    const overall = rowsFor()
      .map(r => ({ ...r, _c: r.pressureRuns + r.pressureWkts * 20 }))
      .filter(r => r._c > 0)
      .sort((a, b) => b._c - a._c);

    norm01to1000(batting, r => r.pressureRuns);
    norm01to1000(bowling, r => r.pressureWkts);
    norm01to1000(overall, r => r.pressureRuns + r.pressureWkts * 20);

    return { batting, bowling, overall, pressureMatchCount: pressureMatches.size, loading: false };
  }, [matches, members, scorecards]);
}
