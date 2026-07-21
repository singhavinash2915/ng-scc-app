import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Personal Season Goals ─────────────────────────────────────────────────────
// A member sets their own targets for the season ("600 runs / 40 wickets").
// Progress is computed by the caller from the season's synced CricHeroes stats.

export interface MemberGoalRow {
  id: string;
  season: string;
  member_id: string;
  goal_runs: number | null;
  goal_wickets: number | null;
}

const isMissingTable = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message);

export function useMemberGoals(season: string) {
  const [goals, setGoals] = useState<MemberGoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('member_goals')
      .select('*')
      .eq('season', season);
    if (error) {
      if (isMissingTable(error)) setTableMissing(true);
      setGoals([]);
    } else {
      setTableMissing(false);
      setGoals((data as MemberGoalRow[]) || []);
    }
    setLoading(false);
  }, [season]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveGoal = useCallback(async (memberId: string, goalRuns: number | null, goalWickets: number | null) => {
    const { error } = await supabase
      .from('member_goals')
      .upsert({
        season,
        member_id: memberId,
        goal_runs: goalRuns,
        goal_wickets: goalWickets,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'season,member_id' });
    if (error) return { success: false, error: error.message };
    await fetch();
    return { success: true };
  }, [season, fetch]);

  const myGoal = useCallback(
    (memberId: string | null) => (memberId ? goals.find(g => g.member_id === memberId) ?? null : null),
    [goals],
  );

  return { goals, loading, tableMissing, saveGoal, myGoal };
}
