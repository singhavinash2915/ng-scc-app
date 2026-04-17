import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Returns a map of { member_id → MOM count } for completed matches in the given
 * season (defaults to the current 2025-26 season: Sept 1 2025 → Aug 31 2026).
 * Only matches where result is won/lost/draw and man_of_match_id is set are counted.
 */
export function useMOMCounts(seasonStart = '2025-09-01', seasonEnd = '2026-08-31') {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('matches')
        .select('man_of_match_id')
        .not('man_of_match_id', 'is', null)
        .in('result', ['won', 'lost', 'draw'])
        .gte('date', seasonStart)
        .lte('date', seasonEnd);

      if (cancelled) return;

      const tally: Record<string, number> = {};
      (data || []).forEach(m => {
        if (m.man_of_match_id) {
          tally[m.man_of_match_id] = (tally[m.man_of_match_id] || 0) + 1;
        }
      });
      setCounts(tally);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [seasonStart, seasonEnd]);

  return { counts, loading };
}
