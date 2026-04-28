import { useMemo } from 'react';
import type { Match, Member, MemberCricketStats } from '../types';

export interface PeriodWinner {
  member: Member;
  moms: number;
  matchesPlayedInPeriod: number;
  periodLabel: string;
  tieBroken: boolean;
}

export interface MonthlyWinner {
  month: string;            // 'YYYY-MM'
  monthLabel: string;       // 'Apr 26'
  winner: { member: Member; moms: number } | null;
}

/**
 * Computes "Player of the Month" (current calendar month) and
 * "Player of the Week" (last 7 days), plus a 6-month history.
 *
 * Tie-breaker: when 2+ players have equal MOMs in the period, the player
 * with the higher career MVP score (runs + 20*wickets + 10*fielding) wins.
 */
export function usePlayerOfPeriod(
  matches: Match[],
  members: Member[],
  cricketStats: MemberCricketStats[]
) {
  const memberById = useMemo(() => {
    const m: Record<string, Member> = {};
    members.forEach(x => { m[x.id] = x; });
    return m;
  }, [members]);

  const score = useMemo(() => {
    const cache: Record<string, number> = {};
    cricketStats.forEach(s => {
      cache[s.member_id] = s.batting_runs + s.bowling_wickets * 20 +
        (s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs) * 10;
    });
    return (id: string) => cache[id] || 0;
  }, [cricketStats]);

  const winnerInWindow = (start: Date, end: Date, label: string): PeriodWinner | null => {
    const tally: Record<string, number> = {};
    let matchesInPeriod = 0;
    for (const m of matches) {
      if (!['won', 'lost', 'draw'].includes(m.result)) continue;
      const d = new Date(m.date);
      if (d < start || d > end) continue;
      matchesInPeriod++;
      if (!m.man_of_match_id) continue;
      tally[m.man_of_match_id] = (tally[m.man_of_match_id] || 0) + 1;
    }

    const sorted = Object.entries(tally).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return score(b[0]) - score(a[0]);  // tie-breaker by season MVP score
    });

    if (!sorted.length) return null;
    const [winnerId, count] = sorted[0];
    const member = memberById[winnerId];
    if (!member) return null;

    const tieBroken = sorted.length > 1 && sorted[1][1] === count;
    return { member, moms: count, matchesPlayedInPeriod: matchesInPeriod, periodLabel: label, tieBroken };
  };

  const playerOfMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return winnerInWindow(start, end, now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, memberById, score]);

  const playerOfWeek = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return winnerInWindow(start, now, 'Last 7 days');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, memberById, score]);

  const monthlyHistory = useMemo<MonthlyWinner[]>(() => {
    const now = new Date();
    const result: MonthlyWinner[] = [];
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      const w = winnerInWindow(start, end, '');
      result.push({
        month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        monthLabel: monthDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        winner: w ? { member: w.member, moms: w.moms } : null,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, memberById, score]);

  return { playerOfMonth, playerOfWeek, monthlyHistory };
}
