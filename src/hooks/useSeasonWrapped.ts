import { useMemo } from 'react';
import type { Member } from '../types';
import { useCricketStats } from './useCricketStats';
import { useMOMCounts } from './useMOMCounts';
import { useMembers } from './useMembers';
import { useFantasyPoints } from './useFantasyPoints';
import { usePlayerScorecards } from './usePlayerScorecards';
import { useAchievements } from './useAchievements';
import { useRivalry, suggestRival, type Rivalry } from './useRivalry';

export interface WrappedBadge { emoji: string; title: string; tier?: string }

export interface WrappedData {
  member: Member;
  season: string;
  matches: number;
  // batting
  runs: number;
  runsDelta: number | null;
  strikeRate: number;
  highest: number;
  fifties: number;
  sixes: number;
  // bowling
  wickets: number;
  wicketsDelta: number | null;
  bestFigures: string;
  economy: number;
  // signature moment
  bestKnock: { runs: number; balls: number; opponent: string } | null;
  bestSpell: { wickets: number; runs: number; opponent: string } | null;
  // silverware
  moms: number;
  // ranks
  overallRank: number | null;
  battingRank: number | null;
  bowlingRank: number | null;
  totalRanked: number;
  fantasyTotal: number;
  // badges + rivalry
  badges: WrappedBadge[];
  badgeCount: number;
  rival: Rivalry | null;
}

function rankOf(id: string, ordered: string[]): number | null {
  const i = ordered.indexOf(id);
  return i < 0 ? null : i + 1;
}

/**
 * Assembles a member's "Season Wrapped" — a personal season recap built from
 * existing stats, scorecards, MOMs, achievements and their rivalry.
 */
export function useSeasonWrapped(memberId: string | null, season = '2025-26', prevSeason = '2024-25'): WrappedData | null {
  const { members } = useMembers();
  const { stats } = useCricketStats(season);
  const { stats: prevStats } = useCricketStats(prevSeason);
  const { counts: momCounts } = useMOMCounts();
  const fantasy = useFantasyPoints(stats, members, momCounts);

  const member = members.find(m => m.id === memberId) || null;
  const { knocks, spells } = usePlayerScorecards(member?.name);

  const myStat = stats.find(s => s.member_id === memberId);
  const achievements = useAchievements(myStat, momCounts[memberId || ''] || 0, myStat?.batting_matches || 0);

  const rivalId = useMemo(
    () => (memberId ? suggestRival(memberId, stats, members, momCounts) : null),
    [memberId, stats, members, momCounts],
  );
  const rival = useRivalry(memberId, rivalId, stats, members, momCounts);

  return useMemo(() => {
    if (!member || !memberId) return null;
    const s = myStat;
    const prev = prevStats.find(p => p.member_id === memberId);

    // Ranks (cheap, from this season's stat arrays)
    const byFantasy = [...fantasy].map(f => f.member.id);
    const byRuns = [...stats].filter(x => x.batting_runs > 0).sort((a, b) => b.batting_runs - a.batting_runs).map(x => x.member_id);
    const byWkts = [...stats].filter(x => x.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets).map(x => x.member_id);

    const topKnock = knocks.length ? [...knocks].sort((a, b) => b.runs - a.runs)[0] : null;
    const topSpell = spells.length ? [...spells].sort((a, b) => (b.wickets - a.wickets) || (a.runs - b.runs))[0] : null;

    const fantasyTotal = fantasy.find(f => f.member.id === memberId)?.total ?? 0;

    return {
      member,
      season,
      matches: s?.batting_matches ?? 0,
      runs: s?.batting_runs ?? 0,
      runsDelta: prev ? (s?.batting_runs ?? 0) - prev.batting_runs : null,
      strikeRate: s?.batting_strike_rate ?? 0,
      highest: s?.batting_highest_score ?? 0,
      fifties: (s?.batting_fifties ?? 0) + (s?.batting_hundreds ?? 0),
      sixes: s?.batting_sixes ?? 0,
      wickets: s?.bowling_wickets ?? 0,
      wicketsDelta: prev ? (s?.bowling_wickets ?? 0) - prev.bowling_wickets : null,
      bestFigures: s?.bowling_best_figures || '0/0',
      economy: s?.bowling_economy ?? 0,
      bestKnock: topKnock ? { runs: topKnock.runs, balls: topKnock.balls, opponent: topKnock.opponent } : null,
      bestSpell: topSpell && topSpell.wickets > 0 ? { wickets: topSpell.wickets, runs: topSpell.runs, opponent: topSpell.opponent } : null,
      moms: momCounts[memberId] || 0,
      overallRank: rankOf(memberId, byFantasy),
      battingRank: rankOf(memberId, byRuns),
      bowlingRank: rankOf(memberId, byWkts),
      totalRanked: byFantasy.length,
      fantasyTotal,
      badges: achievements.filter(a => a.unlocked).map(a => ({ emoji: a.emoji, title: a.title, tier: a.tier })),
      badgeCount: achievements.filter(a => a.unlocked).length,
      rival,
    };
  }, [member, memberId, myStat, prevStats, stats, fantasy, knocks, spells, momCounts, achievements, rival, season]);
}
