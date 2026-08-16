import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── The match around the balls ────────────────────────────────────────────────
// Balls record deliveries; this records everything else a match needs — who won
// the toss, who's batting, what the target is, and whether an innings is done.
//
// Named per side rather than "Innings 1/2": a scorer reads "SCC Brahmos batting",
// not an ordinal, and so does everyone watching.

export interface InningsRow {
  id: string;
  match_id: string;
  innings: 1 | 2;
  batting_team: string;
  bowling_team: string;
  status: 'live' | 'closed';
  target: number | null;
}

const isMissing = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useMatchInnings(matchId: string | null) {
  const [rows, setRows] = useState<InningsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!matchId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('scc_innings').select('*').eq('match_id', matchId).order('innings');
    if (isMissing(error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);
    setRows((data as InningsRow[]) ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const first = useMemo(() => rows.find(r => r.innings === 1) ?? null, [rows]);
  const second = useMemo(() => rows.find(r => r.innings === 2) ?? null, [rows]);
  /** Nothing set up yet — the scorer still has to do the toss. */
  const notStarted = !loading && rows.length === 0;
  const current = second ?? first;

  /** Toss done: create innings 1 with whoever is batting first. */
  const startMatch = useCallback(async (battingFirst: string, bowlingFirst: string) => {
    if (!matchId) return 'No match';
    const { error } = await supabase.from('scc_innings').insert({
      match_id: matchId, innings: 1,
      batting_team: battingFirst, bowling_team: bowlingFirst, status: 'live',
    });
    if (error) return error.message;
    await fetchRows();
    return null;
  }, [matchId, fetchRows]);

  /** Close innings 1 and open the chase with a target one ahead of the score. */
  const startSecondInnings = useCallback(async (firstInningsRuns: number) => {
    if (!matchId || !first) return 'No first innings';
    const { error: e1 } = await supabase.from('scc_innings')
      .update({ status: 'closed' }).eq('id', first.id);
    if (e1) return e1.message;
    const { error: e2 } = await supabase.from('scc_innings').insert({
      match_id: matchId, innings: 2,
      batting_team: first.bowling_team, bowling_team: first.batting_team,
      status: 'live', target: firstInningsRuns + 1,
    });
    if (e2) return e2.message;
    await fetchRows();
    return null;
  }, [matchId, first, fetchRows]);

  const closeInnings = useCallback(async (innings: 1 | 2) => {
    const row = rows.find(r => r.innings === innings);
    if (!row) return;
    await supabase.from('scc_innings').update({ status: 'closed' }).eq('id', row.id);
    await fetchRows();
  }, [rows, fetchRows]);

  /**
   * Write the result back to `matches` so the rest of the app — standings,
   * records, the MahaSangram table — sees it like any other finished match.
   * scoring_source marks it app-scored so the CricHeroes sync leaves it alone.
   */
  const finishMatch = useCallback(async (opts: {
    winningTeam: string | null;
    ourScore: string;
    opponentScore: string;
    momId: string | null;
    result: 'won' | 'lost' | 'draw';
  }) => {
    if (!matchId) return 'No match';
    const { error } = await supabase.from('matches').update({
      result: opts.result,
      winning_team: opts.winningTeam,
      our_score: opts.ourScore,
      opponent_score: opts.opponentScore,
      man_of_match_id: opts.momId,
      scoring_source: 'app',
    }).eq('id', matchId);
    if (error) return error.message;
    return null;
  }, [matchId]);

  return {
    rows, first, second, current, notStarted, loading, tableMissing,
    startMatch, startSecondInnings, closeInnings, finishMatch, refetch: fetchRows,
  };
}
