import { useState, useEffect, useCallback } from 'react';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

export interface LiveBatter {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  sr: string;
  isStriker: boolean;
}

export interface LiveBowler {
  name: string;
  overs: string;          // "1.3" — over.balls notation
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
}

export interface LiveScoreData {
  battingTeam: string;
  bowlingTeam: string;
  score: string;
  overs: string;
  runRate: string;
  requiredRunRate: string;
  battingFirst: boolean;
  batsman1: string;
  batsman2: string;
  bowler: string;
  // ── Structured rows for the CricHeroes-style table view ─────────────────
  batters: LiveBatter[];      // active batters (striker first)
  bowlers: LiveBowler[];      // current bowler first, then previous
  partnership?: string;       // e.g. "13(8)"
  projectedScore?: number;    // when in 1st innings
  tossDetails?: string;       // e.g. "Toss: Sangria Cricket Club opt to bat"
  result: string;             // empty = in progress, filled = match over
  currentOver: string[];
  lastUpdated: Date;
}

const POLL_INTERVAL = 15000; // 15 seconds
const FN_BASE = `${supabaseUrl}/functions/v1/cricheroes`;

async function fetchPageProps(matchId: string, type: 'live' | 'scorecard') {
  const res = await fetch(`${FN_BASE}?matchId=${matchId}&type=${type}`, {
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
  });
  if (!res.ok) throw new Error(`cricheroes fn ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

type InnRaw = {
  teamName: string;
  inning: {
    summary?: { score?: string; over?: string; rr?: string };
    total_run?: number;
    total_wicket?: number;
  };
  batting: { name: string; runs: number; balls: number; how_to_out?: string }[];
  bowling: { name: string; overs: number; balls: number; maidens: number; runs: number; wickets: number }[];
};

// ─── miniScorecard.data shape (live-ball-by-ball feed from CricHeroes) ────────
type MiniTeam = {
  id: number;
  name: string;
  summary: string;       // "32/4" or "Yet to bat"
  innings: { inning: number; total_run: number; total_wicket: number; overs_played: string; summary?: { score?: string; over?: string; rr?: string } }[];
};
type MiniBatter = { name: string; runs: number; balls: number; '4s': number; '6s': number; strike_rate: string; status?: string };
type MiniBowler = { name: string; overs: number; balls: number; maidens: number; runs: number; wickets: number; economy_rate: string };
type MiniData = {
  status: 'live' | 'past';
  current_inning: number;
  overs: number;          // max overs for the match (e.g. 15)
  team_a: MiniTeam;
  team_b: MiniTeam;
  batsmen?: { sb?: MiniBatter; nsb?: MiniBatter };
  bowlers?:  { sb?: MiniBowler; nsb?: MiniBowler };
  recent_over?: string;   // "0 4 1 1 1 | 0wd 0 1 1"
  current_partnership?: string;
  last_wicket?: string;
  fall_of_wicket?: string;
  projected_score?: number;
  toss_details?: string;
  winning_team?: string;
  win_by?: string;
};

// Convert miniScorecard.data → our LiveScoreData shape.
// This is the PRIMARY source during live matches — the static `scorecard` array
// is empty in CricHeroes SSR until the match concludes.
function parseFromMini(mini: MiniData): Omit<LiveScoreData, 'lastUpdated'> | null {
  if (!mini) return null;

  const battingFirst = mini.current_inning === 1;
  const battingTeamObj = battingFirst ? mini.team_a : mini.team_b;
  const bowlingTeamObj = battingFirst ? mini.team_b : mini.team_a;
  const battingInn = battingTeamObj?.innings?.find(i => i.inning === mini.current_inning) || battingTeamObj?.innings?.[0];

  const battingTeam = battingTeamObj?.name || '';
  const bowlingTeam = bowlingTeamObj?.name || '';
  const score       = battingInn?.summary?.score || battingTeamObj?.summary || `${battingInn?.total_run ?? 0}/${battingInn?.total_wicket ?? 0}`;
  const overs       = (battingInn?.summary?.over || `${battingInn?.overs_played || '0'} Ov`).replace(/[()]/g, '').trim();
  const runRate     = battingInn?.summary?.rr || '';

  // Required run rate (second innings only)
  let requiredRunRate = '';
  if (!battingFirst) {
    const firstInn = mini.team_a?.innings?.[0] || mini.team_b?.innings?.[0];
    const target = (firstInn?.total_run ?? 0) + 1;
    const maxOvers = mini.overs || 20;
    const decOvers = parseFloat(battingInn?.overs_played || '0');
    const oversLeft = maxOvers - decOvers;
    const runsNeed = target - (battingInn?.total_run ?? 0);
    if (oversLeft > 0 && runsNeed > 0) requiredRunRate = (runsNeed / oversLeft).toFixed(2);
  }

  // Active batsmen (striker first, then non-striker)
  const sb = mini.batsmen?.sb;
  const nsb = mini.batsmen?.nsb;
  const batsman1 = sb ? `${sb.name}: ${sb.runs} (${sb.balls})${(sb['4s'] || sb['6s']) ? ` · ${sb['4s']}x4 ${sb['6s']}x6` : ''} *` : '';
  const batsman2 = nsb ? `${nsb.name}: ${nsb.runs} (${nsb.balls})` : '';

  // Structured batter rows for the CricHeroes-style table
  const batters: LiveBatter[] = [];
  if (sb) batters.push({
    name: sb.name, runs: sb.runs, balls: sb.balls, fours: sb['4s'] || 0,
    sixes: sb['6s'] || 0, sr: sb.strike_rate || '0.00', isStriker: true,
  });
  if (nsb) batters.push({
    name: nsb.name, runs: nsb.runs, balls: nsb.balls, fours: nsb['4s'] || 0,
    sixes: nsb['6s'] || 0, sr: nsb.strike_rate || '0.00', isStriker: false,
  });

  // Current bowler
  const bw = mini.bowlers?.sb;
  const ovsStr = bw ? `${bw.overs}${bw.balls ? '.' + bw.balls : ''}` : '';
  const bowler = bw ? `${bw.name}: ${ovsStr}-${bw.maidens}-${bw.runs}-${bw.wickets} (eco ${bw.economy_rate})` : '';

  // Structured bowler rows
  const bowlers: LiveBowler[] = [];
  const buildBowler = (b: MiniBowler | undefined): LiveBowler | null => {
    if (!b) return null;
    return {
      name: b.name,
      overs: `${b.overs}${b.balls ? '.' + b.balls : ''}`,
      maidens: b.maidens || 0,
      runs: b.runs || 0,
      wickets: b.wickets || 0,
      economy: b.economy_rate || '0.00',
    };
  };
  const sbB = buildBowler(mini.bowlers?.sb);
  const nsbB = buildBowler(mini.bowlers?.nsb);
  if (sbB) bowlers.push(sbB);
  if (nsbB) bowlers.push(nsbB);

  // Current over balls — "0 4 1 1 1 | 0wd 0 1 1" → array of ball labels
  // Split on whitespace, keep the "|" as a divider marker so UI can render distinctly if it wants.
  const currentOver = (mini.recent_over || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-12); // last over or so

  // Result string for completed matches
  const result = mini.status === 'past' && mini.winning_team
    ? `${mini.winning_team} won by ${mini.win_by}`
    : '';

  return {
    battingTeam, bowlingTeam, score, overs, runRate,
    requiredRunRate, battingFirst, batsman1, batsman2,
    bowler, batters, bowlers,
    partnership: mini.current_partnership,
    projectedScore: mini.projected_score,
    tossDetails: mini.toss_details,
    result, currentOver,
  };
}

// ─── liveFeed shape (from our edge function, sourced from the CricHeroes API) ─
type LiveFeedTeam = { name: string; score: string | null; overs: string; inning: number | null };
type LiveFeed = {
  status: 'live' | 'completed' | 'upcoming';
  maxOvers: number | null;
  currentInning: number | null;
  teamA: LiveFeedTeam;
  teamB: LiveFeedTeam;
  result: string;
  ground: string;
  tossDetails: string;
};

// Map the API-sourced liveFeed → our LiveScoreData. Ball-by-ball (batsmen/
// bowler/this-over) isn't available from this source, so those stay empty and
// the widget shows the score line + result.
function parseFromLiveFeed(lf: LiveFeed): Omit<LiveScoreData, 'lastUpdated'> | null {
  if (!lf || lf.status === 'upcoming') return null;
  const battingIsA = lf.teamA.inning != null && lf.currentInning != null
    ? lf.teamA.inning === lf.currentInning
    : true;
  const batting = battingIsA ? lf.teamA : lf.teamB;
  const bowling = battingIsA ? lf.teamB : lf.teamA;
  return {
    battingTeam: batting.name || '',
    bowlingTeam: bowling.name || '',
    score: batting.score || '',
    overs: batting.overs || '',
    runRate: '',
    requiredRunRate: '',
    battingFirst: lf.currentInning === 1,
    batsman1: '', batsman2: '', bowler: '',
    batters: [], bowlers: [],
    tossDetails: lf.tossDetails,
    result: lf.result || '',
    currentOver: [],
  };
}

export function parseLiveFromPageProps(pp: Record<string, unknown>): Omit<LiveScoreData, 'lastUpdated'> | null {
  try {
    // ── PRIMARY now: API-sourced liveFeed from our edge function ──────────────
    const lf = pp?.liveFeed as LiveFeed | null | undefined;
    if (lf) {
      const parsed = parseFromLiveFeed(lf);
      if (parsed && (parsed.score || parsed.result)) return parsed;
    }
    // ── PRIMARY: miniScorecard.data is what CricHeroes populates during a live
    // match (ball-by-ball). Their `scorecard` array stays empty until the match
    // is over, so we MUST read miniScorecard first to show live data.
    const mini = (pp?.miniScorecard as { status?: boolean; data?: MiniData } | undefined)?.data;
    if (mini && (mini.status === 'live' || mini.status === 'past')) {
      const parsed = parseFromMini(mini);
      if (parsed && (parsed.score || parsed.result)) return parsed;
    }

    // ── FALLBACK 1: structured `scorecard` array (post-match endpoint) ────────
    const scorecard   = pp?.scorecard as InnRaw[] | undefined;
    const summaryRaw  = pp?.summaryData as { data?: Record<string, unknown> } | undefined;
    const summaryData = summaryRaw?.data;

    if (scorecard?.length) {
      const currentInn  = scorecard[scorecard.length - 1];
      const prevInn     = scorecard.length > 1 ? scorecard[0] : null;
      const status      = summaryData?.status as string | undefined;

      const battingTeam = currentInn.teamName ?? '';
      const bowlingTeam = prevInn?.teamName ?? '';
      const summary     = currentInn.inning?.summary;
      const score       = summary?.score ?? `${currentInn.inning?.total_run ?? ''}/${currentInn.inning?.total_wicket ?? ''}`;
      const overs       = (summary?.over ?? '').replace(/[()]/g, '').trim();
      const runRate     = summary?.rr ?? '';
      const battingFirst = scorecard.length === 1;

      let requiredRunRate = '';
      if (!battingFirst && prevInn && summaryData) {
        const target    = ((prevInn.inning?.total_run ?? 0) as number) + 1;
        const maxOvers  = (summaryData.overs as number) || 20;
        const decOvers  = parseFloat(overs) || 0;
        const oversLeft = maxOvers - decOvers;
        const runsNeed  = target - ((currentInn.inning?.total_run ?? 0) as number);
        if (oversLeft > 0 && runsNeed > 0) requiredRunRate = (runsNeed / oversLeft).toFixed(2);
      }

      const active   = (currentInn.batting || []).filter(b => !b.how_to_out || b.how_to_out === '');
      const batsman1 = active[0] ? `${active[0].name}: ${active[0].runs} (${active[0].balls})` : '';
      const batsman2 = active[1] ? `${active[1].name}: ${active[1].runs} (${active[1].balls})` : '';

      const bwl    = currentInn.bowling || [];
      const cur    = bwl[bwl.length - 1];
      const ovsStr = cur ? `${cur.overs}${cur.balls ? `.${cur.balls}` : ''}` : '';
      const bowler = cur ? `${cur.name}: ${ovsStr}-${cur.maidens}-${cur.runs}-${cur.wickets}` : '';

      const result = (status === 'past' && summaryData)
        ? `${summaryData.winning_team} won by ${summaryData.win_by}`
        : '';

      return {
        battingTeam, bowlingTeam, score, overs, runRate,
        requiredRunRate, battingFirst, batsman1, batsman2,
        bowler, batters: [], bowlers: [], result, currentOver: [],
      };
    }

    // ── FALLBACK 2: completed match with no scorecard but summary has winner ─
    if (summaryData?.status === 'past' && summaryData.winning_team) {
      return {
        battingTeam: '', bowlingTeam: '', score: '', overs: '',
        runRate: '', requiredRunRate: '', battingFirst: false,
        batsman1: '', batsman2: '', bowler: '', batters: [], bowlers: [], currentOver: [],
        result: `${summaryData.winning_team} won by ${summaryData.win_by}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function useLiveScore(chMatchId: string | null | undefined) {
  const [data, setData]           = useState<LiveScoreData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);

  const fetchScore = useCallback(async () => {
    if (!chMatchId) return;
    setLoading(true);
    setError(null);
    try {
      // Try 'live' endpoint first; fall back to 'scorecard' if it returns no parseable data
      let pp     = await fetchPageProps(chMatchId, 'live');
      let parsed = parseLiveFromPageProps(pp);
      if (!parsed) {
        pp     = await fetchPageProps(chMatchId, 'scorecard');
        parsed = parseLiveFromPageProps(pp);
      }
      if (parsed) setData({ ...parsed, lastUpdated: new Date() });
      else setError('no-data');
    } catch {
      setError('network-error');
    } finally {
      setLoading(false);
      setCountdown(POLL_INTERVAL / 1000);
    }
  }, [chMatchId]);

  useEffect(() => {
    if (!chMatchId) return;
    fetchScore();
    const poll = setInterval(fetchScore, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [chMatchId, fetchScore]);

  useEffect(() => {
    if (!chMatchId) return;
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, [chMatchId]);

  return { data, loading, error, countdown, refetch: fetchScore };
}
