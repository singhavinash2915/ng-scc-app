import { type Ball, isLegalDelivery } from './cricketRules';
import { winProbability as engineWinProbability } from './pressure';

// ─── The live match experience ────────────────────────────────────────────────
// The scoring pad is the input; this is what everyone NOT at the ground sees.
// Two things turn a score into something worth watching: commentary that reads
// like a person wrote it, and a number that says who's winning.
//
// Both are derived from the same ball rows the scorer is already producing, so
// there is nothing extra to maintain and nothing extra to fetch.

// ── Commentary ────────────────────────────────────────────────────────────────

/**
 * One line per delivery, in the order a commentator would say it: what the ball
 * did, then what it cost. Names are resolved by the caller — this stays pure so
 * it can be tested without a database.
 */
export function commentaryFor(b: Ball, names: (id: string | null) => string): string {
  const bowler = names(b.bowler_id);
  const bat = names(b.striker_id);
  const runs = b.runs_off_bat;

  if (b.wicket_type && b.wicket_type !== 'retired') {
    const how = {
      bowled: 'bowled him!', caught: 'caught!', lbw: 'lbw!',
      run_out: 'run out!', stumped: 'stumped!', hit_wicket: 'hit wicket!',
    }[b.wicket_type] ?? 'out!';
    const who = names(b.dismissed_id) || bat;
    const fielder = b.fielder_id ? ` ${names(b.fielder_id)} takes it.` : '';
    return `${bowler} to ${who} — ${how}${fielder}`;
  }

  if (b.extra_type === 'wd') {
    return b.extra_runs > 1
      ? `${bowler} — wide, and they run ${b.extra_runs - 1} more.`
      : `${bowler} — wide down the leg side.`;
  }
  if (b.extra_type === 'nb') return `${bowler} — no ball! Free hit coming up.`;
  if (b.extra_type === 'b')  return `${bowler} to ${bat} — beaten, ${b.extra_runs} bye${b.extra_runs > 1 ? 's' : ''}.`;
  if (b.extra_type === 'lb') return `${bowler} to ${bat} — off the pad, ${b.extra_runs} leg bye${b.extra_runs > 1 ? 's' : ''}.`;

  if (runs === 6) return `${bowler} to ${bat} — SIX! That's out of the ground.`;
  if (runs === 4) return `${bowler} to ${bat} — FOUR, beautifully timed.`;
  if (runs === 0) return `${bowler} to ${bat} — no run, solid defence.`;
  return `${bowler} to ${bat} — ${runs} run${runs > 1 ? 's' : ''}.`;
}

// ── Win probability ───────────────────────────────────────────────────────────

export interface ChaseState {
  target: number;      // runs needed to WIN (first innings + 1)
  runs: number;
  wickets: number;
  legalBalls: number;
  oversPerInnings: number;
  playersPerSide: number;
}

/**
 * Chance the chasing side wins, 0–1.
 *
 * Deliberately a simple, explainable model rather than a fitted one: we have a
 * few hundred matches, which is nowhere near enough to train anything and more
 * than enough to overfit. It weighs the two things that actually decide a
 * tennis-ball chase — how far ahead of the required rate you are, and how many
 * wickets you have left to attack with.
 *
 * Being honest about the limits matters more than the last few percent: this is
 * a talking point for the group chat, not a betting line.
 */
export function winProbability(s: ChaseState): number {
  // Calibrated against SCC's own chases — see lib/pressure.ts. Kept here with the
  // old signature so the scoreboard callers do not change.
  return engineWinProbability(
    { runs: s.runs, wickets: s.wickets, legalBalls: s.legalBalls, target: s.target },
    { oversPerInnings: s.oversPerInnings, playersPerSide: s.playersPerSide },
  );
}

/** Short human summary — "Need 42 off 30" — for the banner and the viewer. */
export function chaseLine(s: ChaseState): string {
  const ballsLeft = s.oversPerInnings * 6 - s.legalBalls;
  const need = s.target - s.runs;
  if (need <= 0) return 'Target chased';
  if (ballsLeft <= 0) return 'Out of overs';
  return `Need ${need} off ${ballsLeft}`;
}

/** Balls that changed the game most — the highlights reel, without video. */
export function keyMoments(balls: Ball[]): Ball[] {
  return balls.filter(b =>
    (b.wicket_type && b.wicket_type !== 'retired') || b.runs_off_bat >= 4,
  );
}

/** Runs per over, for the worm/bar chart in the viewer. */
export function overByOver(balls: Ball[]): Array<{ over: number; runs: number; wickets: number }> {
  const out: Array<{ over: number; runs: number; wickets: number }> = [];
  for (const b of balls) {
    let row = out.find(o => o.over === b.over_no);
    if (!row) { row = { over: b.over_no, runs: 0, wickets: 0 }; out.push(row); }
    row.runs += b.runs_off_bat + b.extra_runs;
    if (b.wicket_type && b.wicket_type !== 'retired') row.wickets += 1;
  }
  return out.sort((a, b) => a.over - b.over);
}

/** Legal-ball count, shared so the viewer and the banner never disagree. */
export const legalCount = (balls: Ball[]) => balls.filter(isLegalDelivery).length;
