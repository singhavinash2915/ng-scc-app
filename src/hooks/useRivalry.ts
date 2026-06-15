import { useMemo } from 'react';
import type { Member, MemberCricketStats } from '../types';
import { useFantasyPoints } from './useFantasyPoints';

export interface RivalrySide {
  member: Member;
  runs: number;
  wickets: number;
  moms: number;
  matches: number;
  battingAvg: number;
  highest: number;
  catches: number;
  fantasy: number;
}

export interface RivalryCategory {
  label: string;
  aNum: number;
  bNum: number;
  aText: string;
  bText: string;
  winner: 'a' | 'b' | 'tie';
}

export interface Rivalry {
  a: RivalrySide;
  b: RivalrySide;
  categories: RivalryCategory[];
  aWins: number;
  bWins: number;
  leader: 'a' | 'b' | 'tie';
  banter: string;
}

function sideOf(member: Member, stat: MemberCricketStats | undefined, moms: number, fantasy: number): RivalrySide {
  return {
    member,
    runs: stat?.batting_runs ?? 0,
    wickets: stat?.bowling_wickets ?? 0,
    moms,
    matches: stat?.batting_matches ?? 0,
    battingAvg: stat?.batting_average ?? 0,
    highest: stat?.batting_highest_score ?? 0,
    catches: stat?.fielding_catches ?? 0,
    fantasy,
  };
}

/**
 * Head-to-head rivalry between two SCC members for a season.
 * Compares the headline categories and crowns a leader, with auto banter.
 */
export function useRivalry(
  aId: string | null,
  bId: string | null,
  stats: MemberCricketStats[],
  members: Member[],
  momCounts: Record<string, number>,
): Rivalry | null {
  const fantasy = useFantasyPoints(stats, members, momCounts);

  return useMemo(() => {
    if (!aId || !bId || aId === bId) return null;
    const memberA = members.find(m => m.id === aId);
    const memberB = members.find(m => m.id === bId);
    if (!memberA || !memberB) return null;

    const statA = stats.find(s => s.member_id === aId);
    const statB = stats.find(s => s.member_id === bId);
    const fanById: Record<string, number> = {};
    fantasy.forEach(f => { fanById[f.member.id] = f.total; });

    const a = sideOf(memberA, statA, momCounts[aId] || 0, fanById[aId] || 0);
    const b = sideOf(memberB, statB, momCounts[bId] || 0, fanById[bId] || 0);

    const cat = (label: string, aNum: number, bNum: number, fmt: (n: number) => string = String): RivalryCategory => ({
      label,
      aNum, bNum,
      aText: fmt(aNum), bText: fmt(bNum),
      winner: aNum === bNum ? 'tie' : aNum > bNum ? 'a' : 'b',
    });

    const categories: RivalryCategory[] = [
      cat('Runs', a.runs, b.runs),
      cat('Wickets', a.wickets, b.wickets),
      cat('Bat avg', a.battingAvg, b.battingAvg, n => n.toFixed(1)),
      cat('High score', a.highest, b.highest),
      cat('Catches', a.catches, b.catches),
      cat('MOM awards', a.moms, b.moms),
      cat('Fantasy pts', a.fantasy, b.fantasy, n => Math.round(n).toLocaleString('en-IN')),
    ];

    const aWins = categories.filter(c => c.winner === 'a').length;
    const bWins = categories.filter(c => c.winner === 'b').length;
    const leader: 'a' | 'b' | 'tie' = aWins === bWins ? 'tie' : aWins > bWins ? 'a' : 'b';

    const firstA = memberA.name.split(' ')[0];
    const firstB = memberB.name.split(' ')[0];
    let banter: string;
    if (leader === 'tie') {
      banter = `Dead heat — ${firstA} and ${firstB} are neck and neck this season. 🤝`;
    } else {
      const winName = leader === 'a' ? firstA : firstB;
      const loseName = leader === 'a' ? firstB : firstA;
      const margin = Math.abs(aWins - bWins);
      banter = margin >= 5
        ? `${winName} is running away with it — owns ${loseName} ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)} this season. 🔥`
        : margin >= 3
          ? `${winName} has the upper hand over ${loseName}, ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}. 💪`
          : `Tight rivalry — ${winName} just edges ${loseName} ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}. 👀`;
    }

    return { a, b, categories, aWins, bWins, leader, banter };
  }, [aId, bId, stats, members, momCounts, fantasy]);
}

/** Auto-pick the closest rival to a player: nearest overall strength among teammates. */
export function suggestRival(
  aId: string,
  stats: MemberCricketStats[],
  members: Member[],
  momCounts: Record<string, number>,
): string | null {
  const withStats = stats.filter(s => s.member_id !== aId && members.some(m => m.id === s.member_id));
  const me = stats.find(s => s.member_id === aId);
  if (!me || withStats.length === 0) return null;
  const score = (s: MemberCricketStats) => s.batting_runs + s.bowling_wickets * 20 + (momCounts[s.member_id] || 0) * 25;
  const myScore = score(me);
  let best: { id: string; diff: number } | null = null;
  for (const s of withStats) {
    const diff = Math.abs(score(s) - myScore);
    if (!best || diff < best.diff) best = { id: s.member_id, diff };
  }
  return best?.id ?? null;
}
