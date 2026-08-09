import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── Captain post-match ratings ────────────────────────────────────────────────
// Captains rate their own side out of 10 after a match. It gives captains a job
// between fixtures and feeds a "most consistent" picture that runs alone don't.
//
// Visibility, which matters more than the feature: RLS on this schema is public,
// so anyone with the app can read any row. Rather than pretend otherwise, the UI
// only ever shows a player their OWN ratings plus squad averages, and keeps the
// full per-match grid to captains and admins. Nobody opens the app to find
// they've been given 4/10 in a list next to their team-mates.

export interface PlayerRating {
  id: string;
  match_id: string;
  member_id: string;
  rated_by: string | null;
  rating: number;
  note: string | null;
  created_at: string;
}

export interface RatingSummary {
  member_id: string;
  average: number;
  count: number;
  /** Most recent first, for a form-style strip. */
  recent: number[];
}

const isMissing = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function usePlayerRatings(matchId?: string | null) {
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchRatings = useCallback(async () => {
    let q = supabase.from('scc_player_ratings').select('*').order('created_at', { ascending: false });
    if (matchId) q = q.eq('match_id', matchId);
    const { data, error } = await q;
    if (isMissing(error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);
    setRatings((data as PlayerRating[]) ?? []);
    setLoading(false);
  }, [matchId]);

  // As above: let the promise settle rather than setting state inline.
  useEffect(() => { void fetchRatings(); }, [fetchRatings]);

  /** Season-long average per player — the part that's safe to show publicly. */
  const summaries = useMemo(() => {
    const bag = new Map<string, number[]>();
    ratings.forEach(r => {
      if (!bag.has(r.member_id)) bag.set(r.member_id, []);
      bag.get(r.member_id)!.push(r.rating);
    });
    const out = new Map<string, RatingSummary>();
    for (const [member_id, list] of bag) {
      out.set(member_id, {
        member_id,
        count: list.length,
        average: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
        recent: list.slice(0, 5),
      });
    }
    return out;
  }, [ratings]);

  /** Ranked by average, minimum two ratings so one good day doesn't top it. */
  const mostConsistent = useMemo(
    () => [...summaries.values()].filter(s => s.count >= 2)
      .sort((a, b) => b.average - a.average),
    [summaries],
  );

  const ratingFor = useCallback(
    (memberId: string) => ratings.find(r => r.member_id === memberId)?.rating ?? null,
    [ratings],
  );

  /** One rating per player per match — upsert so re-rating corrects it. */
  const rate = useCallback(async (
    matchIdArg: string, memberId: string, rating: number, ratedBy: string | null, note?: string,
  ) => {
    if (rating < 1 || rating > 10) return 'Rating must be between 1 and 10';
    const { error } = await supabase.from('scc_player_ratings').upsert({
      match_id: matchIdArg, member_id: memberId, rated_by: ratedBy,
      rating, note: note?.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'match_id,member_id' });
    if (error) return error.message;
    await fetchRatings();
    return null;
  }, [fetchRatings]);

  return {
    ratings, summaries, mostConsistent, ratingFor, rate,
    loading, tableMissing, refetch: fetchRatings,
  };
}
