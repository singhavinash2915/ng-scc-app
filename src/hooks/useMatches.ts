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
          man_of_match:members!matches_man_of_match_id_fkey(id, name, avatar_url),
          captain:members!matches_captain_id_fkey(id, name, avatar_url),
          vice_captain:members!matches_vice_captain_id_fkey(id, name, avatar_url)
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

  // Ensure fees are settled (deducted + transaction logged + fee_paid marked) for every
  // player of a completed match whose deduct_from_balance is on and match_fee > 0.
  // Idempotent — already-paid players are skipped. Called after every updateMatch to
  // cover both "upcoming → completed" transitions AND editing fee/deduct/players on a
  // match that was already completed (e.g. matches synced from CricHeroes).
  const settleMatchFees = async (matchId: string): Promise<void> => {
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
    if (!match) return;

    const isCompleted = match.result !== 'upcoming' && match.result !== 'cancelled';
    if (!isCompleted || !match.deduct_from_balance || !match.match_fee || match.match_fee <= 0) return;

    const { data: players } = await supabase
      .from('match_players')
      .select('member_id, fee_paid')
      .eq('match_id', matchId);
    if (!players) return;

    const matchTypeLabel = match.match_type === 'internal' ? 'Internal Match' : 'Match';
    const fee = match.match_fee;

    for (const player of players) {
      if (player.fee_paid) continue;

      const { data: memberData } = await supabase
        .from('members')
        .select('balance')
        .eq('id', player.member_id)
        .single();
      if (!memberData) continue;

      await supabase.from('members')
        .update({ balance: memberData.balance - fee })
        .eq('id', player.member_id);

      await supabase.from('transactions').insert([{
        type: 'match_fee',
        amount: -fee,
        member_id: player.member_id,
        match_id: matchId,
        description: `${matchTypeLabel} fee - ${match.venue}`,
      }]);

      await supabase.from('match_players')
        .update({ fee_paid: true })
        .eq('match_id', matchId)
        .eq('member_id', player.member_id);
    }
  };

  const updateMatch = async (
    id: string,
    updates: Partial<Match>,
    playerIds?: string[]
  ) => {
    try {
      const existingMatch = matches.find(m => m.id === id);
      if (!existingMatch) throw new Error('Match not found');

      // Update match row
      const { data, error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Effective state after this update
      const effResult = updates.result ?? existingMatch.result;
      const wasCompleted = existingMatch.result !== 'upcoming' && existingMatch.result !== 'cancelled';
      const isCompleted = effResult !== 'upcoming' && effResult !== 'cancelled';

      const existingPlayers = existingMatch.players || [];
      const existingPlayerMap = new Map(existingPlayers.map(p => [p.member_id, p]));

      // ── Player diff (preserves fee_paid status for kept players) ────────────
      if (playerIds !== undefined) {
        const newPlayerSet = new Set(playerIds);
        const removedPlayers = existingPlayers.filter(p => !newPlayerSet.has(p.member_id));
        const addedPlayers = playerIds.filter(pid => !existingPlayerMap.has(pid));

        // Removed players: refund fee if paid, decrement matches_played if match was completed
        for (const player of removedPlayers) {
          const { data: memberData } = await supabase
            .from('members')
            .select('balance, matches_played')
            .eq('id', player.member_id)
            .single();
          if (!memberData) continue;

          const memberUpdate: { balance?: number; matches_played?: number } = {};
          if (wasCompleted) {
            memberUpdate.matches_played = Math.max(0, (memberData.matches_played || 0) - 1);
          }
          if (player.fee_paid && existingMatch.match_fee > 0) {
            memberUpdate.balance = memberData.balance + existingMatch.match_fee;
          }
          if (Object.keys(memberUpdate).length > 0) {
            await supabase.from('members').update(memberUpdate).eq('id', player.member_id);
          }
          if (player.fee_paid) {
            await supabase.from('transactions')
              .delete()
              .eq('match_id', id)
              .eq('member_id', player.member_id)
              .eq('type', 'match_fee');
          }
        }
        if (removedPlayers.length > 0) {
          await supabase.from('match_players')
            .delete()
            .eq('match_id', id)
            .in('member_id', removedPlayers.map(p => p.member_id));
        }

        // Added players: insert, increment matches_played if match is completed
        if (addedPlayers.length > 0) {
          await supabase.from('match_players').insert(
            addedPlayers.map(memberId => ({
              match_id: id,
              member_id: memberId,
              fee_paid: false,
              team: null,
            }))
          );
          if (isCompleted) {
            for (const memberId of addedPlayers) {
              const { data: memberData } = await supabase
                .from('members')
                .select('matches_played')
                .eq('id', memberId)
                .single();
              if (memberData) {
                await supabase.from('members')
                  .update({ matches_played: (memberData.matches_played || 0) + 1 })
                  .eq('id', memberId);
              }
            }
          }
        }
      }

      // Result transition upcoming → completed: increment matches_played for kept players
      // (added players already handled above; existing-kept players need the bump)
      if (!wasCompleted && isCompleted) {
        const keptPlayerIds = playerIds !== undefined
          ? playerIds.filter(pid => existingPlayerMap.has(pid))
          : existingPlayers.map(p => p.member_id);
        for (const memberId of keptPlayerIds) {
          const { data: memberData } = await supabase
            .from('members')
            .select('matches_played')
            .eq('id', memberId)
            .single();
          if (memberData) {
            await supabase.from('members')
              .update({ matches_played: (memberData.matches_played || 0) + 1 })
              .eq('id', memberId);
          }
        }
      }

      // Settle any unpaid fees (handles upcoming→completed AND editing fee on already-completed match)
      await settleMatchFees(id);

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
      const wasCompleted = match?.result && match.result !== 'upcoming' && match.result !== 'cancelled';
      if (match?.players && match.players.length > 0) {
        for (const player of match.players) {
          const { data: memberData } = await supabase
            .from('members')
            .select('balance, matches_played')
            .eq('id', player.member_id)
            .single();

          if (memberData) {
            const updateData: { matches_played?: number; balance?: number } = {};

            // Only decrement matches_played if the match was completed (not upcoming/cancelled)
            if (wasCompleted) {
              updateData.matches_played = Math.max(0, (memberData.matches_played || 0) - 1);
            }

            // Only revert fee if it was actually deducted (fee_paid = true)
            if (player.fee_paid && match.match_fee > 0) {
              updateData.balance = memberData.balance + match.match_fee;
            }

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('members')
                .update(updateData)
                .eq('id', player.member_id);
            }
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
