import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, MatchPlayer } from '../types';

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          players:match_players(
            id,
            match_id,
            member_id,
            fee_paid,
            member:members(id, name, balance)
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const addMatch = async (
    match: Omit<Match, 'id' | 'created_at' | 'players'>,
    playerIds: string[]
  ) => {
    try {
      // Insert match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert([match])
        .select()
        .single();

      if (matchError) throw matchError;

      // Insert match players
      if (playerIds.length > 0) {
        const matchPlayers = playerIds.map(memberId => ({
          match_id: matchData.id,
          member_id: memberId,
          fee_paid: match.deduct_from_balance, // Mark as paid if deducted from balance
        }));

        const { error: playersError } = await supabase
          .from('match_players')
          .insert(matchPlayers);

        if (playersError) throw playersError;

        // If deduct_from_balance is true, deduct fees from member balances and create transactions
        if (match.deduct_from_balance) {
          for (const memberId of playerIds) {
            // Get current member balance
            const { data: memberData } = await supabase
              .from('members')
              .select('balance')
              .eq('id', memberId)
              .single();

            if (memberData) {
              // Update member balance
              await supabase
                .from('members')
                .update({ balance: memberData.balance - match.match_fee })
                .eq('id', memberId);

              // Create transaction record
              await supabase.from('transactions').insert([{
                type: 'match_fee',
                amount: -match.match_fee,
                member_id: memberId,
                match_id: matchData.id,
                description: `Match fee - ${match.venue}`,
              }]);
            }
          }
        }
      }

      await fetchMatches();
      return matchData;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add match');
    }
  };

  const updateMatch = async (
    id: string,
    updates: Partial<Match>,
    playerIds?: string[]
  ) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update players if provided
      if (playerIds !== undefined) {
        // Remove existing players
        await supabase.from('match_players').delete().eq('match_id', id);

        // Add new players
        if (playerIds.length > 0) {
          const matchPlayers = playerIds.map(memberId => ({
            match_id: id,
            member_id: memberId,
            fee_paid: false,
          }));

          await supabase.from('match_players').insert(matchPlayers);
        }
      }

      await fetchMatches();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update match');
    }
  };

  const deleteMatch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMatches(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete match');
    }
  };

  const updateMatchResult = async (
    id: string,
    result: Match['result'],
    ourScore?: string,
    opponentScore?: string
  ) => {
    return updateMatch(id, { result, our_score: ourScore, opponent_score: opponentScore });
  };

  const getMatchPlayers = async (matchId: string): Promise<MatchPlayer[]> => {
    const { data, error } = await supabase
      .from('match_players')
      .select(`
        *,
        member:members(*)
      `)
      .eq('match_id', matchId);

    if (error) throw error;
    return data || [];
  };

  return {
    matches,
    loading,
    error,
    fetchMatches,
    addMatch,
    updateMatch,
    deleteMatch,
    updateMatchResult,
    getMatchPlayers,
  };
}
