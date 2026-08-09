import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── Member-voted Man of the Match ─────────────────────────────────────────────
// Runs alongside the admin's official award rather than replacing it. The two
// disagreeing is the entire appeal — "the app says X, the captain gave it to Y"
// is a better conversation than either on its own.

export interface MomVote {
  id: string;
  match_id: string;
  voter_id: string;
  member_id: string;
  created_at: string;
}

export interface MomTally {
  member_id: string;
  votes: number;
  share: number;      // 0–1
}

const isMissing = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useMomVotes(matchId: string | null) {
  const [votes, setVotes] = useState<MomVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchVotes = useCallback(async () => {
    if (!matchId) { setVotes([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('scc_mom_votes').select('*').eq('match_id', matchId);
    if (isMissing(error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);
    setVotes((data as MomVote[]) ?? []);
    setLoading(false);
  }, [matchId]);

  // Kick the fetch off the render pass — writing state synchronously inside an
  // effect makes React re-render before paint.
  useEffect(() => { void fetchVotes(); }, [fetchVotes]);

  /** Who's winning the members' vote, most votes first. */
  const tally = useMemo<MomTally[]>(() => {
    const counts = new Map<string, number>();
    votes.forEach(v => counts.set(v.member_id, (counts.get(v.member_id) ?? 0) + 1));
    const total = votes.length || 1;
    return [...counts.entries()]
      .map(([member_id, n]) => ({ member_id, votes: n, share: n / total }))
      .sort((a, b) => b.votes - a.votes);
  }, [votes]);

  const myVote = useCallback(
    (myId: string | null) => votes.find(v => v.voter_id === myId)?.member_id ?? null,
    [votes],
  );

  /**
   * Cast or change a vote. Upsert on (match_id, voter_id) so changing your mind
   * replaces rather than stacks — the UNIQUE constraint does the work.
   */
  const castVote = useCallback(async (voterId: string, memberId: string) => {
    if (!matchId) return 'No match';
    if (voterId === memberId) return "You can't vote for yourself";
    const { error } = await supabase.from('scc_mom_votes')
      .upsert({ match_id: matchId, voter_id: voterId, member_id: memberId },
              { onConflict: 'match_id,voter_id' });
    if (error) return error.message;
    await fetchVotes();
    return null;
  }, [matchId, fetchVotes]);

  const clearVote = useCallback(async (voterId: string) => {
    if (!matchId) return;
    await supabase.from('scc_mom_votes').delete()
      .eq('match_id', matchId).eq('voter_id', voterId);
    await fetchVotes();
  }, [matchId, fetchVotes]);

  return { votes, tally, myVote, castVote, clearVote, loading, tableMissing, refetch: fetchVotes };
}
