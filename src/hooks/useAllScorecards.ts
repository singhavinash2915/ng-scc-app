import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchScorecard } from './useMatchScorecard';

/**
 * Loads every scorecard in the database in one shot — used by the SCC
 * Rankings page which needs the full match history to compute ratings.
 *
 * Returns null while loading. Empty array if the table is missing/empty.
 */
export function useAllScorecards() {
  const [scorecards, setScorecards] = useState<MatchScorecard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('match_scorecards')
        .select('*');
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setScorecards([]);
      } else {
        setScorecards((data as MatchScorecard[]) || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { scorecards, loading, error };
}
