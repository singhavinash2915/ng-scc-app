import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MatchComment {
  id: string;
  match_id: string;
  member_id: string;
  body: string;
  created_at: string;
  member?: { id: string; name: string; avatar_url: string | null };
}

export function useMatchComments() {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const fetch = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('match_comments')
        .select('*, member:members(id, name, avatar_url)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) setComments(data as MatchComment[]);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, []);

  const post = async (matchId: string, body: string, memberId: string) => {
    const trimmed = body.trim();
    if (!trimmed || !memberId) return;
    setPosting(true);
    try {
      const { data } = await supabase
        .from('match_comments')
        .insert({ match_id: matchId, member_id: memberId, body: trimmed })
        .select('*, member:members(id, name, avatar_url)')
        .single();
      if (data) setComments(prev => [...prev, data as MatchComment]);
    } catch { /* ignore */ } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId: string, memberId: string) => {
    try {
      await supabase
        .from('match_comments')
        .delete()
        .eq('id', commentId)
        .eq('member_id', memberId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* ignore */ }
  };

  return { comments, loading, posting, fetch, post, remove };
}
