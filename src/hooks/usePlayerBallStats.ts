import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface PlayerBallRow {
  member_id: string;
  season: string;      // 'YYYY-YY'
  balls_faced: number;
  dot_balls: number;
}

export interface BallStat {
  balls_faced: number;
  dot_balls: number;
  dot_pct: number;     // 0–100
}

/**
 * Per-batsman balls faced + dot balls (from ball-by-ball commentary, populated
 * by scripts/sync_ball_by_ball.py). `season` matches the Leaderboard's selector
 * ('2025-26' etc., or 'all' to sum every season). Returns a member_id → BallStat
 * map; empty until the table exists and the sync has run.
 */
export function usePlayerBallStats(season: string = 'all') {
  const [rows, setRows] = useState<PlayerBallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('player_ball_stats')
        .select('member_id, season, balls_faced, dot_balls');
      if (cancelled) return;
      // Missing table / not yet synced → behave as "no data" (column shows —)
      setRows(error ? [] : (data as PlayerBallRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const byMember = useMemo(() => {
    const map: Record<string, BallStat> = {};
    for (const r of rows) {
      if (season !== 'all' && r.season !== season) continue;
      const cur = map[r.member_id] ?? { balls_faced: 0, dot_balls: 0, dot_pct: 0 };
      cur.balls_faced += r.balls_faced;
      cur.dot_balls += r.dot_balls;
      map[r.member_id] = cur;
    }
    for (const s of Object.values(map)) {
      s.dot_pct = s.balls_faced > 0 ? (s.dot_balls / s.balls_faced) * 100 : 0;
    }
    return map;
  }, [rows, season]);

  return { byMember, loading, hasData: rows.length > 0 };
}
