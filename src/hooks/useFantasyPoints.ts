import { useMemo } from 'react';
import type { MemberCricketStats, Member } from '../types';

/**
 * Fantasy Points System — auto-calculated from CricHeroes stats.
 *
 * Scoring:
 *   Batting:  1pt per run, +10 for 50, +25 for 100, +2 per four, +3 per six
 *   Bowling:  25pt per wicket, +15 for 5-for, -1pt per 10 runs conceded
 *   Fielding: 10pt per catch, 15pt per stumping, 10pt per run-out
 *   MOM:      25pt bonus
 */

const FANTASY = {
  runPt: 1,
  fiftyBonus: 10,
  centuryBonus: 25,
  fourPt: 2,
  sixPt: 3,
  duckPenalty: -5,
  wicketPt: 25,
  fiveForBonus: 15,
  runsConcededPenalty: -0.1,  // per run conceded
  catchPt: 10,
  stumpingPt: 15,
  runOutPt: 10,
  momBonus: 25,
};

export interface FantasyPlayer {
  member: Member;
  stats: MemberCricketStats;
  breakdown: {
    batting: number;
    bowling: number;
    fielding: number;
    bonus: number;
  };
  total: number;
  momCount: number;
}

export function useFantasyPoints(
  stats: MemberCricketStats[],
  members: Member[],
  momCounts: Record<string, number>,
): FantasyPlayer[] {
  return useMemo(() => {
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));

    return stats
      .map(s => {
        const member = memberById[s.member_id] || (s.member as Member);
        if (!member) return null;

        const momCount = momCounts[s.member_id] || 0;

        const batting =
          s.batting_runs * FANTASY.runPt +
          s.batting_fifties * FANTASY.fiftyBonus +
          s.batting_hundreds * FANTASY.centuryBonus +
          s.batting_fours * FANTASY.fourPt +
          s.batting_sixes * FANTASY.sixPt +
          s.batting_ducks * FANTASY.duckPenalty;

        const bowling =
          s.bowling_wickets * FANTASY.wicketPt +
          s.bowling_five_wickets * FANTASY.fiveForBonus +
          Math.round(s.bowling_runs_conceded * FANTASY.runsConcededPenalty);

        const fielding =
          s.fielding_catches * FANTASY.catchPt +
          s.fielding_stumpings * FANTASY.stumpingPt +
          s.fielding_run_outs * FANTASY.runOutPt;

        const bonus = momCount * FANTASY.momBonus;

        const total = batting + bowling + fielding + bonus;

        return { member, stats: s, breakdown: { batting, bowling, fielding, bonus }, total, momCount };
      })
      .filter(Boolean)
      .sort((a, b) => b!.total - a!.total) as FantasyPlayer[];
  }, [stats, members, momCounts]);
}

export { FANTASY as FANTASY_POINTS };
