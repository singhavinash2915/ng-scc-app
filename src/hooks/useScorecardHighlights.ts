import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { BatterRow, BowlerRow, InningsSummary, MatchScorecard } from './useMatchScorecard';

/**
 * Aggregates scorecard data for AI Insights. Returns:
 *   - matchHighlights: per-match top batter + top bowler + extras  (~100 matches)
 *   - seasonRecords: highest individual score, best bowling, biggest partnership
 *   - playerCareerBests: each player's best score + best bowling
 *
 * Designed to fit comfortably in an LLM prompt context (a few KB total).
 */

export interface MatchHighlight {
  match_id: string;
  ch_match_id: string;
  date: string;
  innings1_team: string | null;
  innings1_score: string | null;
  innings2_team: string | null;
  innings2_score: string | null;
  best_batter: { name: string; runs: number; balls: number; team: string | null } | null;
  best_bowler: { name: string; wickets: number; runs: number; overs: number; team: string | null } | null;
  highest_individual: { name: string; runs: number; balls: number; team: string | null } | null;
}

export interface SeasonRecord {
  type: 'highest_individual_score' | 'best_bowling_match' | 'highest_team_total' | 'lowest_all_out';
  value: string | number;
  player?: string;
  match_date?: string;
  vs?: string;
}

export interface PlayerCareerBest {
  name: string;
  highest_score: { runs: number; balls: number; date: string; vs: string } | null;
  best_bowling: { wickets: number; runs: number; date: string; vs: string } | null;
  total_runs: number;
  total_wickets: number;
  matches: number;
}

interface CardRow extends MatchScorecard {
  match: { date: string; opponent: string | null; ch_match_id: string | null } | null;
}

function bestOfBatting(rows: BatterRow[] | null): BatterRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.runs - a.runs)[0] || null;
}

function bestOfBowling(rows: BowlerRow[] | null): BowlerRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    return a.runs - b.runs;
  })[0] || null;
}

export function useScorecardHighlights(seasonStart = '2025-10-01') {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('match_scorecards')
        .select('*, match:matches(date, opponent, ch_match_id)')
        .gte('match.date', seasonStart)
        .order('match(date)', { ascending: false });

      if (cancelled) return;
      if (error || !data) {
        setCards([]);
      } else {
        setCards((data as unknown as CardRow[]).filter(c => c.match));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [seasonStart]);

  // Per-match highlights (compact, ready for AI context)
  const matchHighlights = useMemo<MatchHighlight[]>(() => {
    return cards.map(c => {
      const inn1Bat = bestOfBatting(c.innings1_batting);
      const inn2Bat = bestOfBatting(c.innings2_batting);
      const inn1Bowl = bestOfBowling(c.innings1_bowling);
      const inn2Bowl = bestOfBowling(c.innings2_bowling);

      // Best across both innings
      const bestBat = inn1Bat && inn2Bat
        ? (inn1Bat.runs >= inn2Bat.runs ? inn1Bat : inn2Bat)
        : (inn1Bat || inn2Bat);
      const bestBowl = inn1Bowl && inn2Bowl
        ? (inn1Bowl.wickets > inn2Bowl.wickets ? inn1Bowl : inn2Bowl)
        : (inn1Bowl || inn2Bowl);

      const inn1Sum = c.innings1_summary as InningsSummary | null;
      const inn2Sum = c.innings2_summary as InningsSummary | null;

      return {
        match_id: c.match_id,
        ch_match_id: c.ch_match_id,
        date: c.match!.date,
        innings1_team: c.innings1_team_name,
        innings1_score: inn1Sum?.score || null,
        innings2_team: c.innings2_team_name,
        innings2_score: inn2Sum?.score || null,
        best_batter: bestBat ? {
          name: bestBat.name,
          runs: bestBat.runs,
          balls: bestBat.balls,
          team: inn1Bat === bestBat ? c.innings1_team_name : c.innings2_team_name,
        } : null,
        best_bowler: bestBowl ? {
          name: bestBowl.name,
          wickets: bestBowl.wickets,
          runs: bestBowl.runs,
          overs: Number(bestBowl.overs) + (Number(bestBowl.balls || 0) / 10),
          team: inn1Bowl === bestBowl ? c.innings1_team_name : c.innings2_team_name,
        } : null,
        highest_individual: bestBat ? {
          name: bestBat.name,
          runs: bestBat.runs,
          balls: bestBat.balls,
          team: inn1Bat === bestBat ? c.innings1_team_name : c.innings2_team_name,
        } : null,
      };
    });
  }, [cards]);

  // Season records
  const seasonRecords = useMemo<SeasonRecord[]>(() => {
    const records: SeasonRecord[] = [];
    let highestInd: { runs: number; name: string; date: string; vs: string } | null = null;
    let bestBowl: { wickets: number; runs: number; name: string; date: string; vs: string } | null = null;
    let highestTeam: { runs: number; team: string | null; date: string; vs: string } | null = null;
    let lowestAllOut: { runs: number; team: string | null; date: string; vs: string } | null = null;

    cards.forEach(c => {
      const date = c.match!.date;
      const opp = c.match!.opponent || '—';
      const innings = [
        { batting: c.innings1_batting, bowling: c.innings1_bowling, summary: c.innings1_summary as InningsSummary | null, team: c.innings1_team_name },
        { batting: c.innings2_batting, bowling: c.innings2_bowling, summary: c.innings2_summary as InningsSummary | null, team: c.innings2_team_name },
      ];

      innings.forEach(inn => {
        // Highest individual
        const top = bestOfBatting(inn.batting);
        if (top && (!highestInd || top.runs > highestInd.runs)) {
          highestInd = { runs: top.runs, name: top.name, date, vs: opp };
        }
        // Best bowling
        const bestB = bestOfBowling(inn.bowling);
        if (bestB && bestB.wickets > 0) {
          if (!bestBowl ||
              bestB.wickets > bestBowl.wickets ||
              (bestB.wickets === bestBowl.wickets && bestB.runs < bestBowl.runs)) {
            bestBowl = { wickets: bestB.wickets, runs: bestB.runs, name: bestB.name, date, vs: opp };
          }
        }
        // Team total / lowest all out
        const total = inn.summary?.total_run ?? 0;
        const wkts = inn.summary?.total_wicket ?? 0;
        if (!highestTeam || total > highestTeam.runs) {
          highestTeam = { runs: total, team: inn.team, date, vs: opp };
        }
        if (wkts >= 10 && (!lowestAllOut || total < lowestAllOut.runs)) {
          lowestAllOut = { runs: total, team: inn.team, date, vs: opp };
        }
      });
    });

    if (highestInd) {
      const hi = highestInd as { runs: number; name: string; date: string; vs: string };
      records.push({ type: 'highest_individual_score', value: hi.runs, player: hi.name, match_date: hi.date, vs: hi.vs });
    }
    if (bestBowl) {
      const bb = bestBowl as { wickets: number; runs: number; name: string; date: string; vs: string };
      records.push({ type: 'best_bowling_match', value: `${bb.wickets}/${bb.runs}`, player: bb.name, match_date: bb.date, vs: bb.vs });
    }
    if (highestTeam) {
      const ht = highestTeam as { runs: number; team: string | null; date: string; vs: string };
      records.push({ type: 'highest_team_total', value: ht.runs, player: ht.team || undefined, match_date: ht.date, vs: ht.vs });
    }
    if (lowestAllOut) {
      const lo = lowestAllOut as { runs: number; team: string | null; date: string; vs: string };
      records.push({ type: 'lowest_all_out', value: lo.runs, player: lo.team || undefined, match_date: lo.date, vs: lo.vs });
    }
    return records;
  }, [cards]);

  // Per-player career bests across the season
  const playerCareerBests = useMemo<PlayerCareerBest[]>(() => {
    const players: Record<string, PlayerCareerBest> = {};

    cards.forEach(c => {
      const date = c.match!.date;
      const opp = c.match!.opponent || '—';
      const innings = [c.innings1_batting, c.innings2_batting].filter((b): b is BatterRow[] => Array.isArray(b));
      const bowlInnings = [c.innings1_bowling, c.innings2_bowling].filter((b): b is BowlerRow[] => Array.isArray(b));

      innings.forEach(rows => rows.forEach(b => {
        const name = b.name;
        if (!players[name]) players[name] = { name, highest_score: null, best_bowling: null, total_runs: 0, total_wickets: 0, matches: 0 };
        players[name].total_runs += b.runs;
        if (b.balls > 0) players[name].matches += 1;
        if (!players[name].highest_score || b.runs > players[name].highest_score!.runs) {
          players[name].highest_score = { runs: b.runs, balls: b.balls, date, vs: opp };
        }
      }));

      bowlInnings.forEach(rows => rows.forEach(bw => {
        const name = bw.name;
        if (!players[name]) players[name] = { name, highest_score: null, best_bowling: null, total_runs: 0, total_wickets: 0, matches: 0 };
        players[name].total_wickets += bw.wickets;
        if (!players[name].best_bowling ||
            bw.wickets > players[name].best_bowling!.wickets ||
            (bw.wickets === players[name].best_bowling!.wickets && bw.runs < players[name].best_bowling!.runs)) {
          players[name].best_bowling = { wickets: bw.wickets, runs: bw.runs, date, vs: opp };
        }
      }));
    });

    return Object.values(players).sort((a, b) => b.total_runs - a.total_runs);
  }, [cards]);

  return { matchHighlights, seasonRecords, playerCareerBests, loading };
}
