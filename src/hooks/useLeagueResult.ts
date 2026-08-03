import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Captain election result ───────────────────────────────────────────────────
// The reveal page's data. This is the ONE place the app reads raw ballots, and
// it is admin-gated behind a closed election — everywhere else the ballots stay
// out of the browser entirely.

export interface Ballot {
  voterId: string;
  captainId: string;
  at: string;
  /** True when `at` is when the vote LAST changed, not just when first cast. */
  exact: boolean;
}

export interface Candidate {
  id: string;
  votes: number;
  position: number;
  voters: string[];
}

export function useLeagueResult(season: string, ratingById?: Record<string, number>) {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [exactTimes, setExactTimes] = useState(false);
  const [eligibleIds, setEligibleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // Prefer updated_at: a changed vote keeps its original created_at, so
    // ordering by that replays everyone's FINAL pick at their FIRST timestamp
    // and hides every lead change. Falls back when the column isn't there yet.
    let voteRes = await supabase.from('scc_league_captain_votes')
      .select('voter_id,captain_id,created_at,updated_at').eq('season', season);
    let exact = true;
    if (voteRes.error?.code === '42703' || /updated_at/.test(voteRes.error?.message ?? '')) {
      exact = false;
      voteRes = await supabase.from('scc_league_captain_votes')
        .select('voter_id,captain_id,created_at').eq('season', season) as typeof voteRes;
    }
    setExactTimes(exact);

    const regRes = await supabase.from('scc_league_registrations')
      .select('member_id,status').eq('season', season);

    if (voteRes.error) {
      // Expected once the ballots are locked down at the database — say so
      // plainly rather than rendering an empty, wrong-looking page.
      setError(voteRes.error.message);
      setBallots([]);
    } else {
      setError(null);
      setBallots((voteRes.data || []).map(v => ({
        voterId: v.voter_id as string,
        captainId: v.captain_id as string,
        at: ((v as { updated_at?: string }).updated_at ?? v.created_at) as string,
        exact,
      })).filter(b => b.captainId).sort((a, b) => a.at.localeCompare(b.at)));
    }
    setEligibleIds(new Set(
      ((regRes.data || []) as { member_id: string; status: string }[])
        .filter(r => r.status === 'in').map(r => r.member_id),
    ));
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** Ballots from players actually registered IN — the only ones that count. */
  const valid = useMemo(
    () => ballots.filter(b => eligibleIds.has(b.voterId)),
    [ballots, eligibleIds],
  );

  const candidates = useMemo<Candidate[]>(() => {
    const byId = new Map<string, string[]>();
    valid.forEach(b => {
      byId.set(b.captainId, [...(byId.get(b.captainId) || []), b.voterId]);
    });
    const rating = (id: string) => ratingById?.[id] ?? 0;
    const rows = [...byId.entries()]
      .map(([id, voters]) => ({ id, votes: voters.length, voters, position: 0 }))
      // Ties fall to SCC Rankings rating, exactly as the rulebook says.
      .sort((a, b) => b.votes - a.votes || rating(b.id) - rating(a.id));
    rows.forEach((r, i) => {
      r.position = rows.filter(o => o.votes > r.votes).length + 1;
      if (i === 0) r.position = 1;
    });
    return rows;
  }, [valid, ratingById]);

  const turnout = useMemo(() => ({
    voted: valid.length,
    eligible: eligibleIds.size,
    pct: eligibleIds.size ? Math.round((valid.length / eligibleIds.size) * 100) : 0,
  }), [valid, eligibleIds]);

  const notVoted = useMemo(() => {
    const voted = new Set(valid.map(b => b.voterId));
    return [...eligibleIds].filter(id => !voted.has(id));
  }, [valid, eligibleIds]);

  /** Ballots that were cast but don't count — voter isn't registered IN. */
  const discarded = useMemo(
    () => ballots.filter(b => !eligibleIds.has(b.voterId)),
    [ballots, eligibleIds],
  );

  return { candidates, valid, turnout, notVoted, discarded, exactTimes, loading, error, refetch: fetchAll };
}
