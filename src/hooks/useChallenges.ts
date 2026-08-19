import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useMe } from '../context/MemberContext';
import { useCricketStats } from './useCricketStats';
import { suggestChallenges, standingFromScorecards,
         type Metric, type Suggestion, type SeasonLine } from '../lib/challenges';

// ─── Challenges ───────────────────────────────────────────────────────────────
// Reads the same season stats the leaderboard uses, so a challenge can never
// disagree with the rankings — there is no separate score being kept.

export interface ChallengeRow {
  id: string;
  metric: Metric;
  kind: 'h2h' | 'target';
  target: number | null;
  starts_on: string;
  closes_on: string | null;
  created_by: string | null;
  title: string | null;
  status: 'open' | 'live' | 'settled' | 'declined' | 'cancelled';
  winner_id: string | null;
  players?: Array<{ member_id: string; accepted: boolean }>;
}

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useChallenges() {
  const { me } = useMe();
  const { stats } = useCricketStats('2025-26');
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('scc_challenges')
      .select('*, players:scc_challenge_players(member_id, accepted)')
      .order('created_at', { ascending: false });
    if (isMissing(error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);
    setRows((data as ChallengeRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  /** Season lines, shared by the suggestion engine and every leaderboard. */
  const lines = useMemo<SeasonLine[]>(() => stats.map(s => ({
    memberId: s.member_id,
    runs: s.batting_runs,
    wickets: s.bowling_wickets,
    catches: (s.fielding_catches ?? 0),
    matches: s.batting_matches ?? 0,
  })), [stats]);

  /** Rivalries the app spotted — the one-tap path. */
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!me) return [];
    const mine = lines.find(l => l.memberId === me.id);
    if (!mine) return [];
    // Never suggest a rematch of something already running.
    const busy = new Set(rows.filter(r => r.status === 'open' || r.status === 'live')
      .flatMap(r => (r.players ?? []).map(p => p.member_id)));
    return suggestChallenges(mine, lines.filter(l => !busy.has(l.memberId)));
  }, [me, lines, rows]);

  /** Where everyone stands in one challenge, computed not stored. */
  const standingsFor = useCallback((c: ChallengeRow) => {
    const ids = new Set((c.players ?? []).filter(p => p.accepted).map(p => p.member_id));
    const rowsForChallenge = stats
      .filter(s => ids.has(s.member_id))
      .map(s => ({
        member_id: s.member_id,
        batting_runs: s.batting_runs,
        // Balls faced isn't stored, but runs and strike rate are, and
        // SR = runs/balls × 100 — so balls falls out of the two. Guarded
        // against a zero SR, which would divide by nothing.
        batting_balls: s.batting_strike_rate > 0
          ? Math.round((s.batting_runs / s.batting_strike_rate) * 100) : 0,
        batting_fours: s.batting_fours ?? 0,
        batting_sixes: s.batting_sixes ?? 0,
        batting_fifties: s.batting_fifties ?? 0,
        bowling_wickets: s.bowling_wickets,
        bowling_runs_conceded: s.bowling_runs_conceded ?? 0,
        // bowling_overs is decimal overs (4.3 = 4 overs 3 balls in cricket
        // notation), so the fractional part is balls, not tenths.
        bowling_balls: Math.floor(s.bowling_overs) * 6
          + Math.round((s.bowling_overs % 1) * 10),
        fielding_catches: s.fielding_catches ?? 0,
      }));
    return standingFromScorecards(c.metric, rowsForChallenge);
  }, [stats]);

  const create = useCallback(async (
    metric: Metric, opponentIds: string[], closesOn: string | null, title?: string,
  ) => {
    if (!me) return 'Sign in first';
    const { data, error } = await supabase.from('scc_challenges')
      .insert({ metric, kind: 'h2h', created_by: me.id, closes_on: closesOn, title: title ?? null })
      .select().single();
    if (error) return error.message;

    // The challenger is in by definition; everyone else has to say yes. Nobody
    // appears on a public board because somebody named them.
    const players = [
      { challenge_id: data.id, member_id: me.id, accepted: true, responded_at: new Date().toISOString() },
      ...opponentIds.map(id => ({ challenge_id: data.id, member_id: id, accepted: false })),
    ];
    const { error: e2 } = await supabase.from('scc_challenge_players').insert(players);
    if (e2) return e2.message;
    await fetchRows();
    return null;
  }, [me, fetchRows]);

  const respond = useCallback(async (challengeId: string, accept: boolean) => {
    if (!me) return;
    await supabase.from('scc_challenge_players')
      .update({ accepted: accept, responded_at: new Date().toISOString() })
      .eq('challenge_id', challengeId).eq('member_id', me.id);
    if (accept) {
      await supabase.from('scc_challenges').update({ status: 'live' }).eq('id', challengeId);
    }
    await fetchRows();
  }, [me, fetchRows]);

  /** Mine first — a member opens this page to see their own, not the club's. */
  const mine = useMemo(() =>
    rows.filter(r => (r.players ?? []).some(p => p.member_id === me?.id)), [rows, me]);

  return { rows, mine, suggestions, standingsFor, create, respond,
           loading, tableMissing, refetch: fetchRows };
}
