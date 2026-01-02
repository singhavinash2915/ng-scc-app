import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Tournament, TournamentMatch } from '../types';

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          matches:tournament_matches(
            id,
            tournament_id,
            match_id,
            stage,
            match:matches(*)
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const addTournament = async (
    tournament: Omit<Tournament, 'id' | 'created_at' | 'matches'>
  ) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert([tournament])
        .select()
        .single();

      if (error) throw error;
      await fetchTournaments();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add tournament');
    }
  };

  const updateTournament = async (
    id: string,
    updates: Partial<Tournament>
  ) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchTournaments();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update tournament');
    }
  };

  const deleteTournament = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTournaments(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete tournament');
    }
  };

  const addMatchToTournament = async (
    tournamentId: string,
    matchId: string,
    stage: TournamentMatch['stage']
  ) => {
    try {
      const { error } = await supabase
        .from('tournament_matches')
        .insert([{
          tournament_id: tournamentId,
          match_id: matchId,
          stage,
        }]);

      if (error) throw error;
      await fetchTournaments();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add match to tournament');
    }
  };

  const removeMatchFromTournament = async (
    tournamentId: string,
    matchId: string
  ) => {
    try {
      const { error } = await supabase
        .from('tournament_matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('match_id', matchId);

      if (error) throw error;
      await fetchTournaments();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove match from tournament');
    }
  };

  const getTournamentStats = (tournament: Tournament) => {
    const matches = tournament.matches || [];
    const completedMatches = matches.filter(
      m => m.match && ['won', 'lost', 'draw'].includes(m.match.result)
    );
    const wins = completedMatches.filter(m => m.match?.result === 'won').length;
    const losses = completedMatches.filter(m => m.match?.result === 'lost').length;
    const draws = completedMatches.filter(m => m.match?.result === 'draw').length;

    return {
      totalMatches: matches.length,
      completedMatches: completedMatches.length,
      wins,
      losses,
      draws,
      winRate: completedMatches.length > 0 ? Math.round((wins / completedMatches.length) * 100) : 0,
    };
  };

  return {
    tournaments,
    loading,
    error,
    fetchTournaments,
    addTournament,
    updateTournament,
    deleteTournament,
    addMatchToTournament,
    removeMatchFromTournament,
    getTournamentStats,
  };
}
