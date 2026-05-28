import { useState, useEffect } from 'react';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const FN_BASE = `${supabaseUrl}/functions/v1/cricheroes`;

export interface BatterRow {
  name: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: string;
  isNotOut: boolean;
}

export interface BowlerRow {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  wides: number;
  noBalls: number;
}

export interface InningsData {
  teamName: string;
  score: string;           // e.g. "96/12"
  overs: string;           // e.g. "(17.5 Ov)"
  runRate: string;         // e.g. "5.38"
  batting: BatterRow[];
  bowling: BowlerRow[];
  extrasTotal: number;
  extrasSummary: string;   // e.g. "(wd 15)"
  fallOfWickets: string;   // compact summary string
}

export interface FullScorecardData {
  innings: InningsData[];
  matchResult: string;
  winBy: string;
  winningTeam: string;
  ground: string;
  city: string;
  startDatetime: string;
  maxOvers: number;
  ballType: string;
  tournament: string;
  mvpName: string | null;
  mvpStats: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInnings(raw: Record<string, any>): InningsData {
  const inning = raw.inning ?? {};
  const summary = inning.summary ?? {};

  const batting: BatterRow[] = (raw.batting ?? []).map((b: Record<string, unknown>) => ({
    name:        String(b.name ?? ''),
    dismissal:   String(b.how_to_out ?? ''),
    runs:        Number(b.runs ?? 0),
    balls:       Number(b.balls ?? 0),
    fours:       Number(b['4s'] ?? 0),
    sixes:       Number(b['6s'] ?? 0),
    strikeRate:  String(b.SR ?? '0.00'),
    isNotOut:    !b.how_to_out || b.how_to_out === '',
  }));

  const bowling: BowlerRow[] = (raw.bowling ?? []).map((b: Record<string, unknown>) => {
    const ov = Number(b.overs ?? 0);
    const bl = Number(b.balls ?? 0);
    return {
      name:     String(b.name ?? ''),
      overs:    bl > 0 ? `${ov}.${bl}` : `${ov}`,
      maidens:  Number(b.maidens ?? 0),
      runs:     Number(b.runs ?? 0),
      wickets:  Number(b.wickets ?? 0),
      economy:  String(b.economy_rate ?? '0.00'),
      wides:    Number(b.wide ?? 0),
      noBalls:  Number(b.noball ?? 0),
    };
  });

  const extras   = raw.extras as Record<string, unknown> | undefined;
  const fowRaw   = raw.fall_of_wicket as Record<string, unknown> | undefined;

  return {
    teamName:      String(raw.teamName ?? ''),
    score:         String(summary.score  ?? `${inning.total_run ?? 0}/${inning.total_wicket ?? 0}`),
    overs:         String(summary.over   ?? ''),
    runRate:       String(summary.rr     ?? ''),
    batting,
    bowling,
    extrasTotal:   Number(extras?.total   ?? 0),
    extrasSummary: String(extras?.summary ?? ''),
    fallOfWickets: String(fowRaw?.summary ?? ''),
  };
}

export function useFullScorecard(chMatchId: string | null | undefined, enabled = true) {
  const [data, setData]       = useState<FullScorecardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!chMatchId || !enabled) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${FN_BASE}?matchId=${chMatchId}&type=scorecard`, {
          headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
        });
        if (!res.ok) throw new Error(`fn ${res.status}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pp: Record<string, any> = await res.json();

        const scorecard   = pp?.scorecard  as Record<string, unknown>[] | undefined;
        const summaryRaw  = pp?.summaryData as { data?: Record<string, unknown> } | undefined;
        const summaryData = summaryRaw?.data ?? {};
        const mvpArr      = (pp?.mvp as { data?: Record<string, unknown>[] })?.data ?? [];

        if (!scorecard?.length) throw new Error('No innings data');

        const innings = scorecard.map(parseInnings);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mvp0 = mvpArr[0] as Record<string, any> | undefined;

        const parsed: FullScorecardData = {
          innings,
          matchResult: summaryData.winning_team
            ? `${summaryData.winning_team} won by ${summaryData.win_by}`
            : String(summaryData.match_result ?? ''),
          winBy:         String(summaryData.win_by       ?? ''),
          winningTeam:   String(summaryData.winning_team ?? ''),
          ground:        String(summaryData.ground_name  ?? ''),
          city:          String(summaryData.city_name    ?? ''),
          startDatetime: String(summaryData.start_datetime ?? ''),
          maxOvers:      Number(summaryData.overs ?? 0),
          ballType:      String(summaryData.ball_type ?? ''),
          tournament:    String(summaryData.tournament_name ?? ''),
          mvpName:       mvp0?.name   ? String(mvp0.name) : null,
          mvpStats:      mvp0?.detail ? String(mvp0.detail) : null,
        };

        if (!cancelled) setData(parsed);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Scorecard unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [chMatchId, enabled]);

  return { data, loading, error };
}
