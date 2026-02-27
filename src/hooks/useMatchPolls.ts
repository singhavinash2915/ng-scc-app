import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchPoll, PollResponse } from '../types';

export interface PollSummary {
  available: number;
  unavailable: number;
  maybe: number;
  noResponse: number;
  total: number;
}

export function useMatchPolls() {
  const [polls, setPolls] = useState<MatchPoll[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPollsByMatch = useCallback(async (matchId: string): Promise<MatchPoll[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('match_polls')
        .select(`
          *,
          member:members(id, name, phone, avatar_url, status)
        `)
        .eq('match_id', matchId)
        .order('responded_at', { ascending: false });

      if (error) throw error;
      const result = data || [];
      setPolls(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch polls');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const submitResponse = async (
    matchId: string,
    memberId: string,
    response: PollResponse,
    note?: string
  ) => {
    try {
      const { error } = await supabase
        .from('match_polls')
        .upsert(
          {
            match_id: matchId,
            member_id: memberId,
            response,
            note: note || null,
            responded_at: new Date().toISOString(),
          },
          { onConflict: 'match_id,member_id' }
        );

      if (error) throw error;

      // Refresh polls
      await fetchPollsByMatch(matchId);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit response');
    }
  };

  const removeResponse = async (matchId: string, memberId: string) => {
    try {
      const { error } = await supabase
        .from('match_polls')
        .delete()
        .eq('match_id', matchId)
        .eq('member_id', memberId);

      if (error) throw error;

      setPolls(prev => prev.filter(p => !(p.match_id === matchId && p.member_id === memberId)));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove response');
    }
  };

  const getPollSummary = (pollData: MatchPoll[], totalMembers: number): PollSummary => {
    const available = pollData.filter(p => p.response === 'available').length;
    const unavailable = pollData.filter(p => p.response === 'unavailable').length;
    const maybe = pollData.filter(p => p.response === 'maybe').length;
    const noResponse = totalMembers - pollData.length;

    return { available, unavailable, maybe, noResponse, total: totalMembers };
  };

  return {
    polls,
    loading,
    error,
    fetchPollsByMatch,
    submitResponse,
    removeResponse,
    getPollSummary,
  };
}
