import type { MemberCricketStats } from '../types';

export interface RadarScores {
  batting: number;     // 0-100
  bowling: number;     // 0-100
  fielding: number;    // 0-100
  consistency: number; // 0-100
  impact: number;      // 0-100
}

function clamp(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)));
}

export function computeRadar(
  stats: MemberCricketStats | undefined,
  moms: number,
  matchesPlayed: number
): RadarScores {
  const runs = stats?.batting_runs ?? 0;
  const avg = stats?.batting_average ?? 0;
  const sr = stats?.batting_strike_rate ?? 0;
  const hs = stats?.batting_highest_score ?? 0;
  const wickets = stats?.bowling_wickets ?? 0;
  const eco = stats?.bowling_economy ?? 0;
  const overs = stats?.bowling_overs ?? 0;
  const bestFigStr = stats?.bowling_best_figures ?? '';
  const catches = stats?.fielding_catches ?? 0;
  const stumpings = stats?.fielding_stumpings ?? 0;
  const runOuts = stats?.fielding_run_outs ?? 0;
  const battingInnings = stats?.batting_innings ?? 0;
  const bowlingInnings = stats?.bowling_innings ?? 0;

  // Batting score
  const batting = clamp(
    0.4 * Math.min(runs / 600, 1) * 100 +
    0.3 * Math.min(avg / 45, 1) * 100 +
    0.2 * Math.min(sr / 140, 1) * 100 +
    0.1 * Math.min(hs / 80, 1) * 100
  );

  // Bowling score
  let bowling: number;
  if (wickets === 0 && overs === 0) {
    bowling = 0;
  } else {
    const bestFigWkts = (() => {
      const match = bestFigStr.match(/^(\d+)\//);
      return match ? parseInt(match[1], 10) : 0;
    })();
    bowling = clamp(
      0.45 * Math.min(wickets / 40, 1) * 100 +
      0.35 * Math.max(0, (12 - eco) / 12) * 100 +
      0.20 * Math.min(bestFigWkts / 5, 1) * 100
    );
  }

  // Fielding score
  const fielding = clamp(Math.min((catches + stumpings + runOuts) / 20, 1) * 100);

  // Consistency score
  const consistency = clamp(
    0.6 * Math.min(matchesPlayed / 20, 1) * 100 +
    0.4 * (matchesPlayed > 0
      ? Math.min(
          (battingInnings + Math.min(bowlingInnings, matchesPlayed)) / (matchesPlayed * 1.5),
          1
        ) * 100
      : 0)
  );

  // Impact score
  const impact = clamp(
    0.4 * Math.min(moms / 6, 1) * 100 +
    0.35 * (matchesPlayed > 0 ? Math.min((runs / matchesPlayed) / 30, 1) * 100 : 0) +
    0.25 * (matchesPlayed > 0 ? Math.min((wickets / matchesPlayed) / 2.5, 1) * 100 : 0)
  );

  return { batting, bowling, fielding, consistency, impact };
}

export function overallRating(radar: RadarScores, role: string | null): number {
  let weighted: number;

  switch (role) {
    case 'batsman':
      weighted =
        radar.batting * 0.45 +
        radar.fielding * 0.15 +
        radar.consistency * 0.20 +
        radar.impact * 0.20;
      break;
    case 'bowler':
      weighted =
        radar.bowling * 0.45 +
        radar.fielding * 0.15 +
        radar.consistency * 0.20 +
        radar.impact * 0.20;
      break;
    case 'all_rounder':
      weighted =
        radar.batting * 0.30 +
        radar.bowling * 0.30 +
        radar.fielding * 0.15 +
        radar.consistency * 0.15 +
        radar.impact * 0.10;
      break;
    case 'wicket_keeper':
      weighted =
        radar.batting * 0.30 +
        radar.fielding * 0.35 +
        radar.bowling * 0.05 +
        radar.consistency * 0.20 +
        radar.impact * 0.10;
      break;
    default:
      weighted = (radar.batting + radar.bowling + radar.fielding + radar.consistency + radar.impact) / 5;
  }

  // Scale to 40-99
  return Math.round(40 + weighted * 0.59);
}

export function positionLabel(role: string | null): string {
  switch (role) {
    case 'batsman': return 'ATK';
    case 'bowler': return 'BWL';
    case 'all_rounder': return 'ALL';
    case 'wicket_keeper': return 'GK';
    default: return 'PLY';
  }
}

export interface CardTheme {
  bg: string;
  accent: string;
  text: string;
}

export function cardTheme(role: string | null): CardTheme {
  switch (role) {
    case 'batsman':
      return {
        bg: 'linear-gradient(160deg,#78350f,#92400e,#b45309,#1a0d00)',
        accent: '#fbbf24',
        text: '#fef3c7',
      };
    case 'bowler':
      return {
        bg: 'linear-gradient(160deg,#1e3a8a,#1e40af,#1d4ed8,#0f172a)',
        accent: '#60a5fa',
        text: '#dbeafe',
      };
    case 'all_rounder':
      return {
        bg: 'linear-gradient(160deg,#064e3b,#065f46,#047857,#0f1f14)',
        accent: '#34d399',
        text: '#d1fae5',
      };
    case 'wicket_keeper':
      return {
        bg: 'linear-gradient(160deg,#7f1d1d,#991b1b,#b91c1c,#0f0707)',
        accent: '#f87171',
        text: '#fee2e2',
      };
    default:
      return {
        bg: 'linear-gradient(160deg,#1e1b4b,#312e81,#3730a3,#0f0c1a)',
        accent: '#a78bfa',
        text: '#ede9fe',
      };
  }
}

export function cardStats(
  stats: MemberCricketStats | undefined,
  moms: number,
  matchesPlayed: number,
  role: string | null
): Array<{ label: string; value: string }> {
  const runs = stats?.batting_runs ?? 0;
  const avg = stats?.batting_average ?? 0;
  const sr = stats?.batting_strike_rate ?? 0;
  const hs = stats?.batting_highest_score ?? 0;
  const fifties = stats?.batting_fifties ?? 0;
  const wickets = stats?.bowling_wickets ?? 0;
  const eco = stats?.bowling_economy ?? 0;
  const bowlingAvg = stats?.bowling_average ?? 0;
  const bestFig = stats?.bowling_best_figures || '—';
  const catches = stats?.fielding_catches ?? 0;
  const stumpings = stats?.fielding_stumpings ?? 0;

  switch (role) {
    case 'batsman':
      return [
        { label: 'RUN', value: String(runs) },
        { label: 'AVG', value: avg.toFixed(1) },
        { label: 'S/R', value: sr.toFixed(0) },
        { label: 'HS', value: String(hs) },
        { label: '50s', value: String(fifties) },
        { label: 'MOM', value: String(moms) },
      ];
    case 'bowler':
      return [
        { label: 'WKT', value: String(wickets) },
        { label: 'ECO', value: eco.toFixed(1) },
        { label: 'BF', value: bestFig },
        { label: 'AVG', value: bowlingAvg.toFixed(1) },
        { label: 'MAT', value: String(matchesPlayed) },
        { label: 'MOM', value: String(moms) },
      ];
    case 'all_rounder':
      return [
        { label: 'RUN', value: String(runs) },
        { label: 'WKT', value: String(wickets) },
        { label: 'MOM', value: String(moms) },
        { label: 'AVG', value: avg.toFixed(1) },
        { label: 'ECO', value: eco > 0 ? eco.toFixed(1) : '—' },
        { label: 'MAT', value: String(matchesPlayed) },
      ];
    case 'wicket_keeper':
      return [
        { label: 'RUN', value: String(runs) },
        { label: 'CT', value: String(catches) },
        { label: 'ST', value: String(stumpings) },
        { label: 'AVG', value: avg.toFixed(1) },
        { label: 'MOM', value: String(moms) },
        { label: 'MAT', value: String(matchesPlayed) },
      ];
    default:
      return [
        { label: 'RUN', value: String(runs) },
        { label: 'WKT', value: String(wickets) },
        { label: 'CT', value: String(catches) },
        { label: 'MOM', value: String(moms) },
        { label: 'AVG', value: avg.toFixed(1) },
        { label: 'MAT', value: String(matchesPlayed) },
      ];
  }
}
