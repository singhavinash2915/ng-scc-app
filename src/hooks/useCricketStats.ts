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
        // Overall (career): sum each member's stats across all year-season rows.
        // Each season row contains only that season's stats, so summing gives correct career totals.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .order('batting_runs', { ascending: false });
        if (error) throw error;

        const byMember: Record<string, MemberCricketStats> = {};
        for (const row of (data || []) as MemberCricketStats[]) {
          // Skip non-year rows ('all-time', etc.) to prevent double-counting.
          if (!YEAR_SEASON.test(row.season)) continue;

          const existing = byMember[row.member_id];
          if (!existing) {
            byMember[row.member_id] = { ...row, season: 'all' };
            continue;
          }

          // Sum batting
          const sumRuns    = existing.batting_runs    + row.batting_runs;
          const sumInnings = existing.batting_innings + row.batting_innings;
          // Batting SR: weighted by runs contributed per season
          const weightedSR = sumRuns > 0
            ? Math.round(((existing.batting_strike_rate * existing.batting_runs) + (row.batting_strike_rate * row.batting_runs)) / sumRuns * 100) / 100
            : 0;

          // Sum bowling — convert overs to balls, add, convert back
          const toBalls = (o: number) => { const c = Math.floor(o); return c * 6 + Math.round((o - c) * 10); };
          const fromBalls = (b: number) => parseFloat(`${Math.floor(b / 6)}.${b % 6}`);
          const totalBalls = toBalls(existing.bowling_overs || 0) + toBalls(row.bowling_overs || 0);
          const sumOvers   = fromBalls(totalBalls);
          const sumRunsCon = existing.bowling_runs_conceded + row.bowling_runs_conceded;
          const sumWkts    = existing.bowling_wickets + row.bowling_wickets;

          // Pick better bowling figures
          const betterFigs = (() => {
            const a = existing.bowling_best_figures, b = row.bowling_best_figures;
            if (!a) return b || ''; if (!b) return a;
            const pa = a.match(/(\d+)\/(\d+)/), pb = b.match(/(\d+)\/(\d+)/);
            if (!pa) return b; if (!pb) return a;
            if (parseInt(pb[1]) > parseInt(pa[1])) return b;
            if (parseInt(pb[1]) === parseInt(pa[1]) && parseInt(pb[2]) < parseInt(pa[2])) return b;
            return a;
          })();

          const merged: MemberCricketStats = {
            ...existing,
            batting_matches:       existing.batting_matches       + row.batting_matches,
            batting_innings:       sumInnings,
            batting_runs:          sumRuns,
            batting_fours:         existing.batting_fours         + row.batting_fours,
            batting_sixes:         existing.batting_sixes         + row.batting_sixes,
            batting_fifties:       existing.batting_fifties       + row.batting_fifties,
            batting_hundreds:      existing.batting_hundreds      + row.batting_hundreds,
            batting_ducks:         existing.batting_ducks         + row.batting_ducks,
            batting_highest_score: Math.max(existing.batting_highest_score || 0, row.batting_highest_score || 0),
            batting_average:       sumInnings > 0 ? Math.round((sumRuns / sumInnings) * 100) / 100 : 0,
            batting_strike_rate:   weightedSR,
            bowling_innings:       existing.bowling_innings       + row.bowling_innings,
            bowling_overs:         sumOvers,
            bowling_runs_conceded: sumRunsCon,
            bowling_wickets:       sumWkts,
            bowling_five_wickets:  existing.bowling_five_wickets  + row.bowling_five_wickets,
            bowling_best_figures:  betterFigs,
            bowling_economy:       totalBalls > 0 ? Math.round((sumRunsCon / (totalBalls / 6)) * 100) / 100 : 0,
            bowling_average:       sumWkts    > 0 ? Math.round((sumRunsCon / sumWkts)           * 100) / 100 : 0,
            bowling_strike_rate:   sumWkts    > 0 ? Math.round((totalBalls  / sumWkts)           * 100) / 100 : 0,
            fielding_catches:      existing.fielding_catches      + row.fielding_catches,
            fielding_stumpings:    existing.fielding_stumpings    + row.fielding_stumpings,
            fielding_run_outs:     existing.fielding_run_outs     + row.fielding_run_outs,
          };
          byMember[row.member_id] = merged;
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
