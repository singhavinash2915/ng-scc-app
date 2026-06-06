import { useMemo } from 'react';
import type { MemberCricketStats, Member } from '../types';

export interface Milestone {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  memberName: string;
  memberId: string;
  avatarUrl: string | null;
  value: number;
  threshold: number;
  category: 'batting' | 'bowling' | 'fielding' | 'mom' | 'matches';
}

const THRESHOLDS = {
  runs:    [500, 1000, 1500, 2000, 2500, 3000],
  wickets: [25, 50, 75, 100, 125, 150],
  catches: [10, 25, 50, 75, 100],
  matches: [25, 50, 75, 100, 125, 150],
  sixes:   [25, 50, 100, 150, 200],
  fours:   [50, 100, 150, 200],
  moms:    [5, 10, 15, 20],
};

function findCrossed(value: number, thresholds: number[]): number | null {
  // Return the highest threshold this value has crossed
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i]) return thresholds[i];
  }
  return null;
}

/**
 * Detects career milestones from stats. Returns recently-crossed milestones
 * sorted by value (highest achievement first).
 */
export function useMilestones(
  stats: MemberCricketStats[],
  members: Member[],
  momCounts: Record<string, number>,
): Milestone[] {
  return useMemo(() => {
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));
    const milestones: Milestone[] = [];

    for (const s of stats) {
      const m = memberById[s.member_id] || (s.member as Member);
      if (!m) continue;
      const name = m.name;
      const avatar = m.avatar_url;
      const id = s.member_id;

      const runsCrossed = findCrossed(s.batting_runs, THRESHOLDS.runs);
      if (runsCrossed) {
        milestones.push({
          id: `${id}-runs-${runsCrossed}`, emoji: '🏏', title: `${runsCrossed}+ Career Runs!`,
          desc: `${name} has scored ${s.batting_runs} runs`, memberName: name, memberId: id,
          avatarUrl: avatar, value: s.batting_runs, threshold: runsCrossed, category: 'batting',
        });
      }

      const wktsCrossed = findCrossed(s.bowling_wickets, THRESHOLDS.wickets);
      if (wktsCrossed) {
        milestones.push({
          id: `${id}-wkts-${wktsCrossed}`, emoji: '⚡', title: `${wktsCrossed}+ Career Wickets!`,
          desc: `${name} has taken ${s.bowling_wickets} wickets`, memberName: name, memberId: id,
          avatarUrl: avatar, value: s.bowling_wickets, threshold: wktsCrossed, category: 'bowling',
        });
      }

      const catchesCrossed = findCrossed(s.fielding_catches, THRESHOLDS.catches);
      if (catchesCrossed) {
        milestones.push({
          id: `${id}-catches-${catchesCrossed}`, emoji: '🧤', title: `${catchesCrossed}+ Catches!`,
          desc: `${name} has taken ${s.fielding_catches} catches`, memberName: name, memberId: id,
          avatarUrl: avatar, value: s.fielding_catches, threshold: catchesCrossed, category: 'fielding',
        });
      }

      const matchesCrossed = findCrossed(s.batting_matches, THRESHOLDS.matches);
      if (matchesCrossed) {
        milestones.push({
          id: `${id}-matches-${matchesCrossed}`, emoji: '💪', title: `${matchesCrossed}+ Matches!`,
          desc: `${name} has played ${s.batting_matches} matches`, memberName: name, memberId: id,
          avatarUrl: avatar, value: s.batting_matches, threshold: matchesCrossed, category: 'matches',
        });
      }

      const sixesCrossed = findCrossed(s.batting_sixes, THRESHOLDS.sixes);
      if (sixesCrossed) {
        milestones.push({
          id: `${id}-sixes-${sixesCrossed}`, emoji: '🔥', title: `${sixesCrossed}+ Sixes!`,
          desc: `${name} has hit ${s.batting_sixes} sixes`, memberName: name, memberId: id,
          avatarUrl: avatar, value: s.batting_sixes, threshold: sixesCrossed, category: 'batting',
        });
      }

      const momCount = momCounts[id] || 0;
      const momCrossed = findCrossed(momCount, THRESHOLDS.moms);
      if (momCrossed) {
        milestones.push({
          id: `${id}-mom-${momCrossed}`, emoji: '👑', title: `${momCrossed}+ MOM Awards!`,
          desc: `${name} has won ${momCount} Man of the Match awards`, memberName: name, memberId: id,
          avatarUrl: avatar, value: momCount, threshold: momCrossed, category: 'mom',
        });
      }
    }

    return milestones.sort((a, b) => b.value - a.value);
  }, [stats, members, momCounts]);
}
