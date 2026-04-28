import { useMemo } from 'react';
import type { Match } from '../types';

export interface H2HRecord {
  opponent: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  winRate: number;        // %
  lastResult: 'won' | 'lost' | 'draw' | null;
  lastDate: string | null;
}

/**
 * Compute head-to-head record vs every opponent, derived from the matches array.
 * Excludes internal matches and unfinished/cancelled matches.
 */
export function useHeadToHead(matches: Match[]): H2HRecord[] {
  return useMemo(() => {
    const ext = matches.filter(m =>
      m.match_type === 'external' &&
      ['won', 'lost', 'draw'].includes(m.result) &&
      m.opponent
    );

    const groups: Record<string, Match[]> = {};
    for (const m of ext) {
      const key = (m.opponent || 'Unknown').trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const records: H2HRecord[] = Object.entries(groups).map(([opponent, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const won = list.filter(m => m.result === 'won').length;
      const lost = list.filter(m => m.result === 'lost').length;
      const drawn = list.filter(m => m.result === 'draw').length;
      const last = sorted[0];
      return {
        opponent,
        played: list.length,
        won, lost, drawn,
        winRate: list.length ? Math.round((won / list.length) * 100) : 0,
        lastResult: (last?.result as 'won' | 'lost' | 'draw') || null,
        lastDate: last?.date || null,
      };
    });

    // Sort: most encounters first, then alphabetical
    return records.sort((a, b) => {
      if (b.played !== a.played) return b.played - a.played;
      return a.opponent.localeCompare(b.opponent);
    });
  }, [matches]);
}
