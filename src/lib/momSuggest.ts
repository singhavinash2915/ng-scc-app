import { battingCard, bowlingCard, type Ball } from './cricketRules';

// ─── Man of the Match: a suggestion, never a verdict ──────────────────────────
// CricHeroes picks MOM from raw stats and says outright that it misses the tense
// situations. We do the ranking but stop short of deciding: the club votes for
// MOM, and an algorithm quietly overruling a human vote is not a feature anyone
// asks for twice. So this returns a ranked shortlist with the reasoning shown,
// and the scorer taps to accept or ignores it entirely.
//
// Two things it does that a plain runs+wickets tally doesn't:
//
//   1. Everything is judged against THIS match's run rate, not fixed thresholds.
//      On a low tennis-ball pitch a hard-earned 30 can be the innings of the day;
//      against a fixed bar it looks ordinary.
//   2. The winning side is weighted. 40 that wins a chase is worth more than 40
//      in a lost cause — the situation CricHeroes admits it can't see.

export interface Impact {
  memberId: string;
  score: number;
  /** Human-readable line, e.g. "42 (28) · 2 wickets" — shown next to the name. */
  line: string;
  runs: number;
  wickets: number;
  dismissals: number;
}

const RUN = 1;          // a run is the unit everything else is priced against
const WICKET = 20;      // ~ a wicket swings a game like 20 runs
const CATCH = 10;
const WINNER_BONUS = 1.25;

export interface MomInput {
  /** Every ball of the match. A player can't bat in both innings, so the two
   *  innings can be pooled without a batter's figures merging incorrectly. */
  balls: Ball[];
  /** Member ids on the winning side — they get the weighting. Empty if tied. */
  winningSide: string[];
}

/**
 * Rank every player who did something, best first. Callers normally show the
 * top three; the full list is returned so the pad can fall back to a plain
 * squad picker without a second pass.
 */
export function suggestMom({ balls, winningSide }: MomInput): Impact[] {
  const all = balls;
  if (!all.length) return [];

  // Match run rate — the yardstick for "was this innings good FOR THIS GAME".
  const legal = all.filter(b => b.extra_type !== 'wd' && b.extra_type !== 'nb').length;
  const totalRuns = all.reduce((s, b) => s + b.runs_off_bat + b.extra_runs, 0);
  const matchRR = legal ? (totalRuns / legal) * 6 : 6;
  const parSR = (matchRR / 6) * 100;

  const acc = new Map<string, Impact>();
  const get = (id: string): Impact => {
    if (!acc.has(id)) {
      acc.set(id, { memberId: id, score: 0, line: '', runs: 0, wickets: 0, dismissals: 0 });
    }
    return acc.get(id)!;
  };

  {
    const src = all;
    for (const [id, bat] of battingCard(src)) {
      const e = get(id);
      e.runs += bat.runs;
      e.score += bat.runs * RUN;
      // Scoring faster than the match demanded is worth something; slower costs.
      // Weighted by balls faced so a 6-ball cameo can't outscore a real innings.
      if (bat.balls >= 5) {
        e.score += ((bat.strikeRate - parSR) / 100) * bat.balls * 0.5;
      }
    }
    for (const [id, bowl] of bowlingCard(src)) {
      const e = get(id);
      e.wickets += bowl.wickets;
      e.score += bowl.wickets * WICKET;
      // Economy measured against the same yardstick, priced in runs saved.
      if (bowl.legalBalls >= 6) {
        e.score += ((matchRR - bowl.economy) / 6) * bowl.legalBalls;
      }
      e.score += bowl.maidens * 4;
    }
    // Fielding: catches, stumpings and run-outs all credit the fielder.
    for (const b of src) {
      if (b.fielder_id && b.wicket_type && b.wicket_type !== 'bowled' && b.wicket_type !== 'lbw') {
        const e = get(b.fielder_id);
        e.dismissals += 1;
        e.score += CATCH;
      }
    }
  }

  const winners = new Set(winningSide);
  const out: Impact[] = [];
  for (const e of acc.values()) {
    if (winners.has(e.memberId)) e.score *= WINNER_BONUS;
    const bits: string[] = [];
    if (e.runs) bits.push(`${e.runs} runs`);
    if (e.wickets) bits.push(`${e.wickets} wkt${e.wickets > 1 ? 's' : ''}`);
    if (e.dismissals) bits.push(`${e.dismissals} catch${e.dismissals > 1 ? 'es' : ''}`);
    e.line = bits.join(' · ') || 'no contribution';
    e.score = Math.round(e.score * 10) / 10;
    if (e.runs || e.wickets || e.dismissals) out.push(e);
  }
  return out.sort((a, b) => b.score - a.score);
}
