import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberCricketStats } from '../types';


// Only aggregate rows from named year-seasons (e.g. '2025-26', '2024-25').
// Each season row now contains ONLY that season's stats (properly synced with date filter).
const YEAR_SEASON = /^\d{4}-\d{2}$/;

function oversToBalls(o: number): number {
  const complete = Math.floor(o);
  return complete * 6 + Math.round((o - complete) * 10);
}
function ballsToOvers(balls: number): number {
  return parseFloat(`${Math.floor(balls / 6)}.${balls % 6}`);
}

export function useCricketStats(season: string = '2025-26') {
  const [stats, setStats] = useState<MemberCricketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      // Authoritative fielding comes from CricHeroes' team fielding leaderboard
      // (stored in the 'all-time' row by sync_cricheroes.py). The per-match
      // dismissal-text parse used for season rows badly overcounts catches
      // (it can't reliably attribute a catch to the right fielder), so we
      // overwrite every row's fielding with these career-accurate numbers.
      const { data: ftRows } = await supabase
        .from('member_cricket_stats')
        .select('member_id, fielding_catches, fielding_stumpings, fielding_run_outs')
        .eq('season', 'all-time');
      const fieldMap = new Map((ftRows || []).map(r => [r.member_id, r]));
      const applyField = (arr: MemberCricketStats[]) => arr.map(s => {
        const f = fieldMap.get(s.member_id);
        return f ? { ...s, fielding_catches: f.fielding_catches, fielding_stumpings: f.fielding_stumpings, fielding_run_outs: f.fielding_run_outs } : s;
      });

      if (season === 'all') {
        // Overall (career): sum each season row per member.
        // Each season row contains only that season's stats (isolated sync with date filter),
        // so summing gives correct career totals without double-counting.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .order('batting_runs', { ascending: false });
        if (error) throw error;

        const byMember: Record<string, MemberCricketStats> = {};
        for (const row of (data || []) as MemberCricketStats[]) {
          if (!YEAR_SEASON.test(row.season)) continue;
          const existing = byMember[row.member_id];
          if (!existing) {
            byMember[row.member_id] = { ...row, season: 'all' };
            continue;
          }
          const sumRuns    = existing.batting_runs    + row.batting_runs;
          const sumInnings = existing.batting_innings + row.batting_innings;
          const sumWkts    = existing.bowling_wickets + row.bowling_wickets;
          const totalBalls = oversToBalls(existing.bowling_overs || 0) + oversToBalls(row.bowling_overs || 0);
          const sumRunsCon = existing.bowling_runs_conceded + row.bowling_runs_conceded;
          const betterFigs = (() => {
            const a = existing.bowling_best_figures, b = row.bowling_best_figures;
            if (!a) return b || ''; if (!b) return a;
            const pa = a.match(/(\d+)\/(\d+)/), pb = b.match(/(\d+)\/(\d+)/);
            if (!pa) return b; if (!pb) return a;
            if (parseInt(pb[1]) > parseInt(pa[1])) return b;
            if (parseInt(pb[1]) === parseInt(pa[1]) && parseInt(pb[2]) < parseInt(pa[2])) return b;
            return a;
          })();
          byMember[row.member_id] = {
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
            batting_strike_rate:   sumRuns > 0
              ? Math.round(((existing.batting_strike_rate * existing.batting_runs) + (row.batting_strike_rate * row.batting_runs)) / sumRuns * 100) / 100
              : 0,
            bowling_innings:       existing.bowling_innings       + row.bowling_innings,
            bowling_overs:         ballsToOvers(totalBalls),
            bowling_runs_conceded: sumRunsCon,
            bowling_wickets:       sumWkts,
            bowling_five_wickets:  existing.bowling_five_wickets  + row.bowling_five_wickets,
            bowling_best_figures:  betterFigs,
            bowling_economy:       totalBalls > 0 ? Math.round((sumRunsCon / (totalBalls / 6)) * 100) / 100 : 0,
            bowling_average:       sumWkts > 0 ? Math.round((sumRunsCon / sumWkts) * 100) / 100 : 0,
            bowling_strike_rate:   sumWkts > 0 ? Math.round((totalBalls / sumWkts) * 100) / 100 : 0,
            fielding_catches:      existing.fielding_catches      + row.fielding_catches,
            fielding_stumpings:    existing.fielding_stumpings    + row.fielding_stumpings,
            fielding_run_outs:     existing.fielding_run_outs     + row.fielding_run_outs,
            season:                'all',
          };
        }
        setStats(applyField(Object.values(byMember).sort((a, b) => b.batting_runs - a.batting_runs)));
      } else {
        // Season-specific: each row is isolated to that season, use directly.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .eq('season', season)
          .order('batting_runs', { ascending: false });
        if (error) throw error;
        setStats(applyField(data || []));
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
