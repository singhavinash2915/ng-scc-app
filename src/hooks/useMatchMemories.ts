import { useMemo } from 'react';
import type { Match } from '../types';

export interface Memory {
  match: Match;
  yearsAgo: number;
  exact: boolean;    // true = same calendar day; false = around this time of year
  archive?: boolean; // true = a classic pulled from the archives (off-season filler)
}

const num = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

/**
 * Returns nostalgic "throwback" matches from past years.
 *
 * Prefers matches on this EXACT calendar day (true anniversaries). If there are
 * none today, it falls back to matches from AROUND this time of year (±7 days in
 * past years) so there's almost always something to reminisce about — turning a
 * rare "on this day" into a regular weekly nostalgia hit.
 *
 * If memberId is provided, only returns matches where that member played.
 */
export function useMatchMemories(
  matches: Match[],
  memberId?: string,
): Memory[] {
  return useMemo(() => {
    const today = new Date();
    const m = today.getMonth();
    const d = today.getDate();
    const thisYear = today.getFullYear();
    const dayOfYear = (dt: Date) => Math.floor((dt.getTime() - new Date(dt.getFullYear(), 0, 0).getTime()) / 86400000);
    const todayDoy = dayOfYear(today);

    const played = (match: Match) => !memberId || (match.players?.some(p => p.member_id === memberId) ?? false);

    const exact: Memory[] = [];
    const nearby: Array<Memory & { dist: number }> = [];

    for (const match of matches) {
      if (!['won', 'lost', 'draw'].includes(match.result)) continue;
      const md = new Date(match.date);
      const yearsAgo = thisYear - md.getFullYear();
      if (yearsAgo === 0) continue;       // skip this year
      if (!played(match)) continue;

      if (md.getMonth() === m && md.getDate() === d) {
        exact.push({ match, yearsAgo, exact: true });
      } else {
        // distance in days-of-year, wrapping around the year
        const raw = Math.abs(dayOfYear(md) - todayDoy);
        const dist = Math.min(raw, 365 - raw);
        if (dist <= 14) nearby.push({ match, yearsAgo, exact: false, dist });
      }
    }

    if (exact.length > 0) {
      return exact.sort((a, b) => a.yearsAgo - b.yearsAgo);
    }
    if (nearby.length > 0) {
      // Closest-in-the-calendar first, then most recent year
      return nearby
        .sort((a, b) => a.dist - b.dist || a.yearsAgo - b.yearsAgo)
        .map(({ match, yearsAgo, exact }) => ({ match, yearsAgo, exact }));
    }

    // Off-season fallback — nothing around this date (e.g. monsoon break), so pull
    // a couple of classics from the archives: our biggest victories from past years.
    const classics = matches
      .filter(mt => mt.result === 'won' && played(mt) && (thisYear - new Date(mt.date).getFullYear()) >= 1)
      .map(mt => {
        const our = num(mt.our_score), opp = num(mt.opponent_score);
        const margin = our != null && opp != null ? our - opp : 0;
        return { match: mt, yearsAgo: thisYear - new Date(mt.date).getFullYear(), margin };
      })
      .filter(x => x.margin > 0)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 2)
      .map(({ match, yearsAgo }) => ({ match, yearsAgo, exact: false, archive: true }));
    return classics;
  }, [matches, memberId]);
}
