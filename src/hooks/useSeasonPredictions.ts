import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── Pre-season Predictions ────────────────────────────────────────────────────
// One prediction slip per member per season: top run-scorer, top wicket-taker,
// MVP, and how many league games we win. Slips lock the moment the season's
// first ball is bowled (checked by the caller) and are scored in June.

export interface SeasonPredictionRow {
  id: string;
  season: string;
  member_id: string;
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mvp_id: string | null;
  predicted_wins: number | null;
}

const isMissingTable = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message);

export function useSeasonPredictions(season: string) {
  const [rows, setRows] = useState<SeasonPredictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('season_predictions')
      .select('*')
      .eq('season', season);
    if (error) {
      if (isMissingTable(error)) setTableMissing(true);
      setRows([]);
    } else {
      setTableMissing(false);
      setRows((data as SeasonPredictionRow[]) || []);
    }
    setLoading(false);
  }, [season]);

  useEffect(() => { fetch(); }, [fetch]);

  const submit = useCallback(async (input: {
    memberId: string;
    topScorerId: string | null;
    topWicketTakerId: string | null;
    mvpId: string | null;
    predictedWins: number | null;
  }) => {
    const { error } = await supabase
      .from('season_predictions')
      .upsert({
        season,
        member_id: input.memberId,
        top_scorer_id: input.topScorerId,
        top_wicket_taker_id: input.topWicketTakerId,
        mvp_id: input.mvpId,
        predicted_wins: input.predictedWins,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'season,member_id' });
    if (error) return { success: false, error: error.message };
    await fetch();
    return { success: true };
  }, [season, fetch]);

  const myPrediction = useCallback(
    (memberId: string | null) => (memberId ? rows.find(r => r.member_id === memberId) ?? null : null),
    [rows],
  );

  // Community tallies: who the squad is backing in each category.
  const tally = useMemo(() => {
    const count = (key: 'top_scorer_id' | 'top_wicket_taker_id' | 'mvp_id') => {
      const m = new Map<string, number>();
      rows.forEach(r => { const id = r[key]; if (id) m.set(id, (m.get(id) || 0) + 1); });
      return [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
    };
    const wins = rows.map(r => r.predicted_wins).filter((n): n is number => n != null);
    return {
      topScorer: count('top_scorer_id'),
      topWicketTaker: count('top_wicket_taker_id'),
      mvp: count('mvp_id'),
      avgWins: wins.length ? wins.reduce((s, n) => s + n, 0) / wins.length : null,
      slips: rows.length,
    };
  }, [rows]);

  return { rows, loading, tableMissing, submit, myPrediction, tally };
}
