import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchScorecard } from './useMatchScorecard';

/**
 * Loads every scorecard in the database in one shot — the ratings, rankings,
 * pressure index, MahaSangram and auction pages all need full match history to
 * compute from.
 *
 * ─── Why this is cached ──────────────────────────────────────────────────────
 * The table is 3 MB on the wire and eight pages ask for it. Without a cache,
 * every navigation to any of them re-downloaded the lot: five pages in a
 * session was 15 MB per member. That is what pushed the Supabase org over its
 * 5 GB egress quota — roughly two thousand full fetches in a billing cycle.
 *
 * So: one in-flight request shared by every caller, then a module-level cache
 * for the rest of the session. Scorecards only change when the CricHeroes sync
 * runs, so a stale read costs nothing — the TTL is about picking up a sync
 * that happened while someone had the app open, not correctness.
 */
const TTL_MS = 10 * 60 * 1000;

let cache: MatchScorecard[] | null = null;
let cachedAt = 0;
let inFlight: Promise<MatchScorecard[]> | null = null;

async function loadScorecards(force = false): Promise<MatchScorecard[]> {
  const fresh = cache && Date.now() - cachedAt < TTL_MS;
  if (!force && fresh) return cache!;
  // Two pages mounting together must not fire two 3 MB requests.
  if (!force && inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase.from('match_scorecards').select('*');
    if (error) throw error;
    cache = (data as MatchScorecard[]) || [];
    cachedAt = Date.now();
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Drop the cache — call after a sync writes new scorecards. */
export function invalidateScorecards() {
  cache = null;
  cachedAt = 0;
}

export function useAllScorecards() {
  // Start from the cache so a revisit paints immediately instead of
  // flashing a loading state while 3 MB comes down again.
  const [scorecards, setScorecards] = useState<MatchScorecard[] | null>(cache);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadScorecards();
        if (cancelled) return;
        setScorecards(rows);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load scorecards');
        setScorecards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { scorecards, loading, error };
}
