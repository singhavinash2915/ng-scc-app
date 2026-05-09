import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BatterRow {
  player_id: number;
  name: string;
  runs: number;
  balls: number;
  minutes: number;
  '4s': number;
  '6s': number;
  SR: string;
  batting_hand?: string;
  how_to_out?: string;
}

export interface BowlerRow {
  player_id: number;
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy_rate: string;
}

export interface InningsSummary {
  score?: string;
  over?: string;
  rr?: string;
  total_run?: number;
  total_wicket?: number;
  total_extra?: number;
  overs_played?: string;
  is_allout?: number;
}

export interface InningsExtras {
  wide?: number;
  noball?: number;
  bye?: number;
  legbye?: number;
  penalty?: number;
  total?: number;
}

export interface MatchScorecard {
  id: string;
  match_id: string;
  ch_match_id: string;
  innings1_team_id: number | null;
  innings1_team_name: string | null;
  innings1_summary: InningsSummary | null;
  innings1_batting: BatterRow[] | null;
  innings1_bowling: BowlerRow[] | null;
  innings1_extras: InningsExtras | null;
  innings2_team_id: number | null;
  innings2_team_name: string | null;
  innings2_summary: InningsSummary | null;
  innings2_batting: BatterRow[] | null;
  innings2_bowling: BowlerRow[] | null;
  innings2_extras: InningsExtras | null;
  fetched_at: string;
}

/**
 * Loads a detailed CricHeroes-sourced scorecard for a single match.
 * Returns null if no scorecard exists (table missing, or match not synced yet).
 */
export function useMatchScorecard(matchId: string | undefined) {
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setScorecard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('match_scorecards')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setScorecard(null);
      } else {
        setScorecard(data as MatchScorecard);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  return { scorecard, loading };
}
