import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberCricketStats } from '../types';

// Helper: compare two "5/14"-style bowling figures and return the better one.
// Better = more wickets, tie-broken by fewer runs.
function pickBetterBowling(a: string | null, b: string | null): string {
  if (!a) return b || '';
  if (!b) return a;
  const pa = a.match(/(\d+)\/(\d+)/);
  const pb = b.match(/(\d+)\/(\d+)/);
  if (!pa) return b;
  if (!pb) return a;
  const aw = parseInt(pa[1]), ar = parseInt(pa[2]);
  const bw = parseInt(pb[1]), br = parseInt(pb[2]);
  if (bw > aw) return b;
  if (bw === aw && br < ar) return b;
  return a;
}

// Overs are stored in "200.2" format (200 complete overs + 2 extra balls).
// This is NOT a real decimal — 200.2 ≠ 200.33. Use these helpers for arithmetic.
function oversToBalls(o: number): number {
  const complete = Math.floor(o);
  const extra = Math.round((o - complete) * 10); // .2 → 2
  return complete * 6 + extra;
}
function ballsToOvers(balls: number): number {
  const complete = Math.floor(balls / 6);
  const extra = balls % 6;
  return parseFloat(`${complete}.${extra}`);
}
function oversToReal(o: number): number {
  // real decimal overs for arithmetic (economy = runs / oversToReal(overs))
  return oversToBalls(o) / 6;
}

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
        // Aggregate all seasons by summing per-member rows
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .order('batting_runs', { ascending: false });
        if (error) throw error;

        const byMember: Record<string, MemberCricketStats> = {};
        for (const row of (data || []) as MemberCricketStats[]) {
          // Skip non-year rows ('all-time', etc.) to prevent double-counting.
          // The 'all' view sums individual year-season rows only.
          if (!YEAR_SEASON.test(row.season)) continue;

          const existing = byMember[row.member_id];
          if (!existing) {
            byMember[row.member_id] = { ...row, season: 'all' };
            continue;
          }

          // Overs: convert to balls first (200.2 format ≠ real decimal), add, convert back
          const existingBalls = oversToBalls(existing.bowling_overs);
          const rowBalls      = oversToBalls(row.bowling_overs);
          const totalBalls    = existingBalls + rowBalls;

          const merged: MemberCricketStats = {
            ...existing,
            batting_matches:       existing.batting_matches  + row.batting_matches,
            batting_innings:       existing.batting_innings  + row.batting_innings,
            batting_runs:          existing.batting_runs     + row.batting_runs,
            batting_fours:         existing.batting_fours    + row.batting_fours,
            batting_sixes:         existing.batting_sixes    + row.batting_sixes,
            batting_fifties:       existing.batting_fifties  + row.batting_fifties,
            batting_hundreds:      existing.batting_hundreds + row.batting_hundreds,
            batting_ducks:         existing.batting_ducks    + row.batting_ducks,
            batting_highest_score: Math.max(existing.batting_highest_score || 0, row.batting_highest_score || 0),
            bowling_innings:       existing.bowling_innings  + row.bowling_innings,
            bowling_overs:         ballsToOvers(totalBalls),
            bowling_runs_conceded: existing.bowling_runs_conceded + row.bowling_runs_conceded,
            bowling_wickets:       existing.bowling_wickets  + row.bowling_wickets,
            bowling_five_wickets:  existing.bowling_five_wickets + row.bowling_five_wickets,
            bowling_best_figures:  pickBetterBowling(existing.bowling_best_figures, row.bowling_best_figures),
            fielding_catches:      existing.fielding_catches   + row.fielding_catches,
            fielding_stumpings:    existing.fielding_stumpings + row.fielding_stumpings,
            fielding_run_outs:     existing.fielding_run_outs  + row.fielding_run_outs,
          };

          // Recompute derived stats using correct ball-based arithmetic
          merged.batting_average = merged.batting_innings > 0
            ? Math.round((merged.batting_runs / merged.batting_innings) * 100) / 100 : 0;
          // Batting SR: weighted by runs contributed per season
          const totalRuns = existing.batting_runs + row.batting_runs;
          merged.batting_strike_rate = totalRuns > 0
            ? Math.round(((existing.batting_strike_rate * existing.batting_runs) + (row.batting_strike_rate * row.batting_runs)) / totalRuns * 100) / 100 : 0;

          // Bowling: use oversToReal() for economy (real decimal, not 200.2 format)
          const realOvers = oversToReal(merged.bowling_overs);
          merged.bowling_economy     = realOvers > 0
            ? Math.round((merged.bowling_runs_conceded / realOvers) * 100) / 100 : 0;
          merged.bowling_average     = merged.bowling_wickets > 0
            ? Math.round((merged.bowling_runs_conceded / merged.bowling_wickets) * 100) / 100 : 0;
          merged.bowling_strike_rate = merged.bowling_wickets > 0
            ? Math.round((totalBalls / merged.bowling_wickets) * 100) / 100 : 0;

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
