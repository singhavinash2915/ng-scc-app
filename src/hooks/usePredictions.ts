import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// 'dhurandars' / 'bazigars' are used for internal (SCC vs SCC) matches
export type PredictionWinner = 'scc' | 'opponent' | 'draw' | 'dhurandars' | 'bazigars';

// Bonus prediction option types
export type ScoreRange     = 'under_100' | '100_110' | '110_125' | 'over_125';
export type YesNo          = 'yes' | 'no';
// Internal-match bonus types
export type SixesTeam      = 'dhurandars' | 'bazigars' | 'tie';
export type MarginType     = 'thriller' | 'comfortable' | 'dominant';

export interface MatchPrediction {
  id: string;
  match_id: string;
  member_id: string;
  winner: PredictionWinner | null;
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mom_id: string | null;
  // Bonus questions (external matches)
  score_range:      ScoreRange | null;
  fifty_scored:     YesNo | null;
  three_wicket_haul: YesNo | null;
  // Bonus questions (internal Dhurandars vs Bazigars matches)
  internal_most_sixes: SixesTeam | null;
  internal_margin:     MarginType | null;
  internal_milestone:  YesNo | null;
  internal_highest_team: SixesTeam | null;   // which team has the highest individual score
  internal_duck:         YesNo | null;       // will anyone get a duck
  // Per-team star picks
  int_dhur_top_scorer_id: string | null;
  int_baz_top_scorer_id:  string | null;
  int_dhur_top_wicket_id: string | null;
  int_baz_top_wicket_id:  string | null;
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
  internal_most_sixes: SixesTeam | null;
  internal_margin:     MarginType | null;
  internal_milestone:  YesNo | null;
  internal_highest_team: SixesTeam | null;
  internal_duck:         YesNo | null;
  int_dhur_top_scorer_id: string | null;
  int_baz_top_scorer_id:  string | null;
  int_dhur_top_wicket_id: string | null;
  int_baz_top_wicket_id:  string | null;
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
  // Internal bonuses
  internal_most_sixes: 10,
  internal_margin: 10,
  internal_milestone: 5,
  internal_highest_team: 5,
  internal_duck: 5,
  // Per-team star picks (smaller pool → lower reward each)
  int_team_top_scorer: 5,
  int_team_top_wicket: 5,
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
          internal_most_sixes: input.internal_most_sixes,
          internal_margin: input.internal_margin,
          internal_milestone: input.internal_milestone,
          internal_highest_team: input.internal_highest_team,
          internal_duck: input.internal_duck,
          int_dhur_top_scorer_id: input.int_dhur_top_scorer_id,
          int_baz_top_scorer_id: input.int_baz_top_scorer_id,
          int_dhur_top_wicket_id: input.int_dhur_top_wicket_id,
          int_baz_top_wicket_id: input.int_baz_top_wicket_id,
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
    // Tie-break order: points desc → correct predictions desc (rewards accuracy
    // over volume) → fewer matches needed to get there (efficiency) → member_id
    // for a stable final order. Members tied on points+correct+matches share
    // the same displayed rank (standard "1224" competition ranking) — see rank
    // computation below, driven off this sort.
    const sorted = Object.entries(tally)
      .map(([member_id, t]) => ({ member_id, ...t }))
      .sort((a, b) =>
        b.points - a.points ||
        b.correct - a.correct ||
        a.matches - b.matches ||
        a.member_id.localeCompare(b.member_id));

    // Assign competition ranks: ties (equal points+correct+matches) share a
    // rank; the next distinct entry's rank accounts for how many were tied
    // above it (e.g. two people tied at #3 → next rank is #5, not #4).
    let rank = 0;
    return sorted.map((row, i) => {
      const prev = sorted[i - 1];
      const tiedWithPrev = prev && prev.points === row.points && prev.correct === row.correct && prev.matches === row.matches;
      if (!tiedWithPrev) rank = i + 1;
      return { ...row, rank };
    });
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
    internal_most_sixes?: SixesTeam | null;
    internal_margin?:     MarginType | null;
    internal_milestone?:  YesNo | null;
    internal_highest_team?: SixesTeam | null;
    internal_duck?:         YesNo | null;
    int_dhur_top_scorer_id?: string | null;
    int_baz_top_scorer_id?:  string | null;
    int_dhur_top_wicket_id?: string | null;
    int_baz_top_wicket_id?:  string | null;
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
  // Internal-match bonus scoring
  if (prediction.internal_most_sixes && prediction.internal_most_sixes === actual.internal_most_sixes) {
    points += POINTS.internal_most_sixes;
  }
  if (prediction.internal_margin && prediction.internal_margin === actual.internal_margin) {
    points += POINTS.internal_margin;
  }
  if (prediction.internal_milestone && prediction.internal_milestone === actual.internal_milestone) {
    points += POINTS.internal_milestone;
  }
  if (prediction.internal_highest_team && prediction.internal_highest_team === actual.internal_highest_team) {
    points += POINTS.internal_highest_team;
  }
  if (prediction.internal_duck && prediction.internal_duck === actual.internal_duck) {
    points += POINTS.internal_duck;
  }
  // Per-team star picks
  if (prediction.int_dhur_top_scorer_id && prediction.int_dhur_top_scorer_id === actual.int_dhur_top_scorer_id) {
    points += POINTS.int_team_top_scorer;
  }
  if (prediction.int_baz_top_scorer_id && prediction.int_baz_top_scorer_id === actual.int_baz_top_scorer_id) {
    points += POINTS.int_team_top_scorer;
  }
  if (prediction.int_dhur_top_wicket_id && prediction.int_dhur_top_wicket_id === actual.int_dhur_top_wicket_id) {
    points += POINTS.int_team_top_wicket;
  }
  if (prediction.int_baz_top_wicket_id && prediction.int_baz_top_wicket_id === actual.int_baz_top_wicket_id) {
    points += POINTS.int_team_top_wicket;
  }
  return points;
}

export const PREDICTION_POINTS = POINTS;
