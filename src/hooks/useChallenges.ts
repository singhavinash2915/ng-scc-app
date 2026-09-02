import { CURRENT_SEASON } from '../config/season';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useMe } from '../context/MemberContext';
import { useCricketStats } from './useCricketStats';
import { suggestChallenges, standingFromScorecards, standingFromBalls,
         standingFromTarget, buildMatcher, metricDef,
         type Metric, type Suggestion, type SeasonLine,
         type Standing, type ScorecardMatchRow } from '../lib/challenges';
import { useAllScorecards } from './useAllScorecards';
import { useMembers } from './useMembers';
import { useMatches } from './useMatches';
import type { Ball } from '../lib/cricketRules';

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
  stake: string | null;
  /** Target challenges: the fixture that decides it. Null = any match. */
  match_id: string | null;
  /** Frozen at settlement — see the migration comment. */
  final_standings: Standing[] | null;
  /** Set when it was settled — the ladder needs an order to read streaks from. */
  settled_at?: string | null;
  players?: Array<{ member_id: string; accepted: boolean }>;
}

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useChallenges() {
  const { me } = useMe();
  const { stats } = useCricketStats(CURRENT_SEASON);
  const { members } = useMembers();
  const { matches } = useMatches();
  const { scorecards } = useAllScorecards();
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  /**
   * Every ball we've scored ourselves. Only needed for the four ball-level
   * metrics, so it's fetched once and only when a live challenge actually uses
   * one — a page of scorecard challenges shouldn't pay for it.
   */
  const [balls, setBalls] = useState<Ball[]>([]);

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

  const needsBalls = useMemo(
    () => rows.some(r => r.status !== 'settled' && metricDef(r.metric).needsBalls),
    [rows]);

  useEffect(() => {
    if (!needsBalls || balls.length) return;
    void (async () => {
      const { data } = await supabase.from('scc_ball_by_ball')
        .select('seq, over_no, ball_no, striker_id, non_striker_id, bowler_id, runs_off_bat, extra_type, extra_runs, wicket_type, dismissed_id, fielder_id, innings');
      setBalls((data as Ball[]) ?? []);
    })();
  }, [needsBalls, balls.length]);

  /**
   * Per-match rows, flattened out of the innings JSON. A target challenge asks
   * "did you do it in ONE match", which season totals cannot answer.
   */
  const matchRows = useMemo<ScorecardMatchRow[]>(() => {
    const out: ScorecardMatchRow[] = [];
    const dateOf = new Map(matches.map(m => [m.id, m.date]));
    for (const sc of scorecards ?? []) {
      const date = dateOf.get(sc.match_id) ?? '';
      for (const inn of [
        { bat: sc.innings1_batting, bowl: sc.innings1_bowling },
        { bat: sc.innings2_batting, bowl: sc.innings2_bowling },
      ]) {
        for (const b of inn.bat ?? []) {
          out.push({ matchId: sc.match_id, date, name: b.name, runs: b.runs ?? 0,
                     fours: b['4s'] ?? 0, sixes: b['6s'] ?? 0, wickets: 0, catches: 0 });
        }
        for (const b of inn.bowl ?? []) {
          out.push({ matchId: sc.match_id, date, name: b.name, wickets: b.wickets ?? 0,
                     runs: 0, fours: 0, sixes: 0, catches: 0 });
        }
      }
    }
    return out;
  }, [scorecards, matches]);

  const nameMatcher = useMemo(() => buildMatcher(members), [members]);

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
  const standingsFor = useCallback((c: ChallengeRow): Standing[] => {
    // A finished challenge keeps the numbers it finished on. Recomputing it
    // would let a later scorecard correction quietly change who won.
    if (c.status === 'settled' && c.final_standings) return c.final_standings;

    const ids = new Set((c.players ?? []).filter(p => p.accepted).map(p => p.member_id));

    // "First to N in a match" — a single-match feat, not a season total.
    if (c.kind === 'target' && c.target) {
      const fixture = c.match_id ? matches.find(m => m.id === c.match_id) : null;
      return standingFromTarget(c.metric, c.target, matchRows, nameMatcher, [...ids],
                                c.match_id, fixture?.result === 'upcoming')
        .map(t => ({ memberId: t.memberId, value: t.best, qualified: t.hit, detail: t.detail }));
    }

    if (metricDef(c.metric).needsBalls) {
      // Chase strike rate only counts second-innings deliveries — runs against
      // a required rate are a different thing from runs at a free total.
      const src = c.metric === 'chase_strike_rate'
        ? balls.filter(b => (b as Ball & { innings?: number }).innings === 2)
        : balls;
      return standingFromBalls(c.metric, src, [...ids]);
    }
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
  }, [stats, balls, matchRows, nameMatcher, matches]);

  const create = useCallback(async (
    metric: Metric, opponentIds: string[], closesOn: string | null,
    title?: string, stake?: string | null, target?: number | null,
    matchId?: string | null,
  ) => {
    if (!me) return 'Sign in first';
    const { data, error } = await supabase.from('scc_challenges')
      .insert({ metric, kind: target ? 'target' : 'h2h', target: target ?? null,
                match_id: matchId ?? null,
                created_by: me.id, closes_on: closesOn,
                title: title ?? null, stake: stake || null })
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

    // Reach their phone even with the app closed. Targeted at the one person
    // challenged — broadcasting this to all 46 is how an app gets muted.
    // Fire-and-forget: a failed push must never fail the challenge.
    for (const id of opponentIds) {
      void supabase.functions.invoke('send-push', {
        body: {
          memberId: id,
          title: `${me.name} challenged you ⚔️`,
          body: `${metricDef(metric).label}${stake ? ` — loser ${stake}` : ''}`,
          url: '/challenges',
          tag: `challenge-${data.id}`,
        },
      }).then(() => undefined, () => undefined);
    }

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

  /**
   * Withdraw a challenge nobody has taken up.
   *
   * Only while it's unaccepted, and only by whoever sent it. Once the other
   * person has agreed it stops being yours to cancel — that's the moment a
   * stake becomes real, and letting the loser quietly delete a contest they're
   * behind in would make the whole thing worthless.
   */
  const withdraw = useCallback(async (c: ChallengeRow) => {
    if (!me || c.created_by !== me.id) return 'Not yours to withdraw';
    if ((c.players ?? []).some(p => p.member_id !== me.id && p.accepted)) {
      return 'They\u2019ve already accepted — this one has to be played out.';
    }
    await supabase.from('scc_challenge_players').delete().eq('challenge_id', c.id);
    const { error } = await supabase.from('scc_challenges').delete().eq('id', c.id);
    if (error) return error.message;
    await fetchRows();
    return null;
  }, [me, fetchRows]);

  /** Change the terms while it's still unaccepted. Same rule as withdraw. */
  const edit = useCallback(async (
    c: ChallengeRow, patch: { target?: number | null; stake?: string | null; match_id?: string | null },
  ) => {
    if (!me || c.created_by !== me.id) return 'Not yours to edit';
    if ((c.players ?? []).some(p => p.member_id !== me.id && p.accepted)) {
      return 'They\u2019ve already accepted — the terms are fixed now.';
    }
    const { error } = await supabase.from('scc_challenges').update(patch).eq('id', c.id);
    if (error) return error.message;
    await fetchRows();
    return null;
  }, [me, fetchRows]);

  /**
   * End a challenge and freeze the result. Either player can settle — a
   * challenge that needs an admin to close it never gets closed, and between
   * two people who agreed to it there is nobody to defraud.
   */
  const settle = useCallback(async (c: ChallengeRow) => {
    const standings = standingsFor(c);
    const qualified = standings.filter(s => s.qualified);
    // Nobody qualified means nobody won. Declaring a winner off two balls
    // faced would make the whole feature untrustworthy.
    const winner = qualified.length ? qualified[0].memberId : null;
    await supabase.from('scc_challenges').update({
      status: 'settled', winner_id: winner,
      final_standings: standings, settled_at: new Date().toISOString(),
    }).eq('id', c.id);
    await fetchRows();
    return winner;
  }, [standingsFor, fetchRows]);

  /** Mine first — a member opens this page to see their own, not the club's. */
  const mine = useMemo(() =>
    rows.filter(r => (r.players ?? []).some(p => p.member_id === me?.id)), [rows, me]);

  /**
   * Waiting on YOU. Members kept asking "where do I see who challenged me",
   * which meant the answer — buried among your own challenges — wasn't an
   * answer. It gets its own section at the top now.
   */
  const inbox = useMemo(() => mine.filter(r =>
    r.status !== 'settled' &&
    (r.players ?? []).some(p => p.member_id === me?.id && !p.accepted)), [mine, me]);

  /** Yours, already agreed or sent — the ones actually running. */
  const active = useMemo(() => mine.filter(r => !inbox.includes(r)), [mine, inbox]);

  /**
   * Everyone else's. A challenge nobody can see is a private bet, and the
   * stake only bites when the club is watching — so the club board shows every
   * accepted challenge and, once settled, who won.
   */
  // Everything that isn't yours, PENDING INCLUDED. The club asked to see all
  // of them: a board that only shows agreed contests hides exactly the ones
  // people are gossiping about — "has he accepted yet?" is half the fun.
  const club = useMemo(() =>
    rows.filter(r => !(r.players ?? []).some(p => p.member_id === me?.id)), [rows, me]);

  return { rows, mine, inbox, active, club, suggestions, standingsFor, create, respond, settle,
           withdraw, edit,
           loading, tableMissing, refetch: fetchRows };
}
