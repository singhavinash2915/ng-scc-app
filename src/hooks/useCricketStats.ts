import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberCricketStats } from '../types';

export function useCricketStats(season = '2025-26') {
  const [stats, setStats] = useState<MemberCricketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('member_cricket_stats')
        .select('*, member:members(id, name, avatar_url, matches_played)')
        .eq('season', season)
        .order('batting_runs', { ascending: false });

      if (error) throw error;
      setStats(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const upsertStats = async (memberId: string, statsData: Partial<MemberCricketStats>) => {
    try {
      const { data, error } = await supabase
        .from('member_cricket_stats')
        .upsert(
          { ...statsData, member_id: memberId, season, updated_at: new Date().toISOString(), last_synced_at: new Date().toISOString() },
          { onConflict: 'member_id,season' }
        )
        .select('*, member:members(id, name, avatar_url, matches_played)')
        .single();

      if (error) throw error;
      setStats(prev => {
        const exists = prev.find(s => s.member_id === memberId);
        if (exists) return prev.map(s => s.member_id === memberId ? data : s);
        return [...prev, data];
      });
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to save stats');
    }
  };

  const deleteStats = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('member_cricket_stats')
        .delete()
        .eq('member_id', memberId)
        .eq('season', season);

      if (error) throw error;
      setStats(prev => prev.filter(s => s.member_id !== memberId));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete stats');
    }
  };

  const getMemberStats = (memberId: string) => stats.find(s => s.member_id === memberId);

  const getLeaderboard = () => {
    return [...stats].sort((a, b) => {
      const scoreA = a.batting_runs * 1 + a.bowling_wickets * 20 + (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs) * 10;
      const scoreB = b.batting_runs * 1 + b.bowling_wickets * 20 + (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) * 10;
      return scoreB - scoreA;
    });
  };

  return { stats, loading, error, fetchStats, upsertStats, deleteStats, getMemberStats, getLeaderboard };
}
