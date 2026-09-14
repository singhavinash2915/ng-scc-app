import { useEffect, useState } from 'react';
import { seasonWindow } from '../config/season';
import { loadSeasonBalls } from '../lib/matchBalls';
import { computeMatchImpact } from '../lib/matchImpact';
import { gradeOf, type ImpactGrade } from '../lib/pressure';

// ─── A season of impact ───────────────────────────────────────────────────────
// The per-match impact from lib/matchImpact, added up by MEMBER over every match
// in the season that has balls: CricHeroes matches through the rebuild, pad
// matches directly. Guests and opponents are left out — only a player the name
// matcher can put on a member, from our side of the match, is counted.

export interface SeasonImpactRow {
  playerId: string;
  matches: number;
  total: number;
  perMatch: number;
  batting: number;
  bowling: number;
  fielding: number;
  best: { total: number; matchId: string; opponent: string; date: string; grade: ImpactGrade } | null;
}

export function useSeasonImpact(season: string) {
  const [rows, setRows] = useState<SeasonImpactRow[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { start, end } = seasonWindow(season);
      const matches = await loadSeasonBalls(start, end).catch(() => []);
      if (cancelled) return;

      const acc = new Map<string, SeasonImpactRow>();
      for (const mb of matches) {
        const imp = computeMatchImpact(mb.rows, mb.balls, mb.fmt, mb.events);
        for (const p of imp.players) {
          if (!mb.isClubSide(imp.sideOf[p.playerId] ?? '')) continue;
          const member = mb.memberOf(p.playerId);
          if (!member) continue;
          const r = acc.get(member) ?? { playerId: member, matches: 0, total: 0, perMatch: 0, batting: 0, bowling: 0, fielding: 0, best: null };
          r.matches++; r.total += p.total; r.batting += p.batting; r.bowling += p.bowling; r.fielding += p.fielding;
          if (!r.best || p.total > r.best.total) {
            r.best = { total: p.total, matchId: mb.matchId, opponent: mb.opponent, date: mb.date, grade: gradeOf(p.total) };
          }
          acc.set(member, r);
        }
      }
      const out = [...acc.values()].map(r => ({
        ...r,
        total: +r.total.toFixed(1), batting: +r.batting.toFixed(1), bowling: +r.bowling.toFixed(1),
        fielding: +r.fielding.toFixed(1), perMatch: +(r.total / r.matches).toFixed(1),
      })).sort((a, b) => b.total - a.total);
      setRows(out); setMatchCount(matches.length); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [season]);

  return { rows, matchCount, loading };
}
