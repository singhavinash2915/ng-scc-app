import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Is a match being scored in the app right now? ────────────────────────────
// The Dashboard's existing live block keys off ch_match_id, so it only ever
// lights up for a match being scored on CricHeroes. A match scored HERE has no
// ch_match_id and was invisible — which is backwards, since that's the one we
// have ball-by-ball data for.
//
// "Live" means an innings row exists and isn't closed. That's set by the toss
// and cleared when the result is published, so it needs no extra flag to
// maintain and can't be left switched on by a scorer who closed the tab.

export interface AppLiveMatch {
  matchId: string;
  innings: 1 | 2;
  battingTeam: string;
  bowlingTeam: string;
  target: number | null;
  runs: number;
  wickets: number;
  legalBalls: number;
}

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

/** Polls slowly on purpose: the widget it feeds refreshes its own score. */
const POLL_MS = 30_000;

export function useAppLiveMatch() {
  const [live, setLive] = useState<AppLiveMatch | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    const { data: innings, error } = await supabase
      .from('scc_innings')
      .select('match_id, innings, batting_team, bowling_team, target, created_at')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1);

    if (isMissing(error) || !innings?.length) {
      setLive(null); setLoading(false); return;
    }
    const row = innings[0];

    // Only the totals — one row per ball would be a needless page of egress on
    // every Dashboard load, and the score is all this banner shows.
    const { data: balls } = await supabase
      .from('scc_ball_by_ball')
      .select('runs_off_bat, extra_type, extra_runs, wicket_type')
      .eq('match_id', row.match_id)
      .eq('innings', row.innings);

    let runs = 0, wickets = 0, legalBalls = 0;
    for (const b of balls ?? []) {
      runs += (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0);
      if (b.wicket_type && b.wicket_type !== 'retired') wickets += 1;
      if (b.extra_type !== 'wd' && b.extra_type !== 'nb') legalBalls += 1;
    }

    setLive({
      matchId: row.match_id,
      innings: row.innings as 1 | 2,
      battingTeam: row.batting_team,
      bowlingTeam: row.bowling_team,
      target: row.target,
      runs, wickets, legalBalls,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(id);
  }, [check]);

  return { live, loading, refresh: check };
}
