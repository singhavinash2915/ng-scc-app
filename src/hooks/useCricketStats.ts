import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberCricketStats } from '../types';


// Only aggregate rows from named year-seasons (e.g. '2025-26', '2024-25').
// Excludes special labels like 'all-time' to prevent double-counting.
const YEAR_SEASON = /^\d{4}-\d{2}$/;

export function useCricketStats(season: string = '2025-26') {
  const [stats, setStats] = useState<MemberCricketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      if (season === 'all') {
        // Overall (career): the '2025-26' sync was run without a date filter so those rows
        // already contain ALL-TIME career stats. Older season rows (2024-25 etc.) are subsets.
        // Summing would double-count. Instead, pick the row with the MOST innings per member
        // — that is always the cumulative career row.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .order('batting_runs', { ascending: false });
        if (error) throw error;

        const byMember: Record<string, MemberCricketStats> = {};
        for (const row of (data || []) as MemberCricketStats[]) {
          if (!YEAR_SEASON.test(row.season)) continue; // skip 'all-time' etc.
          const existing = byMember[row.member_id];
          // Keep the row with the most innings — that is the most complete / career dataset
          if (!existing || row.batting_innings > existing.batting_innings) {
            byMember[row.member_id] = { ...row, season: 'all' };
          }
        }
        setStats(Object.values(byMember).sort((a, b) => b.batting_runs - a.batting_runs));
      } else {
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .eq('season', season)
          .order('batting_runs', { ascending: false });
        if (error) throw error;
        setStats(data || []);
      }
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
