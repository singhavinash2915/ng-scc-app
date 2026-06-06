import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ClubPoll, ClubPollVote } from '../types';

export function useClubPolls() {
  const [polls, setPolls] = useState<ClubPoll[]>([]);
  const [votes, setVotes] = useState<ClubPollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('club_polls')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolls(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch polls');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('club_poll_votes')
        .select('*');

      if (error) throw error;
      setVotes(data || []);
    } catch (err) {
      // Gracefully handle missing table
      setVotes([]);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
    fetchVotes();
  }, [fetchPolls, fetchVotes]);

  const createPoll = async (poll: {
    question: string;
    type: 'poll' | 'quiz';
    options: { text: string; isCorrect?: boolean }[];
    category: 'fun' | 'cricket' | 'scc_history';
    expires_at?: string | null;
    created_by?: string | null;
  }) => {
    try {
      const { data, error } = await supabase
        .from('club_polls')
        .insert([{
          ...poll,
          is_active: true,
          expires_at: poll.expires_at || null,
          created_by: poll.created_by || null,
        }])
        .select()
        .single();

      if (error) throw error;
      setPolls(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create poll');
    }
  };

  const vote = async (pollId: string, memberId: string, optionIndex: number) => {
    try {
      const { data, error } = await supabase
        .from('club_poll_votes')
        .upsert(
          {
            poll_id: pollId,
            member_id: memberId,
            option_index: optionIndex,
          },
          { onConflict: 'poll_id,member_id' }
        )
        .select()
        .single();

      if (error) throw error;

      // Update local votes state
      setVotes(prev => {
        const filtered = prev.filter(
          v => !(v.poll_id === pollId && v.member_id === memberId)
        );
        return [...filtered, data];
      });

      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit vote');
    }
  };

  const deletePoll = async (id: string) => {
    try {
      const { error } = await supabase
        .from('club_polls')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPolls(prev => prev.filter(p => p.id !== id));
      setVotes(prev => prev.filter(v => v.poll_id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete poll');
    }
  };

  const getResults = (pollId: string): { optionIndex: number; count: number }[] => {
    const pollVotes = votes.filter(v => v.poll_id === pollId);
    const counts = new Map<number, number>();

    for (const v of pollVotes) {
      counts.set(v.option_index, (counts.get(v.option_index) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([optionIndex, count]) => ({
      optionIndex,
      count,
    }));
  };

  return {
    polls,
    votes,
    loading,
    error,
    createPoll,
    vote,
    deletePoll,
    getResults,
  };
}
