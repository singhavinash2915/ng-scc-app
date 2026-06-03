/**
 * Computes the actual outcome of a match for scoring predictions against.
 * Pulls from the existing scorecard data — no extra DB needed.
 */
import type { Match } from '../types';
import type { MatchScorecard, BatterRow, BowlerRow } from '../hooks/useMatchScorecard';
import type { ScoreRange, YesNo } from '../hooks/usePredictions';

const SCC_TEAM_ID = 7927431;

export interface MatchOutcome {
  winner: 'scc' | 'opponent' | 'draw' | 'dhurandars' | 'bazigars';
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mom_id: string | null;
  score_range:      ScoreRange | null;
  fifty_scored:     YesNo | null;
  three_wicket_haul: YesNo | null;
}

function bucketScore(runs: number): ScoreRange {
  if (runs < 100) return 'under_100';
  if (runs < 110) return '100_110';
  if (runs < 125) return '110_125';
  return 'over_125';
}

function namesMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z]/g, '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const fa = a.toLowerCase().split(/\s+/)[0];
  const fb = b.toLowerCase().split(/\s+/)[0];
  if (fa && fa === fb) return true;
  return na.includes(nb) || nb.includes(na);
}

/**
 * Given a match + its scorecard, returns the actual outcome.
 * Returns null when the match isn't settled yet or scorecard is missing.
 */
export function deriveOutcome(
  match: Match,
  scorecard: MatchScorecard | null,
  members: Array<{ id: string; name: string }>,
): MatchOutcome | null {
  if (!['won', 'lost', 'draw'].includes(match.result)) return null;

  // For internal matches, winner is whichever SCC team won
  let winner: MatchOutcome['winner'];
  if (match.match_type === 'internal') {
    winner = (match.winning_team as 'dhurandars' | 'bazigars' | null) || 'draw';
  } else {
    winner = match.result === 'won' ? 'scc' : match.result === 'lost' ? 'opponent' : 'draw';
  }

  let topScorer: BatterRow | null = null;
  let topWicketTaker: BowlerRow | null = null;
  let sccBattingRows: BatterRow[] | null = null;
  let sccBowlingRows: BowlerRow[] | null = null;

  if (scorecard) {
    sccBattingRows = scorecard.innings1_team_id === SCC_TEAM_ID
      ? scorecard.innings1_batting
      : scorecard.innings2_team_id === SCC_TEAM_ID
        ? scorecard.innings2_batting
        : null;
    // SCC bowls in OPPONENT's batting innings
    sccBowlingRows = scorecard.innings1_team_id === SCC_TEAM_ID
      ? scorecard.innings2_bowling
      : scorecard.innings2_team_id === SCC_TEAM_ID
        ? scorecard.innings1_bowling
        : null;

    if (sccBattingRows && sccBattingRows.length > 0) {
      topScorer = [...sccBattingRows].filter(b => b.balls > 0).sort((a, b) => b.runs - a.runs)[0] || null;
    }
    if (sccBowlingRows && sccBowlingRows.length > 0) {
      topWicketTaker = [...sccBowlingRows].sort((a, b) => {
        if (b.wickets !== a.wickets) return b.wickets - a.wickets;
        return a.runs - b.runs;
      })[0] || null;
    }
  }

  const resolveToMemberId = (name: string | undefined): string | null => {
    if (!name) return null;
    const m = members.find(mem => namesMatch(mem.name, name));
    return m ? m.id : null;
  };

  // ── Bonus question outcomes ────────────────────────────────────────────────
  // SCC total runs → bucket
  let score_range: ScoreRange | null = null;
  if (sccBattingRows && sccBattingRows.length > 0) {
    const sccTotal = sccBattingRows.reduce((sum, b) => sum + (b.runs || 0), 0);
    score_range = bucketScore(sccTotal);
  }
  // Anyone in SCC batting scored 50+?
  const fifty_scored: YesNo | null = sccBattingRows
    ? (sccBattingRows.some(b => (b.runs || 0) >= 50) ? 'yes' : 'no')
    : null;
  // Anyone in SCC bowling took 3+ wickets?
  const three_wicket_haul: YesNo | null = sccBowlingRows
    ? (sccBowlingRows.some(b => (b.wickets || 0) >= 3) ? 'yes' : 'no')
    : null;

  return {
    winner,
    top_scorer_id: topScorer ? resolveToMemberId(topScorer.name) : null,
    top_wicket_taker_id: topWicketTaker && topWicketTaker.wickets > 0
      ? resolveToMemberId(topWicketTaker.name) : null,
    mom_id: match.man_of_match_id || null,
    score_range,
    fifty_scored,
    three_wicket_haul,
  };
}

export const PREDICTION_POINTS = {
  winner: 5,
  top_scorer: 10,
  top_wicket_taker: 10,
  mom: 5,
  score_range: 10,
  fifty_scored: 5,
  three_wicket_haul: 10,
};
