/**
 * useMatchAnalysis — CricHeroes-style post-match analysis for a match.
 *
 *   useMatchHeroes(chMatchId)   → Player of the Match + best batter/bowler +
 *                                 insight one-liners (from the summary scorecard)
 *   useMatchInsights(chMatchId) → per-over rows → phases of play + turning points
 *                                 (from the ball-by-ball commentary)
 *
 * Both call the existing `cricheroes` edge function (types `heroes`/`insights`),
 * so they work for completed AND in-progress matches without any DB storage.
 */
import { useState, useEffect } from 'react';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const FN_BASE = `${supabaseUrl}/functions/v1/cricheroes`;

async function fnGet(matchId: string, type: 'heroes' | 'insights') {
  const res = await fetch(`${FN_BASE}?matchId=${matchId}&type=${type}`, {
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
  });
  if (!res.ok) throw new Error(`cricheroes ${type} ${res.status}`);
  return res.json();
}

// ── Heroes ───────────────────────────────────────────────────────────────────
export interface BestBat {
  player_id: number; player_name: string; team_name: string;
  runs: number; balls: number; '4s': number; '6s': number; strike_rate: string; is_out: number;
}
export interface BestBowl {
  player_id: number; player_name: string; team_name: string;
  overs: string; maidens: number; runs: number; wickets: number; economy_rate?: string;
}
export interface MatchHeroes {
  player_of_the_match: { player_id: number; player_name: string; team_name: string; profile_photo: string } | null;
  best_performances: { batting: BestBat[]; bowling: BestBowl[] };
  insight_statements: string[];
  match_summary: string | null;
}

export function useMatchHeroes(chMatchId: string | null | undefined, enabled = true) {
  const [data, setData] = useState<MatchHeroes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chMatchId || !enabled) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fnGet(String(chMatchId), 'heroes')
      .then(r => { if (!cancelled) setData(r.heroes ?? null); })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [chMatchId, enabled]);

  return { data, loading, error };
}

// ── Insights ─────────────────────────────────────────────────────────────────
export interface OverRow {
  inning: number; over: number; team_id: number;
  runs: number; wickets: number; dots: number; boundaryRuns: number; legalBalls: number; seq: string[];
}
export interface PhaseStat {
  label: string; runs: number; wickets: number; dots: number; boundaryRuns: number; balls: number; runRate: number;
}
export interface TurningOver { over: number; runs: number; wickets: number; seq: string[] }
export interface InnTotal {
  inning: number; team_id: number; team_name: string; runs: number; wickets: number; balls: number; runRate: number;
}
export interface InningInsight {
  inning: number; teamId: number; teamName: string;
  total: PhaseStat; phases: PhaseStat[]; turning: TurningOver[];
  wicketsReliable: boolean;   // false → ball-by-ball missed wickets; hide per-phase wickets
}
export interface MatchInsightsData {
  innings: InningInsight[];
  insightStatements: string[];
}

const PHASE_SIZE = 4; // overs per phase (1-4, 5-8, …) — matches CricHeroes T20-style splits

function summarise(label: string, overs: OverRow[]): PhaseStat {
  const runs = overs.reduce((s, o) => s + o.runs, 0);
  const balls = overs.reduce((s, o) => s + o.legalBalls, 0);
  return {
    label,
    runs,
    wickets: overs.reduce((s, o) => s + o.wickets, 0),
    dots: overs.reduce((s, o) => s + o.dots, 0),
    boundaryRuns: overs.reduce((s, o) => s + o.boundaryRuns, 0),
    balls,
    runRate: balls > 0 ? Math.round((runs / (balls / 6)) * 100) / 100 : 0,
  };
}

export function buildInnings(overs: OverRow[], innTotals: InnTotal[] = []): InningInsight[] {
  const innNums = [...new Set(overs.map(o => o.inning))].sort((a, b) => a - b);
  return innNums.map(inn => {
    const innOvers = overs.filter(o => o.inning === inn).sort((a, b) => a.over - b.over);
    const teamId = innOvers[0]?.team_id ?? 0;
    const auth = innTotals.find(t => t.inning === inn);
    const maxOver = Math.max(...innOvers.map(o => o.over), 0);
    const phaseCount = Math.ceil(maxOver / PHASE_SIZE);
    const phases: PhaseStat[] = [];
    for (let p = 0; p < phaseCount; p++) {
      const lo = p * PHASE_SIZE + 1, hi = (p + 1) * PHASE_SIZE;
      const slice = innOvers.filter(o => o.over >= lo && o.over <= hi);
      if (slice.length) phases.push(summarise(`${lo}-${hi}`, slice));
    }
    // Reconcile the innings total against the authoritative scorecard.
    const total = summarise('All', innOvers);
    const bbWickets = total.wickets;
    if (auth) {
      total.runs = auth.runs;
      total.wickets = auth.wickets;
      if (auth.balls > 0) total.balls = auth.balls;
      if (auth.runRate > 0) total.runRate = auth.runRate;
      else if (auth.balls > 0) total.runRate = Math.round((auth.runs / (auth.balls / 6)) * 100) / 100;
    }
    // Ball-by-ball is "reliable" for wickets only if it captured most of them.
    const wicketsReliable = !auth || auth.wickets === 0 || bbWickets >= auth.wickets * 0.8;
    const turning = [...innOvers]
      .map(o => ({ over: o.over, runs: o.runs, wickets: o.wickets, seq: o.seq }))
      .sort((a, b) => (b.wickets * 12 + b.runs) - (a.wickets * 12 + a.runs))
      .slice(0, 3);
    return { inning: inn, teamId, teamName: auth?.team_name ?? '', total, phases, turning, wicketsReliable };
  });
}

export function useMatchInsights(chMatchId: string | null | undefined, enabled = true) {
  const [data, setData] = useState<MatchInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chMatchId || !enabled) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fnGet(String(chMatchId), 'insights')
      .then(r => {
        if (cancelled) return;
        const overs: OverRow[] = r.insights?.overs ?? [];
        const innTotals: InnTotal[] = r.insights?.innTotals ?? [];
        const statements: string[] = r.insights?.insightStatements ?? [];
        setData(overs.length || innTotals.length
          ? { innings: buildInnings(overs, innTotals), insightStatements: statements }
          : null);
      })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [chMatchId, enabled]);

  return { data, loading, error };
}
