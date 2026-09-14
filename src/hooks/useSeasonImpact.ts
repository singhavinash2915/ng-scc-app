import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { seasonWindow } from '../config/season';
import { DEFAULT_FORMAT } from '../lib/cricketRules';
import { computeMatchImpact, isClubPlayer, type FieldEvent, type StoredBall } from '../lib/matchImpact';
import { gradeOf, type ImpactGrade } from '../lib/pressure';

// ─── A season of impact ───────────────────────────────────────────────────────
// The per-match impact from lib/matchImpact, added up over every app-scored
// match in the season. Club players only — the opposition placeholders are the
// same ids every match and adding them up would be meaningless.
//
// Empty until matches are scored ball by ball in the app; callers hide their
// section rather than show a table of zeros.

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
      const { data: inns, error } = await supabase.from('scc_innings')
        .select('match_id, innings, batting_team, target, match:matches!inner(id, date, opponent, overs_per_innings, players_per_side, result)')
        .gte('match.date', start).lte('match.date', end);
      if (cancelled) return;
      if (error || !inns?.length) { setRows([]); setMatchCount(0); setLoading(false); return; }

      type Inn = { match_id: string; innings: number; batting_team: string; target: number | null;
        match: { id: string; date: string; opponent: string | null; overs_per_innings: number | null; players_per_side: number | null; result: string } };
      const byMatch = new Map<string, Inn[]>();
      for (const r of inns as unknown as Inn[]) {
        if (['upcoming', 'cancelled'].includes(r.match.result)) continue;   // still live, or never played
        byMatch.set(r.match_id, [...(byMatch.get(r.match_id) ?? []), r]);
      }
      const ids = [...byMatch.keys()];
      if (!ids.length) { setRows([]); setMatchCount(0); setLoading(false); return; }

      const [balls, events] = await Promise.all([
        supabase.from('scc_ball_by_ball').select('*').in('match_id', ids).order('seq').limit(20000),
        supabase.from('scc_field_events').select('match_id, innings, seq, kind, fielder_id, runs').in('match_id', ids),
      ]);
      if (cancelled) return;

      const acc = new Map<string, SeasonImpactRow>();
      let scored = 0;
      for (const [mid, list] of byMatch) {
        const mb = (balls.data ?? []).filter((b: { match_id: string }) => b.match_id === mid) as StoredBall[];
        if (!mb.length) continue;
        scored++;
        const m = list[0].match;
        const fmt = {
          oversPerInnings: m.overs_per_innings ?? DEFAULT_FORMAT.oversPerInnings,
          playersPerSide: m.players_per_side ?? DEFAULT_FORMAT.playersPerSide,
        };
        const ev = events.error ? [] : ((events.data ?? []).filter((e: { match_id: string }) => e.match_id === mid) as FieldEvent[]);
        const imp = computeMatchImpact(list, mb, fmt, ev);
        for (const p of imp.players) {
          if (!isClubPlayer(p.playerId)) continue;
          const r = acc.get(p.playerId) ?? { playerId: p.playerId, matches: 0, total: 0, perMatch: 0, batting: 0, bowling: 0, fielding: 0, best: null };
          r.matches++; r.total += p.total; r.batting += p.batting; r.bowling += p.bowling; r.fielding += p.fielding;
          if (!r.best || p.total > r.best.total) {
            r.best = { total: p.total, matchId: mid, opponent: m.opponent ?? 'Opponent', date: m.date, grade: gradeOf(p.total) };
          }
          acc.set(p.playerId, r);
        }
      }
      const out = [...acc.values()].map(r => ({
        ...r,
        total: +r.total.toFixed(1), batting: +r.batting.toFixed(1), bowling: +r.bowling.toFixed(1),
        fielding: +r.fielding.toFixed(1), perMatch: +(r.total / r.matches).toFixed(1),
      })).sort((a, b) => b.total - a.total);
      setRows(out); setMatchCount(scored); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [season]);

  return { rows, matchCount, loading };
}
