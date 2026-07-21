import { useMemo } from 'react';
import type { Match, Member } from '../types';
import type { MatchScorecard } from './useMatchScorecard';
import { useSccRankings } from './useSccRankings';

// ─── Player Market Value ───────────────────────────────────────────────────────
// A fun, auction-style "price tag" for every player, derived from the ICC-style
// SCC Rankings (all-time mode = time-decayed, so it tracks current form).
// A player's value is driven by their BEST discipline rating (bat / bowl /
// all-round), mapped onto a ₹ scale with tier labels for the auction table.

export interface ValuedPlayer {
  member: Member;
  rating: number;          // best discipline rating 0–1000
  discipline: 'Batter' | 'Bowler' | 'All-Rounder';
  valueLakh: number;       // in ₹ lakh
  tier: { label: string; emoji: string; cls: string };
}

const TIERS = [
  { min: 750, label: 'Marquee', emoji: '💎', cls: 'bg-violet-100 text-violet-700' },
  { min: 500, label: 'Gold',    emoji: '🥇', cls: 'bg-amber-100 text-amber-700' },
  { min: 250, label: 'Silver',  emoji: '🥈', cls: 'bg-slate-100 text-slate-600' },
  { min: 0,   label: 'Bronze',  emoji: '🥉', cls: 'bg-orange-100 text-orange-700' },
];

export function formatValue(lakh: number): string {
  return lakh >= 100 ? `₹${(lakh / 100).toFixed(2)} Cr` : `₹${Math.round(lakh)} L`;
}

export function useMarketValue(
  matches: Match[],
  members: Member[],
  scorecards: MatchScorecard[] | null,
): ValuedPlayer[] {
  const rankings = useSccRankings(matches, members, scorecards, 'all');

  return useMemo(() => {
    // best rating per member across disciplines
    const best: Record<string, { rating: number; discipline: ValuedPlayer['discipline']; member: Member }> = {};
    const consider = (list: typeof rankings.batters, discipline: ValuedPlayer['discipline']) => {
      for (const r of list) {
        const cur = best[r.member.id];
        if (!cur || r.rating > cur.rating) best[r.member.id] = { rating: r.rating, discipline, member: r.member };
      }
    };
    consider(rankings.batters, 'Batter');
    consider(rankings.bowlers, 'Bowler');
    consider(rankings.allRounders, 'All-Rounder');

    return Object.values(best)
      .map(({ member, rating, discipline }) => ({
        member,
        rating,
        discipline,
        // ₹5L base + ₹0.45L per rating point → top player ≈ ₹4.5 Cr
        valueLakh: 5 + rating * 0.45,
        tier: TIERS.find(t => rating >= t.min) ?? TIERS[TIERS.length - 1],
      }))
      .sort((a, b) => b.valueLakh - a.valueLakh);
  }, [rankings]);
}
