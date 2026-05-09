import { useMemo } from 'react';
import type { Match } from '../types';

export interface Memory {
  match: Match;
  yearsAgo: number;
}

/**
 * Returns matches that happened on this exact same calendar day in past years.
 * Used for "On this day, X years ago" memory banner + section.
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

    const memories: Memory[] = [];
    for (const match of matches) {
      if (!['won', 'lost', 'draw'].includes(match.result)) continue;
      const md = new Date(match.date);
      if (md.getMonth() !== m || md.getDate() !== d) continue;
      const yearsAgo = thisYear - md.getFullYear();
      if (yearsAgo === 0) continue;  // skip same-year (today's match)
      if (memberId) {
        const played = match.players?.some(p => p.member_id === memberId);
        if (!played) continue;
      }
      memories.push({ match, yearsAgo });
    }
    return memories.sort((a, b) => a.yearsAgo - b.yearsAgo);
  }, [matches, memberId]);
}
