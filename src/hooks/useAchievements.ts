import { useMemo } from 'react';
import type { MemberCricketStats } from '../types';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress?: { current: number; target: number };  // for tier achievements
  category: 'batting' | 'bowling' | 'fielding' | 'mom' | 'matches' | 'special';
  tier?: 'bronze' | 'silver' | 'gold' | 'diamond';
}

function parseHighest(s: number | string | null | undefined): number {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  return parseInt(String(s).replace('*', '')) || 0;
}

function parseBowlingWkts(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).match(/(\d+)\/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

/**
 * Computes which of the 18 SCC achievements a player has unlocked
 * based on their season cricket stats + MOM count.
 */
export function useAchievements(
  stats: MemberCricketStats | null | undefined,
  momCount: number,
  matchesPlayed: number,
): Achievement[] {
  return useMemo(() => {
    const s = stats || ({} as MemberCricketStats);
    const runs = s.batting_runs || 0;
    const wickets = s.bowling_wickets || 0;
    const catches = s.fielding_catches || 0;
    const stumpings = s.fielding_stumpings || 0;
    const runOuts = s.fielding_run_outs || 0;
    const dismissals = catches + stumpings + runOuts;
    const highest = parseHighest(s.batting_highest_score);
    const bestBowlWkts = parseBowlingWkts(s.bowling_best_figures);
    const fifties = s.batting_fifties || 0;
    const hundreds = s.batting_hundreds || 0;
    const sixes = s.batting_sixes || 0;
    const fours = s.batting_fours || 0;
    const fiveWkts = s.bowling_five_wickets || 0;

    return [
      // ── BATTING ────────────────────────────────────────────────
      { id: 'first_50', emoji: '🏏', title: 'Half-Century', desc: 'Score 50+ in a single innings', unlocked: highest >= 50, category: 'batting', tier: 'silver' },
      { id: 'century', emoji: '💯', title: 'Century Maker', desc: 'Score 100+ in a single innings', unlocked: highest >= 100, category: 'batting', tier: 'gold' },
      { id: 'runs_100', emoji: '🎯', title: 'Run Machine', desc: '100 runs in the season', unlocked: runs >= 100, progress: { current: runs, target: 100 }, category: 'batting', tier: 'bronze' },
      { id: 'runs_500', emoji: '🚀', title: 'Top of the Order', desc: '500 runs in the season', unlocked: runs >= 500, progress: { current: runs, target: 500 }, category: 'batting', tier: 'silver' },
      { id: 'runs_1000', emoji: '🏆', title: '1K Club', desc: '1000 runs in the season', unlocked: runs >= 1000, progress: { current: runs, target: 1000 }, category: 'batting', tier: 'gold' },
      { id: 'runs_2000', emoji: '👑', title: 'Legend Mode', desc: '2000 runs in the season', unlocked: runs >= 2000, progress: { current: runs, target: 2000 }, category: 'batting', tier: 'diamond' },
      { id: 'big_hitter', emoji: '🔥', title: 'Big Hitter', desc: '20+ sixes in the season', unlocked: sixes >= 20, progress: { current: sixes, target: 20 }, category: 'batting', tier: 'silver' },

      // ── BOWLING ────────────────────────────────────────────────
      { id: 'five_for', emoji: '⚡', title: 'Five-for', desc: '5+ wickets in a match', unlocked: bestBowlWkts >= 5, category: 'bowling', tier: 'gold' },
      { id: 'wickets_10', emoji: '🎯', title: 'Strike Bowler', desc: '10 wickets in the season', unlocked: wickets >= 10, progress: { current: wickets, target: 10 }, category: 'bowling', tier: 'bronze' },
      { id: 'wickets_25', emoji: '⚡', title: 'Wicket Hunter', desc: '25 wickets in the season', unlocked: wickets >= 25, progress: { current: wickets, target: 25 }, category: 'bowling', tier: 'silver' },
      { id: 'wickets_50', emoji: '🌪️', title: 'Bowling Beast', desc: '50 wickets in the season', unlocked: wickets >= 50, progress: { current: wickets, target: 50 }, category: 'bowling', tier: 'gold' },

      // ── FIELDING ───────────────────────────────────────────────
      { id: 'catches_10', emoji: '🧤', title: 'Safe Hands', desc: '10 catches in the season', unlocked: catches >= 10, progress: { current: catches, target: 10 }, category: 'fielding', tier: 'bronze' },
      { id: 'dismissals_25', emoji: '🪤', title: 'Field Captain', desc: '25 dismissals (catches + stumpings + run-outs)', unlocked: dismissals >= 25, progress: { current: dismissals, target: 25 }, category: 'fielding', tier: 'silver' },

      // ── MOM ────────────────────────────────────────────────────
      { id: 'first_mom', emoji: '👑', title: 'First MOM', desc: 'Win your first Man of the Match', unlocked: momCount >= 1, category: 'mom', tier: 'bronze' },
      { id: 'mom_5', emoji: '🥇', title: 'Match-Winner', desc: '5 Man of the Match awards', unlocked: momCount >= 5, progress: { current: momCount, target: 5 }, category: 'mom', tier: 'silver' },
      { id: 'mom_10', emoji: '👑', title: 'Most Valuable', desc: '10 Man of the Match awards', unlocked: momCount >= 10, progress: { current: momCount, target: 10 }, category: 'mom', tier: 'gold' },

      // ── PARTICIPATION & SPECIAL ─────────────────────────────────
      { id: 'iron_man', emoji: '💪', title: 'Iron Man', desc: 'Played 30+ matches', unlocked: matchesPlayed >= 30, progress: { current: matchesPlayed, target: 30 }, category: 'matches', tier: 'silver' },
      {
        id: 'all_rounder', emoji: '🌟', title: 'Triple Threat',
        desc: '300+ runs · 10+ wickets · 5+ dismissals',
        unlocked: runs >= 300 && wickets >= 10 && dismissals >= 5,
        category: 'special', tier: 'gold',
      },
      {
        id: 'milestone_club', emoji: '🎖️', title: 'Milestone Club',
        desc: 'Score a 50, take 5-for, hold 10 catches in same season',
        unlocked: highest >= 50 && bestBowlWkts >= 5 && catches >= 10,
        category: 'special', tier: 'diamond',
      },
      { id: 'ton_of_fours', emoji: '🟦', title: 'Boundary Specialist', desc: '50+ fours in the season', unlocked: fours >= 50, progress: { current: fours, target: 50 }, category: 'batting', tier: 'silver' },
      { id: 'fifties_5', emoji: '5️⃣0️⃣', title: 'Consistent Star', desc: 'Score five 50s in a season', unlocked: fifties >= 5, progress: { current: fifties, target: 5 }, category: 'batting', tier: 'gold' },
      { id: 'hundreds_3', emoji: '💯', title: 'Hundred Trio', desc: 'Score three 100s in a season', unlocked: hundreds >= 3, progress: { current: hundreds, target: 3 }, category: 'batting', tier: 'diamond' },
      { id: 'five_wkts_3', emoji: '⚡', title: 'Strike Force', desc: 'Take 3 five-wicket hauls', unlocked: fiveWkts >= 3, progress: { current: fiveWkts, target: 3 }, category: 'bowling', tier: 'gold' },
    ];
  }, [stats, momCount, matchesPlayed]);
}
