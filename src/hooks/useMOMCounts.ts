import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CURRENT_SEASON_WINDOW } from '../config/season';

/**
 * Man of the Match counts — this season, and for a career.
 *
 * The season window used to be written into the signature as 2025-09-01 →
 * 2026-08-31. It went stale the day the 2026-27 season began: every "this
 * season" MOM figure in the app was last season's, so the dashboard opened the
 * new season announcing that Avinash led the MOM race with 11 — from matches
 * played before it started. It now comes from the club's season definition,
 * the same single source every other season figure uses.
 *
 * `counts` is the window (this season by default); `allTime` is every season,
 * for the surfaces that are about a career rather than a campaign.
 *
 * Internal matches (Brahmos v Agni) are excluded from both — same convention as
 * season batting and bowling — so an El Clásico MOM doesn't inflate a tally
 * that is meant to be against real opposition.
 */
export function useMOMCounts(
  seasonStart = CURRENT_SEASON_WINDOW.start,
  seasonEnd   = CURRENT_SEASON_WINDOW.end,
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allTime, setAllTime] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // One read for both: the window is applied here rather than in the query,
      // so a career figure costs nothing extra.
      const { data } = await supabase
        .from('matches')
        .select('man_of_match_id, date')
        .not('man_of_match_id', 'is', null)
        .in('result', ['won', 'lost', 'draw'])
        .neq('match_type', 'internal');

      if (cancelled) return;

      const tally: Record<string, number> = {};
      const career: Record<string, number> = {};
      (data || []).forEach(m => {
        const id = m.man_of_match_id as string | null;
        if (!id) return;
        career[id] = (career[id] || 0) + 1;
        if (m.date >= seasonStart && m.date <= seasonEnd) tally[id] = (tally[id] || 0) + 1;
      });
      setCounts(tally);
      setAllTime(career);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [seasonStart, seasonEnd]);

  return { counts, allTime, loading };
}
