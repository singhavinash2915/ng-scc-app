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

/**
 * Every column the app actually reads. `select('*')` also fetched `raw` — the
 * unparsed CricHeroes response the sync script keeps — which is 14 KB per row,
 * 53% of the whole payload, and which nothing in the client has ever looked at.
 * Naming the columns took the gzipped fetch from 821 KB to 369 KB.
 */
const COLUMNS = [
  'id', 'match_id', 'ch_match_id', 'fetched_at',
  'innings1_team_id', 'innings1_team_name', 'innings1_summary',
  'innings1_batting', 'innings1_bowling', 'innings1_extras',
  'innings2_team_id', 'innings2_team_name', 'innings2_summary',
  'innings2_batting', 'innings2_bowling', 'innings2_extras',
].join(', ');

const STORE_KEY = 'scc-scorecards-v1';

let cache: MatchScorecard[] | null = null;
let cachedAt = 0;
let inFlight: Promise<MatchScorecard[]> | null = null;

interface Stored { count: number; latest: string; rows: MatchScorecard[] }

/** Persisted copy from a previous visit, or null. */
function readStore(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) as Stored : null;
  } catch { return null; }
}

/** Best-effort: a browser that refuses the write just goes without. */
function writeStore(v: Stored) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); }
  catch { /* private mode, or over quota — the in-memory cache still works */ }
}

/**
 * Is the stored copy still current? Two numbers — how many scorecards exist and
 * when the newest was fetched — are enough, because rows are only ever written
 * by the sync. About 200 bytes, against 369 KB for the fetch it avoids.
 */
async function isStoreCurrent(st: Stored): Promise<boolean> {
  const { data, count, error } = await supabase
    .from('match_scorecards')
    .select('fetched_at', { count: 'exact' })
    .order('fetched_at', { ascending: false })
    .limit(1);
  if (error) return false;
  const latest = (data?.[0] as { fetched_at?: string } | undefined)?.fetched_at ?? '';
  return count === st.count && latest === st.latest;
}

async function loadScorecards(force = false): Promise<MatchScorecard[]> {
  const fresh = cache && Date.now() - cachedAt < TTL_MS;
  if (!force && fresh) return cache!;
  // Two pages mounting together must not fire two full requests.
  if (!force && inFlight) return inFlight;

  inFlight = (async () => {
    // The in-memory cache dies with the tab, and this app is a PWA people
    // reopen several times a day — so every relaunch used to pay the full
    // download again. Ask the cheap question first: has anything changed?
    if (!force) {
      const st = readStore();
      if (st?.rows?.length && await isStoreCurrent(st)) {
        cache = st.rows;
        cachedAt = Date.now();
        return cache;
      }
    }

    const { data, error } = await supabase.from('match_scorecards').select(COLUMNS);
    if (error) throw error;
    cache = (data as unknown as MatchScorecard[]) || [];
    cachedAt = Date.now();

    const latest = cache.reduce((m, r) => (r.fetched_at > m ? r.fetched_at : m), '');
    writeStore({ count: cache.length, latest, rows: cache });
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
  try { localStorage.removeItem(STORE_KEY); } catch { /* nothing to clear */ }
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
