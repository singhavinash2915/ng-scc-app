import { useMemo } from 'react';
import { useCricketStats } from './useCricketStats';
import type { CardStats } from '../lib/playerCard';

// ─── Card data, in one place ──────────────────────────────────────────────────
// A tier is a position among peers, so every screen drawing a card needs the
// WHOLE squad's numbers, not just the player in front of it. Left to each
// screen, that mapping gets rewritten slightly differently each time and the
// same player quietly ends up Elite on one page and Pro on another.
//
// Reads the existing stats hook, which is already cached — so adding cards to
// another screen costs no extra fetches.

export function useCardStats(season: string = 'all') {
  const { stats } = useCricketStats(season);

  const all = useMemo<CardStats[]>(() => stats.map(s => ({
    memberId: s.member_id,
    runs: s.batting_runs,
    wickets: s.bowling_wickets,
    matches: s.batting_matches ?? 0,
  })), [stats]);

  /** Never returns undefined: a member with no stats is a real case — they've
   *  joined and not played yet — and they still get a card. */
  const statsFor = useMemo(() => {
    const byId = new Map(all.map(c => [c.memberId, c]));
    return (id: string): CardStats =>
      byId.get(id) ?? { memberId: id, runs: 0, wickets: 0, matches: 0 };
  }, [all]);

  return { all, statsFor };
}
