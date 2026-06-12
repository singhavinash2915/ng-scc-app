import { useMemo } from 'react';
import type { Match, Member } from '../types';
import { useHeadToHead } from './useHeadToHead';
import { normalizeVenue } from '../utils/normalizeVenue';

// Minimal shape we need from member_cricket_stats rows.
export interface PreviewStatRow {
  member_id: string;
  batting_runs: number;
  bowling_wickets: number;
  batting_highest_score?: number;
  bowling_best_figures?: string | null;
}

// Minimal shape we need from match_predictions rows.
export interface PreviewPrediction {
  winner: string | null;
}

export interface KeyPlayer {
  name: string;
  value: number;
  label: string;        // e.g. "wkts this season"
  avatar_url: string | null;
}

export interface MatchPreview {
  opponent: string;
  isInternal: boolean;
  firstMeeting: boolean;
  // Head-to-head
  played: number;
  won: number;
  lost: number;
  winRate: number;       // % (won / decisive)
  lastResult: 'won' | 'lost' | 'draw' | null;
  // Scoring
  avgRunsUs: number | null;
  avgRunsThem: number | null;
  // Venue
  venueName: string | null;
  venuePlayed: number;
  venueWon: number;
  venueLost: number;
  // Form (most recent first) — 'W' | 'L' | 'N'
  form: Array<'W' | 'L' | 'N'>;
  // Computed
  winProbability: number;   // %
  storyline: string;
  // Phase 2
  keyBatsman: KeyPlayer | null;
  keyBowler: KeyPlayer | null;
  predictTotal: number;
  predictForUs: number;
}

function parseRuns(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Pre-match analytics for the next upcoming match — head-to-head, form,
 * venue record, win probability, key players, and the community prediction.
 * Pure compute over data the dashboard already loads.
 */
export function useMatchPreview(
  nextMatch: Match | null,
  matches: Match[],
  members: Member[],
  cricketStats: PreviewStatRow[],
  predictions: PreviewPrediction[],
): MatchPreview | null {
  const h2hAll = useHeadToHead(matches);

  return useMemo(() => {
    if (!nextMatch) return null;
    const opponent = (nextMatch.opponent || 'TBD').trim();
    const isInternal = nextMatch.match_type === 'internal';

    const completedExt = matches.filter(m =>
      m.match_type === 'external' &&
      ['won', 'lost', 'draw'].includes(m.result)
    );

    // ── Head-to-head vs this opponent ─────────────────────────────────────────
    const h2h = h2hAll.find(r => r.opponent.toLowerCase() === opponent.toLowerCase());
    const vsThem = completedExt.filter(m => (m.opponent || '').trim().toLowerCase() === opponent.toLowerCase());
    const played = h2h?.played ?? 0;
    const won = h2h?.won ?? 0;
    const lost = h2h?.lost ?? 0;
    const winRate = h2h?.winRate ?? 0;
    const firstMeeting = played === 0;

    // ── Average runs scored, us vs them ───────────────────────────────────────
    const ourRuns = vsThem.map(m => parseRuns(m.our_score)).filter((n): n is number => n != null);
    const theirRuns = vsThem.map(m => parseRuns(m.opponent_score)).filter((n): n is number => n != null);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const avgRunsUs = avg(ourRuns);
    const avgRunsThem = avg(theirRuns);

    // ── Venue record ──────────────────────────────────────────────────────────
    const venueName = nextMatch.venue ? normalizeVenue(nextMatch.venue) : null;
    const atVenue = venueName
      ? completedExt.filter(m => m.venue && normalizeVenue(m.venue) === venueName)
      : [];
    const venueWon = atVenue.filter(m => m.result === 'won').length;
    const venueLost = atVenue.filter(m => m.result === 'lost').length;

    // ── Recent form (last 5 decisive external) ────────────────────────────────
    const recent = [...completedExt]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    const form = recent.map(m => m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'N') as Array<'W' | 'L' | 'N'>;
    const formWins = form.filter(f => f === 'W').length;
    const formDecisive = form.filter(f => f !== 'N').length;
    const formRate = formDecisive ? (formWins / formDecisive) * 100 : 50;
    const venueDecisive = venueWon + venueLost;
    const venueRate = venueDecisive ? (venueWon / venueDecisive) * 100 : 50;

    // ── Win probability — blend H2H, current form, venue record ────────────────
    let winProbability: number;
    if (played >= 1) {
      winProbability = 0.45 * winRate + 0.35 * formRate + 0.20 * venueRate;
    } else {
      winProbability = 0.6 * formRate + 0.4 * venueRate;
    }
    winProbability = Math.round(clamp(winProbability, 8, 92));

    // ── Storyline ─────────────────────────────────────────────────────────────
    let storyline: string;
    const runLine = (avgRunsUs != null && avgRunsThem != null)
      ? ` We average ${avgRunsUs} to their ${avgRunsThem}.`
      : '';
    if (isInternal) {
      storyline = `Bragging rights on the line — Dhurandars vs Bazigars. No mercy, no excuses. 🔥`;
    } else if (firstMeeting) {
      storyline = `First-ever meeting with ${opponent} — no history, everything to play for.`;
    } else if (won === 0 && lost > 0) {
      storyline = `${opponent} are our bogey team — they've won all ${played}.${runLine} Time to break the curse. 🔥`;
    } else if (lost === 0 && won > 0) {
      storyline = `We own this fixture — ${won}/${played} wins and ${opponent} have never beaten us.${runLine}`;
    } else if (winRate >= 60) {
      storyline = `We've got the wood on ${opponent} — ${won}W ${lost}L (${winRate}%).${runLine}`;
    } else if (winRate <= 40) {
      storyline = `${opponent} have had our number — ${won}W ${lost}L (${winRate}%).${runLine} Time to turn it around.`;
    } else {
      storyline = `A real rivalry — ${won}W ${lost}L vs ${opponent}.${runLine} Could go either way.`;
    }

    // ── Phase 2: key players to watch (season leaders) ────────────────────────
    const memberById: Record<string, Member> = {};
    members.forEach(m => { memberById[m.id] = m; });
    const withName = cricketStats.filter(s => memberById[s.member_id]);
    const topBat = [...withName].sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topBowl = [...withName].sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const keyBatsman: KeyPlayer | null = topBat && topBat.batting_runs > 0 ? {
      name: memberById[topBat.member_id].name,
      value: topBat.batting_runs,
      label: 'runs this season',
      avatar_url: memberById[topBat.member_id].avatar_url ?? null,
    } : null;
    const keyBowler: KeyPlayer | null = topBowl && topBowl.bowling_wickets > 0 ? {
      name: memberById[topBowl.member_id].name,
      value: topBowl.bowling_wickets,
      label: 'wickets this season',
      avatar_url: memberById[topBowl.member_id].avatar_url ?? null,
    } : null;

    // ── Phase 2: community prediction ─────────────────────────────────────────
    const decisivePicks = predictions.filter(p => p.winner != null);
    const forUsKey = isInternal ? null : 'scc';
    const predictForUs = forUsKey ? decisivePicks.filter(p => p.winner === forUsKey).length : 0;

    return {
      opponent, isInternal, firstMeeting,
      played, won, lost, winRate, lastResult: h2h?.lastResult ?? null,
      avgRunsUs, avgRunsThem,
      venueName, venuePlayed: atVenue.length, venueWon, venueLost,
      form, winProbability, storyline,
      keyBatsman, keyBowler,
      predictTotal: decisivePicks.length, predictForUs,
    };
  }, [nextMatch, matches, members, cricketStats, predictions, h2hAll]);
}
