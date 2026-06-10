/**
 * Computes the actual outcome of a match for scoring predictions against.
 * Pulls from the existing scorecard data — no extra DB needed.
 */
import type { Match } from '../types';
import type { MatchScorecard, BatterRow, BowlerRow } from '../hooks/useMatchScorecard';
import type { ScoreRange, YesNo, SixesTeam, MarginType } from '../hooks/usePredictions';

const SCC_TEAM_ID = 7927431;

export interface MatchOutcome {
  winner: 'scc' | 'opponent' | 'draw' | 'dhurandars' | 'bazigars';
  top_scorer_id: string | null;
  top_wicket_taker_id: string | null;
  mom_id: string | null;
  score_range:      ScoreRange | null;
  fifty_scored:     YesNo | null;
  three_wicket_haul: YesNo | null;
  // Internal-match bonus outcomes
  internal_most_sixes: SixesTeam | null;
  internal_margin:     MarginType | null;
  internal_milestone:  YesNo | null;
  internal_highest_team: SixesTeam | null;
  internal_duck:         YesNo | null;
  int_dhur_top_scorer_id: string | null;
  int_baz_top_scorer_id:  string | null;
  int_dhur_top_wicket_id: string | null;
  int_baz_top_wicket_id:  string | null;
}

function bucketScore(runs: number): ScoreRange {
  if (runs < 100) return 'under_100';
  if (runs < 110) return '100_110';
  if (runs < 125) return '110_125';
  return 'over_125';
}

// Identify which internal SCC team an innings belongs to from the team name.
function internalTeamOf(teamName: string | null): 'dhurandars' | 'bazigars' | null {
  const n = (teamName || '').toLowerCase();
  if (n.includes('dhurand')) return 'dhurandars';
  if (n.includes('baazig') || n.includes('bazig')) return 'bazigars';
  return null;
}

function sumSixes(rows: BatterRow[] | null): number {
  if (!rows) return 0;
  return rows.reduce((sum, b) => sum + (Number(b['6s']) || 0), 0);
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
    if (match.match_type === 'internal') {
      // Internal: both innings are SCC teams (Dhurandars + Bazigars), so the
      // "top scorer" and "top wicket-taker" are the best across BOTH innings.
      sccBattingRows = [...(scorecard.innings1_batting || []), ...(scorecard.innings2_batting || [])];
      sccBowlingRows = [...(scorecard.innings1_bowling || []), ...(scorecard.innings2_bowling || [])];
    } else {
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
    }

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

  // ── Internal-match (Dhurandars vs Bazigars) bonus outcomes ─────────────────
  let internal_most_sixes: SixesTeam | null = null;
  let internal_margin:     MarginType | null = null;
  let internal_milestone:  YesNo | null = null;
  let internal_highest_team: SixesTeam | null = null;
  let internal_duck:         YesNo | null = null;
  let int_dhur_top_scorer_id: string | null = null;
  let int_baz_top_scorer_id:  string | null = null;
  let int_dhur_top_wicket_id: string | null = null;
  let int_baz_top_wicket_id:  string | null = null;

  if (match.match_type === 'internal' && scorecard) {
    const inn1Team = internalTeamOf(scorecard.innings1_team_name);
    const inn2Team = internalTeamOf(scorecard.innings2_team_name);
    const inn1Bat  = scorecard.innings1_batting;
    const inn2Bat  = scorecard.innings2_batting;

    // Map each team to its batting + bowling rows.
    // A team BOWLS in the OTHER team's batting innings.
    const dhurBat  = inn1Team === 'dhurandars' ? inn1Bat : inn2Bat;
    const bazBat   = inn1Team === 'dhurandars' ? inn2Bat : inn1Bat;
    const dhurBowl = inn1Team === 'dhurandars' ? scorecard.innings2_bowling : scorecard.innings1_bowling;
    const bazBowl  = inn1Team === 'dhurandars' ? scorecard.innings1_bowling : scorecard.innings2_bowling;

    const topScorerOf = (rows: BatterRow[] | null): BatterRow | null =>
      rows && rows.length ? [...rows].filter(b => (b.balls || 0) > 0).sort((a, b) => b.runs - a.runs)[0] || null : null;
    const topWicketOf = (rows: BowlerRow[] | null): BowlerRow | null =>
      rows && rows.length ? [...rows].sort((a, b) => (b.wickets - a.wickets) || (a.runs - b.runs))[0] || null : null;
    const maxRunsOf = (rows: BatterRow[] | null): number =>
      rows && rows.length ? Math.max(0, ...rows.map(b => b.runs || 0)) : 0;

    // Per-team top scorers / top wicket-takers
    const ds = topScorerOf(dhurBat); if (ds) int_dhur_top_scorer_id = resolveToMemberId(ds.name);
    const bs = topScorerOf(bazBat);  if (bs) int_baz_top_scorer_id  = resolveToMemberId(bs.name);
    const dw = topWicketOf(dhurBowl); if (dw && dw.wickets > 0) int_dhur_top_wicket_id = resolveToMemberId(dw.name);
    const bw = topWicketOf(bazBowl);  if (bw && bw.wickets > 0) int_baz_top_wicket_id  = resolveToMemberId(bw.name);

    // Most sixes — compare the two teams' batting innings
    if (inn1Team && inn2Team && (inn1Bat || inn2Bat)) {
      const sixesD = sumSixes(dhurBat);
      const sixesB = sumSixes(bazBat);
      internal_most_sixes = sixesD === sixesB ? 'tie' : sixesD > sixesB ? 'dhurandars' : 'bazigars';
    }

    // Highest individual score — which team has the bigger single knock
    if (inn1Team && inn2Team && (inn1Bat || inn2Bat)) {
      const hiD = maxRunsOf(dhurBat);
      const hiB = maxRunsOf(bazBat);
      internal_highest_team = hiD === hiB ? 'tie' : hiD > hiB ? 'dhurandars' : 'bazigars';
    }

    // Winning margin (run-difference based — robust for internal matches that
    // allow more than 11 batters, so wicket-margin is unreliable)
    const inn1Total = (scorecard.innings1_summary?.total_run ?? null);
    const inn2Total = (scorecard.innings2_summary?.total_run ?? null);
    if (inn1Total != null && inn2Total != null) {
      const diff = Math.abs(inn1Total - inn2Total);
      internal_margin = diff <= 8 ? 'thriller' : diff <= 30 ? 'comfortable' : 'dominant';
    }

    // Anyone score 30+ across either innings?
    const allBat = [...(inn1Bat || []), ...(inn2Bat || [])];
    if (allBat.length) {
      internal_milestone = allBat.some(b => (b.runs || 0) >= 30) ? 'yes' : 'no';
      // Will anyone get a duck (out for 0)?
      internal_duck = allBat.some(b => (b.runs || 0) === 0 && !!(b.how_to_out && b.how_to_out.trim())) ? 'yes' : 'no';
    }
  }

  return {
    winner,
    top_scorer_id: topScorer ? resolveToMemberId(topScorer.name) : null,
    top_wicket_taker_id: topWicketTaker && topWicketTaker.wickets > 0
      ? resolveToMemberId(topWicketTaker.name) : null,
    mom_id: match.man_of_match_id || null,
    score_range,
    fifty_scored,
    three_wicket_haul,
    internal_most_sixes,
    internal_margin,
    internal_milestone,
    internal_highest_team,
    internal_duck,
    int_dhur_top_scorer_id,
    int_baz_top_scorer_id,
    int_dhur_top_wicket_id,
    int_baz_top_wicket_id,
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
  internal_most_sixes: 10,
  internal_margin: 10,
  internal_milestone: 5,
  internal_highest_team: 5,
  internal_duck: 5,
  int_team_top_scorer: 5,
  int_team_top_wicket: 5,
};
