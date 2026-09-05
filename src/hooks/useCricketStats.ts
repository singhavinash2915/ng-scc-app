import { CURRENT_SEASON } from '../config/season';
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


/** Add two stats rows for the same member together.
 *
 *  Used for two different jobs: rolling several seasons into a career total,
 *  and adding a member's external and MahaSangram rows into a Combined view.
 *  Both are the same arithmetic, and it is arithmetic that has to be done on
 *  raw counts — an average, a strike rate and an economy cannot be averaged
 *  with each other, and bowling_overs is overs.balls notation, where 34.3 + 34.3
 *  is not 68.6. Everything derived is recomputed from the summed counts.
 */
/** Times out, for a row that may predate the column.
 *
 *  batting_dismissals is only populated by syncs that ran after the scope
 *  migration, so older rows carry 0 — and 0 would make a merged average fall
 *  back to "runs", which is not an average at all. Every row does carry the
 *  average the sync computed for it, and that average WAS runs/dismissals, so
 *  the count can be recovered from it exactly: runs / average. Anything with no
 *  average has no completed dismissal to contribute either.
 */
function outsOf(r: MemberCricketStats): number {
  if (r.batting_dismissals && r.batting_dismissals > 0) return r.batting_dismissals;
  if (r.batting_average > 0 && r.batting_runs > 0) return Math.round(r.batting_runs / r.batting_average);
  return 0;
}

/** Balls faced, recovered the same way when the column predates the migration. */
function ballsFacedOf(r: MemberCricketStats): number {
  if (r.batting_balls && r.batting_balls > 0) return r.batting_balls;
  if (r.batting_strike_rate > 0 && r.batting_runs > 0) {
    return Math.round((r.batting_runs / r.batting_strike_rate) * 100);
  }
  return 0;
}

function mergeStatRows(existing: MemberCricketStats, row: MemberCricketStats, season: string): MemberCricketStats {
  const sumRuns    = existing.batting_runs    + row.batting_runs;
  const sumOuts    = outsOf(existing)      + outsOf(row);
  const sumFaced   = ballsFacedOf(existing) + ballsFacedOf(row);
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
  return {
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
    // A batting average is runs per DISMISSAL, not per innings. Dividing by
    // innings counted every not-out as a completed one, so every career and
    // combined average in the app read low — the more often someone finished
    // not out, the further out their number was.
    batting_average:       sumOuts > 0 ? Math.round((sumRuns / sumOuts) * 100) / 100 : sumRuns,
    // Strike rate is runs per 100 balls, so it combines on balls faced. Weighting
    // the two rates by runs — as this did — flatters the higher-scoring row and
    // is only ever accidentally right.
    batting_strike_rate:   sumFaced > 0 ? Math.round((sumRuns / sumFaced) * 10000) / 100 : 0,
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
    // Carry the recovered counts, not the raw columns, so a merge of merges
    // stays consistent instead of collapsing back to 0 on legacy rows.
    batting_balls:         sumFaced,
    batting_dismissals:    sumOuts,
    bowling_balls:         (existing.bowling_balls ?? 0)      + (row.bowling_balls ?? 0),
    season,
  };
}

/** Which cricket a stats view is counting. */
export type StatScope = 'external' | 'internal' | 'combined';

export function useCricketStats(season: string = CURRENT_SEASON, scope: StatScope = 'external') {
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
      // The authoritative fielding numbers come from CricHeroes' TEAM fielding
      // leaderboard, which only covers matches against other clubs — there is no
      // such board for MahaSangram. So this override applies to the external
      // view only; an internal or combined view keeps what the sync parsed.
      const { data: ftRows } = scope === 'external' ? await supabase
        .from('member_cricket_stats')
        .select('*')
        .eq('season', 'all-time')
        .eq('scope', 'external') : { data: [] as MemberCricketStats[] };
      const fieldMap = new Map((ftRows || []).map(r => [r.member_id, r as MemberCricketStats]));
      const applyField = (arr: MemberCricketStats[]) => arr.map(s => {
        const f = fieldMap.get(s.member_id);
        return f ? {
          ...s,
          fielding_catches: f.fielding_catches,
          fielding_caught_behind: f.fielding_caught_behind ?? 0,
          fielding_stumpings: f.fielding_stumpings,
          fielding_run_outs: f.fielding_run_outs,
        } : s;
      });

      if (season === 'all') {
        // Overall (career): sum each season row per member.
        // Each season row contains only that season's stats (isolated sync with date filter),
        // so summing gives correct career totals without double-counting.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .in('scope', scope === 'combined' ? ['external', 'internal'] : [scope])
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
          return mergeStatRows(existing, row, 'all');
        }
        setStats(applyField(Object.values(byMember).sort((a, b) => b.batting_runs - a.batting_runs)));
      } else {
        // Season-specific: each row is isolated to that season, use directly.
        const { data, error } = await supabase
          .from('member_cricket_stats')
          .select('*, member:members(id, name, avatar_url, matches_played)')
          .eq('season', season)
          .in('scope', scope === 'combined' ? ['external', 'internal'] : [scope])
          .order('batting_runs', { ascending: false });
        if (error) throw error;

        // A member now has up to one row per scope. Left as-is they would appear
        // on the leaderboard twice — once for each — so Combined adds them.
        const rows = (data || []) as MemberCricketStats[];
        if (scope === 'combined') {
          const byMember: Record<string, MemberCricketStats> = {};
          for (const row of rows) {
            const existing = byMember[row.member_id];
            byMember[row.member_id] = existing ? mergeStatRows(existing, row, season) : { ...row };
          }
          setStats(applyField(Object.values(byMember).sort((a, b) => b.batting_runs - a.batting_runs)));
        } else {
          setStats(applyField(rows));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [season, scope]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const upsertStats = async (memberId: string, statsData: Partial<MemberCricketStats>) => {
    try {
      const { data, error } = await supabase
        .from('member_cricket_stats')
        .upsert(
          { ...statsData, member_id: memberId, season, scope: scope === 'combined' ? 'external' : scope, updated_at: new Date().toISOString(), last_synced_at: new Date().toISOString() },
          { onConflict: 'member_id,season,scope' }
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
