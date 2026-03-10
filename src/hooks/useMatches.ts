import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, MatchPlayer, InternalTeam } from '../types';

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
            team,
            member:members(id, name, balance, avatar_url)
          ),
          man_of_match:members!matches_man_of_match_id_fkey(id, name, avatar_url)
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
    playerIds: string[],
    playerTeams?: Record<string, InternalTeam> // For internal matches: { memberId: 'dhurandars' | 'bazigars' }
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
        const isUpcoming = match.result === 'upcoming';
        const shouldDeduct = match.deduct_from_balance && !isUpcoming;

        const matchPlayers = playerIds.map(memberId => ({
          match_id: matchData.id,
          member_id: memberId,
          fee_paid: shouldDeduct,
          team: match.match_type === 'internal' && playerTeams ? playerTeams[memberId] || null : null,
        }));

        const { error: playersError } = await supabase
          .from('match_players')
          .insert(matchPlayers);

        if (playersError) throw playersError;

        // Only deduct fees and increment matches_played for non-upcoming matches
        if (!isUpcoming) {
          for (const memberId of playerIds) {
            const { data: memberData } = await supabase
              .from('members')
              .select('balance, matches_played')
              .eq('id', memberId)
              .single();

            if (memberData) {
              const updateData: { matches_played: number; balance?: number } = {
                matches_played: (memberData.matches_played || 0) + 1,
              };

              if (shouldDeduct) {
                updateData.balance = memberData.balance - match.match_fee;

                const matchTypeLabel = match.match_type === 'internal' ? 'Internal Match' : 'Match';
                await supabase.from('transactions').insert([{
                  type: 'match_fee',
                  amount: -match.match_fee,
                  member_id: memberId,
                  match_id: matchData.id,
                  description: `${matchTypeLabel} fee - ${match.venue}`,
                }]);
              }

              await supabase
                .from('members')
                .update(updateData)
                .eq('id', memberId);
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
      // Check if result is changing from 'upcoming' to a completed result
      const existingMatch = matches.find(m => m.id === id);
      const wasUpcoming = existingMatch?.result === 'upcoming';
      const isNowCompleted = updates.result && updates.result !== 'upcoming' && updates.result !== 'cancelled';
      const shouldDeductNow = wasUpcoming && isNowCompleted && existingMatch?.deduct_from_balance && existingMatch?.match_fee > 0;

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

      // Deduct fees when match moves from upcoming → completed result
      if (shouldDeductNow && existingMatch?.players && existingMatch.players.length > 0) {
        for (const player of existingMatch.players) {
          const { data: memberData } = await supabase
            .from('members')
            .select('balance, matches_played')
            .eq('id', player.member_id)
            .single();

          if (memberData) {
            const matchTypeLabel = existingMatch.match_type === 'internal' ? 'Internal Match' : 'Match';

            // Deduct fee and increment matches_played
            await supabase
              .from('members')
              .update({
                balance: memberData.balance - existingMatch.match_fee,
                matches_played: (memberData.matches_played || 0) + 1,
              })
              .eq('id', player.member_id);

            // Create transaction record
            await supabase.from('transactions').insert([{
              type: 'match_fee',
              amount: -existingMatch.match_fee,
              member_id: player.member_id,
              match_id: id,
              description: `${matchTypeLabel} fee - ${existingMatch.venue}`,
            }]);

            // Mark fee as paid
            await supabase
              .from('match_players')
              .update({ fee_paid: true })
              .eq('match_id', id)
              .eq('member_id', player.member_id);
          }
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
      // Get match details before deleting
      const match = matches.find(m => m.id === id);

      // Revert fee deductions and matches_played if the match had players
      if (match?.players && match.players.length > 0) {
        for (const player of match.players) {
          const { data: memberData } = await supabase
            .from('members')
            .select('balance, matches_played')
            .eq('id', player.member_id)
            .single();

          if (memberData) {
            const updateData: { matches_played: number; balance?: number } = {
              matches_played: Math.max(0, (memberData.matches_played || 0) - 1),
            };

            // Revert fee if it was deducted
            if (match.deduct_from_balance && match.match_fee > 0) {
              updateData.balance = memberData.balance + match.match_fee;
            }

            await supabase
              .from('members')
              .update(updateData)
              .eq('id', player.member_id);
          }
        }

        // Delete associated match_fee transactions
        await supabase
          .from('transactions')
          .delete()
          .eq('match_id', id)
          .eq('type', 'match_fee');
      }

      // Delete the match (match_players cascade-deleted via FK)
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

  const toggleFeePaid = async (matchId: string, memberId: string, feePaid: boolean) => {
    try {
      const { error } = await supabase
        .from('match_players')
        .update({ fee_paid: feePaid })
        .eq('match_id', matchId)
        .eq('member_id', memberId);

      if (error) throw error;

      // Update local state
      setMatches(prev => prev.map(m => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          players: m.players?.map(p =>
            p.member_id === memberId ? { ...p, fee_paid: feePaid } : p
          ),
        };
      }));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update fee status');
    }
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
    toggleFeePaid,
  };
}
