import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberCricketStats } from '../types';


// Only aggregate rows from named year-seasons (e.g. '2025-26', '2024-25').
const YEAR_SEASON = /^\d{4}-\d{2}$/;

// Season rows are CUMULATIVE snapshots. '2025-26' = career total, '2024-25' = total up to Aug 2025.
// To get an individual season's stats, subtract the previous season's cumulative row.
// Season ordering: older seasons have smaller start years.
const SEASON_ORDER = ['2023-24', '2024-25', '2025-26'];

function prevSeason(s: string): string | null {
  const idx = SEASON_ORDER.indexOf(s);
  return idx > 0 ? SEASON_ORDER[idx - 1] : null;
}

// Subtract prev cumulative row from curr cumulative row to get one season's delta.
function deltaStats(curr: MemberCricketStats, prev: MemberCricketStats | null): MemberCricketStats {
  if (!prev) return curr;
  const runs    = Math.max(0, curr.batting_runs    - prev.batting_runs);
  const innings = Math.max(0, curr.batting_innings - prev.batting_innings);
  const wkts    = Math.max(0, curr.bowling_wickets - prev.bowling_wickets);
  const toB = (o: number) => { const c = Math.floor(o); return c * 6 + Math.round((o - c) * 10); };
  const frB = (b: number) => parseFloat(`${Math.floor(b / 6)}.${b % 6}`);
  const totalBalls = Math.max(0, toB(curr.bowling_overs || 0) - toB(prev.bowling_overs || 0));
  const runsCon = Math.max(0, curr.bowling_runs_conceded - prev.bowling_runs_conceded);
  return {
    ...curr,
    batting_runs:          runs,
    batting_innings:       innings,
    batting_matches:       Math.max(0, curr.batting_matches   - prev.batting_matches),
    batting_fours:         Math.max(0, curr.batting_fours     - prev.batting_fours),
    batting_sixes:         Math.max(0, curr.batting_sixes     - prev.batting_sixes),
    batting_fifties:       Math.max(0, curr.batting_fifties   - prev.batting_fifties),
    batting_hundreds:      Math.max(0, curr.batting_hundreds  - prev.batting_hundreds),
    batting_ducks:         Math.max(0, curr.batting_ducks     - prev.batting_ducks),
    batting_average:       innings > 0 ? Math.round((runs / innings) * 100) / 100 : 0,
    batting_strike_rate:   curr.batting_strike_rate, // SR not easily delta-able, keep as-is
    bowling_wickets:       wkts,
    bowling_overs:         frB(totalBalls),
    bowling_runs_conceded: runsCon,
    bowling_five_wickets:  Math.max(0, curr.bowling_five_wickets - prev.bowling_five_wickets),
    bowling_economy:       totalBalls > 0 ? Math.round((runsCon / (totalBalls / 6)) * 100) / 100 : 0,
    bowling_average:       wkts > 0 ? Math.round((runsCon / wkts) * 100) / 100 : 0,
    bowling_strike_rate:   wkts > 0 ? Math.round((totalBalls / wkts) * 100) / 100 : 0,
    fielding_catches:      Math.max(0, curr.fielding_catches   - prev.fielding_catches),
    fielding_stumpings:    Math.max(0, curr.fielding_stumpings - prev.fielding_stumpings),
    fielding_run_outs:     Math.max(0, curr.fielding_run_outs  - prev.fielding_run_outs),
  };
}

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
        // Season rows are cumulative — subtract previous season to get this season's delta.
        const prev = prevSeason(season);

        const [currRes, prevRes] = await Promise.all([
          supabase.from('member_cricket_stats')
            .select('*, member:members(id, name, avatar_url, matches_played)')
            .eq('season', season)
            .order('batting_runs', { ascending: false }),
          prev
            ? supabase.from('member_cricket_stats').select('*').eq('season', prev)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (currRes.error) throw currRes.error;

        // Build prev lookup by member_id
        const prevByMember: Record<string, MemberCricketStats> = {};
        for (const r of (prevRes.data || []) as MemberCricketStats[]) {
          prevByMember[r.member_id] = r;
        }

        const deltaRows = (currRes.data || []).map((row: MemberCricketStats) =>
          deltaStats(row, prevByMember[row.member_id] ?? null)
        );
        setStats(deltaRows.sort((a, b) => b.batting_runs - a.batting_runs));
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
