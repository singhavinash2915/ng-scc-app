import { useState, useEffect, useCallback } from 'react';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

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
  result: string;         // empty = in progress, filled = match over
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

export function parseLiveFromPageProps(pp: Record<string, unknown>): Omit<LiveScoreData, 'lastUpdated'> | null {
  try {
    const scorecard   = pp?.scorecard as InnRaw[] | undefined;
    const summaryRaw  = pp?.summaryData as { data?: Record<string, unknown> } | undefined;
    const summaryData = summaryRaw?.data;
    if (!scorecard?.length || !summaryData) return null;

    const currentInn  = scorecard[scorecard.length - 1];
    const prevInn     = scorecard.length > 1 ? scorecard[0] : null;

    const battingTeam = currentInn.teamName ?? '';
    const bowlingTeam = prevInn?.teamName ?? '';
    const summary     = currentInn.inning?.summary;
    const score       = summary?.score ?? `${currentInn.inning?.total_run ?? ''}/${currentInn.inning?.total_wicket ?? ''}`;
    const overs       = (summary?.over ?? '').replace(/[()]/g, '').trim();
    const runRate     = summary?.rr ?? '';
    const battingFirst = scorecard.length === 1;

    let requiredRunRate = '';
    if (!battingFirst && prevInn) {
      const target    = ((prevInn.inning?.total_run ?? 0) as number) + 1;
      const maxOvers  = (summaryData.overs as number) || 20;
      const decOvers  = parseFloat(overs) || 0;
      const oversLeft = maxOvers - decOvers;
      const runsNeed  = target - ((currentInn.inning?.total_run ?? 0) as number);
      if (oversLeft > 0 && runsNeed > 0) requiredRunRate = (runsNeed / oversLeft).toFixed(2);
    }

    const active   = currentInn.batting.filter(b => !b.how_to_out || b.how_to_out === '');
    const batsman1 = active[0] ? `${active[0].name}: ${active[0].runs} (${active[0].balls})` : '';
    const batsman2 = active[1] ? `${active[1].name}: ${active[1].runs} (${active[1].balls})` : '';

    const bwl    = currentInn.bowling;
    const cur    = bwl[bwl.length - 1];
    const ovsStr = cur ? `${cur.overs}${cur.balls ? `.${cur.balls}` : ''}` : '';
    const bowler = cur ? `${cur.name}: ${ovsStr}-${cur.maidens}-${cur.runs}-${cur.wickets}` : '';

    const status = summaryData.status as string;
    const result = status === 'past'
      ? `${summaryData.winning_team} won by ${summaryData.win_by}`
      : '';

    return {
      battingTeam, bowlingTeam, score, overs, runRate,
      requiredRunRate, battingFirst, batsman1, batsman2,
      bowler, result, currentOver: [],
    };
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
