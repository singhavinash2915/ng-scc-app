import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// 'dhurandars' / 'bazigars' are used for internal (SCC vs SCC) matches
export type PredictionWinner = 'scc' | 'opponent' | 'draw' | 'dhurandars' | 'bazigars';

// Bonus prediction option types
export type ScoreRange     = 'under_100' | '100_110' | '110_125' | 'over_125';
export type YesNo          = 'yes' | 'no';

export interface MatchPrediction {
  id: string;
  match_id: string;
  member_id: string;
  winner: PredictionWinner | null;
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mom_id: string | null;
  // Bonus questions
  score_range:      ScoreRange | null;
  fifty_scored:     YesNo | null;
  three_wicket_haul: YesNo | null;
  points_earned: number | null;
  locked_at: string;
  scored_at: string | null;
}

export interface PredictionInput {
  winner: PredictionWinner;
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mom_id: string | null;
  score_range:      ScoreRange | null;
  fifty_scored:     YesNo | null;
  three_wicket_haul: YesNo | null;
}

// Points config
const POINTS = {
  winner: 5,
  top_scorer: 10,
  top_wicket_taker: 10,
  mom: 5,
  score_range: 10,
  fifty_scored: 5,
  three_wicket_haul: 10,   // rare, big reward
};

export function usePredictions(matchId?: string) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('match_predictions').select('*');
    if (matchId) query = query.eq('match_id', matchId);
    const { data, error: err } = await query.order('locked_at', { ascending: false });

    if (err) {
      // Table doesn't exist yet (SQL not run) — fail gracefully
      setError(null);
      setPredictions([]);
    } else {
      setPredictions((data as MatchPrediction[]) || []);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const submitPrediction = useCallback(async (memberId: string, matchId: string, input: PredictionInput) => {
    const { data, error: err } = await supabase
      .from('match_predictions')
      .upsert(
        {
          match_id: matchId,
          member_id: memberId,
          winner: input.winner,
          top_scorer_id: input.top_scorer_id,
          top_wicket_taker_id: input.top_wicket_taker_id,
          mom_id: input.mom_id,
          score_range: input.score_range,
          fifty_scored: input.fifty_scored,
          three_wicket_haul: input.three_wicket_haul,
          locked_at: new Date().toISOString(),
        },
        { onConflict: 'match_id,member_id' }
      )
      .select()
      .single();

    if (err) throw err;
    await fetchPredictions();
    return data;
  }, [fetchPredictions]);

  return { predictions, loading, error, fetchPredictions, submitPrediction };
}

/**
 * Hook for the season-long predictor leaderboard.
 * Aggregates points across all completed matches.
 */
export function usePredictionLeaderboard() {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('match_predictions')
        .select('*');
      if (cancelled) return;
      if (error || !data) {
        setPredictions([]);
      } else {
        setPredictions(data as MatchPrediction[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const leaderboard = useMemo(() => {
    const tally: Record<string, { points: number; matches: number; correct: number }> = {};
    for (const p of predictions) {
      if (p.points_earned == null) continue;  // unscored
      if (!tally[p.member_id]) tally[p.member_id] = { points: 0, matches: 0, correct: 0 };
      tally[p.member_id].points += p.points_earned;
      tally[p.member_id].matches += 1;
      if (p.points_earned > 0) tally[p.member_id].correct += 1;
    }
    return Object.entries(tally)
      .map(([member_id, t]) => ({ member_id, ...t }))
      .sort((a, b) => b.points - a.points);
  }, [predictions]);

  return { leaderboard, loading };
}

/**
 * Score a single prediction against actual match outcome.
 * Used after a match settles. Pure function — caller passes the truth.
 */
export function scorePrediction(
  prediction: PredictionInput,
  actual: {
    winner: 'scc' | 'opponent' | 'draw';
    top_scorer_id: string | null;
    top_wicket_taker_id: string | null;
    mom_id: string | null;
    score_range?:      ScoreRange | null;
    fifty_scored?:     YesNo | null;
    three_wicket_haul?: YesNo | null;
  }
): number {
  let points = 0;
  if (prediction.winner === actual.winner) points += POINTS.winner;
  if (prediction.top_scorer_id && prediction.top_scorer_id === actual.top_scorer_id) {
    points += POINTS.top_scorer;
  }
  if (prediction.top_wicket_taker_id && prediction.top_wicket_taker_id === actual.top_wicket_taker_id) {
    points += POINTS.top_wicket_taker;
  }
  if (prediction.mom_id && prediction.mom_id === actual.mom_id) {
    points += POINTS.mom;
  }
  if (prediction.score_range && prediction.score_range === actual.score_range) {
    points += POINTS.score_range;
  }
  if (prediction.fifty_scored && prediction.fifty_scored === actual.fifty_scored) {
    points += POINTS.fifty_scored;
  }
  if (prediction.three_wicket_haul && prediction.three_wicket_haul === actual.three_wicket_haul) {
    points += POINTS.three_wicket_haul;
  }
  return points;
}

export const PREDICTION_POINTS = POINTS;
