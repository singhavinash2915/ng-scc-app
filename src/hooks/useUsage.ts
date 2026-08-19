import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Usage, aggregate only ────────────────────────────────────────────────────
// Deliberately anonymous. See add_usage_stats.sql for why — the short version
// is that members signed in to see their own season, not to be logged.
//
// The session key is random per browser session and maps to nobody. It exists
// so "42 visits" can mean 42 PEOPLE rather than 42 page loads, which is the
// only thing that makes the number worth reading.

const SESSION_KEY = 'scc-session-key';

function sessionKey(): string {
  let k = sessionStorage.getItem(SESSION_KEY);
  if (!k) {
    k = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, k);
  }
  return k;
}

/** Routes already recorded this session — one write each, not one per visit. */
const sent = new Set<string>();

export function useUsageTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Collapse ids out of the path: /profile/abc and /profile/def are both
    // "profile". A route list with 48 profile entries tells you nothing.
    const route = pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
      .replace(/\/\d+/g, '/:n') || '/';
    if (sent.has(route)) return;
    sent.add(route);

    // Fire and forget. A failed count must never interrupt anyone's browsing,
    // and the unique constraint makes a duplicate harmless.
    void supabase.from('scc_usage')
      .insert({ route, session_key: sessionKey() })
      .then(() => undefined, () => undefined);
  }, [pathname]);
}

// ── Reading it back, for admins ───────────────────────────────────────────────

export interface DayCount { day: string; people: number; views: number }
export interface RouteCount { route: string; people: number }

export async function fetchUsage(days = 30): Promise<{
  byDay: DayCount[]; byRoute: RouteCount[]; missing: boolean;
}> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('scc_usage').select('day, route, session_key').gte('day', since);

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
    return { byDay: [], byRoute: [], missing: true };
  }
  const rows = (data as Array<{ day: string; route: string; session_key: string }>) ?? [];

  // Distinct sessions per day is the closest honest proxy for "people". It
  // over-counts anyone who opens the app twice in a day on two devices, and
  // that's fine — it's a trend line, not a headcount.
  const dayMap = new Map<string, { s: Set<string>; views: number }>();
  const routeMap = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!dayMap.has(r.day)) dayMap.set(r.day, { s: new Set(), views: 0 });
    const d = dayMap.get(r.day)!;
    d.s.add(r.session_key); d.views += 1;
    if (!routeMap.has(r.route)) routeMap.set(r.route, new Set());
    routeMap.get(r.route)!.add(r.session_key);
  }

  return {
    byDay: [...dayMap.entries()]
      .map(([day, v]) => ({ day, people: v.s.size, views: v.views }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byRoute: [...routeMap.entries()]
      .map(([route, s]) => ({ route, people: s.size }))
      .sort((a, b) => b.people - a.people),
    missing: false,
  };
}
