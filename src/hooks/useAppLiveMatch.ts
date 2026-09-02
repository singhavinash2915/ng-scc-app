import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { internalSides } from '../utils/internalTeams';

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

    // batting_team is stored as the SIDE KEY — 'home' / 'away' — and the name
    // lives on the fixture. Reading the column straight out put the literal
    // word "home" on the Dashboard, so the banner announced "home 0/0 v away"
    // to everyone opening the app. Resolve it the way the scoring page does.
    const { data: match } = await supabase
      .from('matches')
      .select('opponent, match_type')
      .eq('id', row.match_id)
      .maybeSingle();

    const s2 = internalSides(match ?? null);
    const nameOf = (key: string) =>
      match?.match_type === 'internal'
        ? (key === 'home' ? s2.home : s2.away)
        : (key === 'home' ? 'Sangria CC' : match?.opponent || 'Opponent');

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
      battingTeam: nameOf(row.batting_team),
      bowlingTeam: nameOf(row.bowling_team),
      target: row.target,
      runs, wickets, legalBalls,
    });
    setLoading(false);
  }, []);

  // Realtime on the innings row, poll as a backstop. The banner's whole job is
  // to be right at two exact moments — the toss, and the result going up — and
  // a 30-second poll can be half an over late to both. Subscribing to
  // scc_innings makes it appear on the toss and clear on the result.
  //
  // The poll stays because a socket can drop silently (backgrounded phone,
  // ground wifi) and a live banner that cannot switch itself off is worse than
  // one that is slow. Needs scc_innings in the supabase_realtime publication —
  // see supabase/migrations/add_scoring_realtime.sql. Without it the
  // subscription is simply inert and the poll carries it.
  useEffect(() => {
    void check();
    const channel = supabase
      .channel('app_live_innings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scc_innings' },
        () => { void check(); })
      .subscribe();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => { supabase.removeChannel(channel); window.clearInterval(id); };
  }, [check]);

  return { live, loading, refresh: check };
}
