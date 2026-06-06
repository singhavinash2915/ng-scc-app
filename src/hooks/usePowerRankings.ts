import { useMemo } from 'react';
import type { Match, Member, MemberCricketStats } from '../types';

export interface PowerRankedPlayer {
  member: Member;
  rating: number;        // 0-100 composite score
  prevRating: number;    // for movement indicator
  movement: number;      // +/- change
  recentForm: number;    // recent 5 match weighted score
  seasonPoints: number;  // full season points
  rank: number;
}

/**
 * Weekly Power Rankings — weighted recent form more than career.
 * Last 5 matches = 60% weight, rest of season = 40%.
 * Based on: runs scored, wickets taken, catches, MOMs.
 */
export function usePowerRankings(
  matches: Match[],
  members: Member[],
  stats: MemberCricketStats[],
  momCounts: Record<string, number>,
): PowerRankedPlayer[] {
  return useMemo(() => {
    if (!stats.length || !members.length) return [];

    const memberById = Object.fromEntries(members.map(m => [m.id, m]));

    // Completed external matches sorted newest first
    const completed = matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result) && m.match_type !== 'internal')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const last5 = completed.slice(0, 5);
    // last5 used for recent-form scoring below

    // For each member, compute recent-match participation score
    const recentScores: Record<string, number> = {};
    for (const match of last5) {
      if (!match.players) continue;
      for (const p of match.players) {
        if (!recentScores[p.member_id]) recentScores[p.member_id] = 0;
        // Base points for playing
        recentScores[p.member_id] += 10;
        // Bonus for winning
        if (match.result === 'won') recentScores[p.member_id] += 5;
        // MOM bonus
        if (match.man_of_match_id === p.member_id) recentScores[p.member_id] += 20;
      }
    }

    return stats
      .map(s => {
        const member = memberById[s.member_id] || (s.member as Member);
        if (!member) return null;

        const moms = momCounts[s.member_id] || 0;

        // Season score: batting + bowling + fielding + moms
        const seasonPoints =
          s.batting_runs * 0.5 +
          s.bowling_wickets * 15 +
          s.fielding_catches * 5 +
          s.fielding_run_outs * 5 +
          moms * 20 +
          s.batting_sixes * 2 +
          s.batting_fifties * 10 +
          s.batting_hundreds * 30;

        const recentForm = recentScores[s.member_id] || 0;

        // Weighted: 60% recent, 40% season (normalised)
        const maxSeason = Math.max(...stats.map(x => x.batting_runs * 0.5 + x.bowling_wickets * 15 + (momCounts[x.member_id] || 0) * 20), 1);
        const normSeason = (seasonPoints / maxSeason) * 100;
        const maxRecent = Math.max(...Object.values(recentScores), 1);
        const normRecent = (recentForm / maxRecent) * 100;

        const rating = Math.round(normRecent * 0.6 + normSeason * 0.4);

        return { member, rating, prevRating: rating, movement: 0, recentForm, seasonPoints, rank: 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b!.rating - a!.rating)
      .slice(0, 20)
      .map((p, i) => ({ ...p!, rank: i + 1 })) as PowerRankedPlayer[];
  }, [matches, members, stats, momCounts]);
}
