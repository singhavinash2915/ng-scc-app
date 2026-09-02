// ─── ICC scoring rules ─────────────────────────────────────────────────────────
// Pure functions over a list of balls. No React, no network — so the rules can
// be tested on their own, which matters because a scoring bug is invisible until
// someone's average is wrong three months later.
//
// Deliberately derives EVERYTHING from the ball list rather than keeping running
// totals. Undo then costs nothing: drop the last ball and recompute.

export type ExtraType = 'wd' | 'nb' | 'b' | 'lb';
export type WicketType =
  | 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'retired';

export interface Ball {
  seq: number;
  over_no: number;
  ball_no: number;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  runs_off_bat: number;
  extra_type: ExtraType | null;
  extra_runs: number;
  wicket_type: WicketType | null;
  dismissed_id: string | null;
  fielder_id: string | null;
}

export interface MatchFormat {
  oversPerInnings: number;
  playersPerSide: number;
  maxOversPerBowler: number;
}

export const DEFAULT_FORMAT: MatchFormat = {
  oversPerInnings: 16,
  playersPerSide: 12,
  maxOversPerBowler: 4,
};

// ─── Ball classification ───────────────────────────────────────────────────────

/**
 * Does this delivery count towards the over?
 * Wides and no-balls have to be re-bowled; byes and leg-byes are legal balls.
 */
export const isLegalDelivery = (b: Pick<Ball, 'extra_type'>): boolean =>
  b.extra_type !== 'wd' && b.extra_type !== 'nb';

/** Total runs the batting side gets from this delivery. */
export const totalRuns = (b: Pick<Ball, 'runs_off_bat' | 'extra_runs'>): number =>
  b.runs_off_bat + b.extra_runs;

/**
 * Runs charged against the bowler's analysis. Wides and no-balls are the
 * bowler's fault; byes and leg-byes are not — the ball beat everyone, which is
 * why an over of byes can still be a maiden.
 */
export function runsAgainstBowler(b: Pick<Ball, 'runs_off_bat' | 'extra_type' | 'extra_runs'>): number {
  if (b.extra_type === 'b' || b.extra_type === 'lb') return b.runs_off_bat;
  return b.runs_off_bat + b.extra_runs;
}

/** Wickets credited to the bowler — a run out is nobody's bowling. */
export function isBowlerWicket(w: WicketType | null): boolean {
  return w === 'bowled' || w === 'caught' || w === 'lbw'
      || w === 'stumped' || w === 'hit_wicket';
}

/** Balls faced by the striker. A wide isn't faced; a no-ball is. */
export const isBallFaced = (b: Pick<Ball, 'extra_type'>): boolean => b.extra_type !== 'wd';

// ─── Innings state ─────────────────────────────────────────────────────────────

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: string;            // "14.2"
  oversFloat: number;
  runRate: number;
  extras: { wd: number; nb: number; b: number; lb: number; total: number };
  /** Whose turn it is to face, after applying every ball so far. */
  strikerId: string | null;
  nonStrikerId: string | null;
  /** Balls of the current over, oldest first — the "this over" strip. */
  thisOver: Ball[];
  /** True when the innings can't continue. */
  isComplete: boolean;
  completeReason: 'overs' | 'allout' | 'target' | null;
}

export const formatOvers = (legalBalls: number): string =>
  `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

/**
 * Fold the ball list into the current state of the innings.
 *
 * `openers` seeds who is on strike; after that, strike is worked out purely
 * from what happened — odd runs swap, end of over swaps, a dismissed batter is
 * replaced by whoever came in.
 */
export function inningsState(
  balls: Ball[],
  format: MatchFormat,
  target?: number | null,
): InningsState {
  let runs = 0, wickets = 0, legalBalls = 0;
  const extras = { wd: 0, nb: 0, b: 0, lb: 0, total: 0 };

  for (const b of balls) {
    runs += totalRuns(b);
    if (b.extra_type) {
      extras[b.extra_type] += b.extra_runs;
      extras.total += b.extra_runs;
    }
    if (isLegalDelivery(b)) legalBalls += 1;
    if (b.wicket_type && b.wicket_type !== 'retired') wickets += 1;
  }

  const last = balls[balls.length - 1];
  // The striker/non-striker recorded on a ball are who FACED it, so the next
  // batter to face is derived by applying that ball's outcome.
  const { strikerId, nonStrikerId } = nextStrikers(last ?? null);

  const overNo = Math.floor(legalBalls / 6);
  const thisOver = balls.filter(b => b.over_no === (last ? last.over_no : 0))
    .filter(b => b.over_no === overNo || (last && last.over_no === overNo));

  const maxWickets = format.playersPerSide - 1;
  const oversFloat = legalBalls / 6;

  let isComplete = false;
  let completeReason: InningsState['completeReason'] = null;
  if (target != null && runs >= target) { isComplete = true; completeReason = 'target'; }
  else if (wickets >= maxWickets)        { isComplete = true; completeReason = 'allout'; }
  else if (legalBalls >= format.oversPerInnings * 6) { isComplete = true; completeReason = 'overs'; }

  return {
    runs, wickets, legalBalls,
    overs: formatOvers(legalBalls),
    oversFloat,
    runRate: oversFloat > 0 ? Math.round((runs / oversFloat) * 100) / 100 : 0,
    extras,
    strikerId, nonStrikerId,
    thisOver,
    isComplete, completeReason,
  };
}

/**
 * Who's on strike after a given ball.
 *
 * Odd runs swap the batters. The end of an over swaps them again — so 1 run off
 * the last ball of an over means the SAME batter keeps strike, which is the
 * classic thing hand-scoring gets wrong.
 */
export function nextStrikers(last: Ball | null): { strikerId: string | null; nonStrikerId: string | null } {
  if (!last) return { strikerId: null, nonStrikerId: null };

  let striker = last.striker_id;
  let nonStriker = last.non_striker_id;

  // Byes and leg-byes are still run by the batters, so they rotate too.
  const ranOdd = (last.runs_off_bat + (last.extra_type === 'b' || last.extra_type === 'lb'
    ? last.extra_runs : last.extra_type === 'wd' ? last.extra_runs - 1 : 0)) % 2 === 1;
  if (ranOdd) [striker, nonStriker] = [nonStriker, striker];

  // End of over: the bowling switches ends, so the batters change over.
  const overEnded = isLegalDelivery(last) && (last.ball_no + 1) % 6 === 0;
  if (overEnded) [striker, nonStriker] = [nonStriker, striker];

  // Someone dismissed on that ball is not at the crease any more. Without this
  // the dismissed batter was still reported as a current batter, and the scoring
  // page pre-fills its striker dropdown from here — so re-opening or re-claiming
  // a match mid-innings put a player who was already out back on strike, ready
  // to be credited with the next runs. Blank means "ask who came in".
  if (last.dismissed_id) {
    if (striker === last.dismissed_id) striker = null;
    if (nonStriker === last.dismissed_id) nonStriker = null;
  }

  return { strikerId: striker, nonStrikerId: nonStriker };
}

// ─── Player cards ──────────────────────────────────────────────────────────────

export interface BattingLine {
  memberId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  wicketType: WicketType | null;
  bowlerId: string | null;
  fielderId: string | null;
}

export function battingCard(balls: Ball[]): Map<string, BattingLine> {
  const card = new Map<string, BattingLine>();
  const line = (id: string): BattingLine => {
    if (!card.has(id)) {
      card.set(id, {
        memberId: id, runs: 0, balls: 0, fours: 0, sixes: 0,
        strikeRate: 0, out: false, wicketType: null, bowlerId: null, fielderId: null,
      });
    }
    return card.get(id)!;
  };

  for (const b of balls) {
    if (b.striker_id) {
      const l = line(b.striker_id);
      l.runs += b.runs_off_bat;
      if (isBallFaced(b)) l.balls += 1;
      if (b.runs_off_bat === 4) l.fours += 1;
      if (b.runs_off_bat === 6) l.sixes += 1;
    }
    // A run out can dismiss the NON-striker, so credit the dismissal to whoever
    // is actually recorded as out rather than assuming it was the striker.
    if (b.wicket_type && b.wicket_type !== 'retired' && b.dismissed_id) {
      const l = line(b.dismissed_id);
      l.out = true;
      l.wicketType = b.wicket_type;
      l.bowlerId = isBowlerWicket(b.wicket_type) ? b.bowler_id : null;
      l.fielderId = b.fielder_id;
    }
  }

  for (const l of card.values()) {
    l.strikeRate = l.balls > 0 ? Math.round((l.runs / l.balls) * 10000) / 100 : 0;
  }
  return card;
}

export interface BowlingLine {
  memberId: string;
  legalBalls: number;
  overs: string;
  runs: number;
  wickets: number;
  maidens: number;
  economy: number;
  wides: number;
  noBalls: number;
}

export function bowlingCard(balls: Ball[]): Map<string, BowlingLine> {
  const card = new Map<string, BowlingLine>();
  const line = (id: string): BowlingLine => {
    if (!card.has(id)) {
      card.set(id, {
        memberId: id, legalBalls: 0, overs: '0.0', runs: 0,
        wickets: 0, maidens: 0, economy: 0, wides: 0, noBalls: 0,
      });
    }
    return card.get(id)!;
  };

  for (const b of balls) {
    if (!b.bowler_id) continue;
    const l = line(b.bowler_id);
    if (isLegalDelivery(b)) l.legalBalls += 1;
    l.runs += runsAgainstBowler(b);
    if (isBowlerWicket(b.wicket_type)) l.wickets += 1;
    if (b.extra_type === 'wd') l.wides += b.extra_runs;
    if (b.extra_type === 'nb') l.noBalls += 1;
  }

  // A maiden is a completed over with nothing charged to the bowler. Byes and
  // leg-byes don't spoil it — they aren't the bowler's runs.
  const byOver = new Map<string, Ball[]>();
  for (const b of balls) {
    const k = `${b.bowler_id}|${b.over_no}`;
    if (!byOver.has(k)) byOver.set(k, []);
    byOver.get(k)!.push(b);
  }
  for (const [k, group] of byOver) {
    const bowlerId = k.split('|')[0];
    if (bowlerId === 'null') continue;
    const legal = group.filter(isLegalDelivery).length;
    const conceded = group.reduce((n, b) => n + runsAgainstBowler(b), 0);
    if (legal === 6 && conceded === 0) line(bowlerId).maidens += 1;
  }

  for (const l of card.values()) {
    l.overs = formatOvers(l.legalBalls);
    const ov = l.legalBalls / 6;
    l.economy = ov > 0 ? Math.round((l.runs / ov) * 100) / 100 : 0;
  }
  return card;
}

// ─── What the scorer is allowed to do next ─────────────────────────────────────

export interface NextBallContext {
  overNo: number;
  ballNo: number;           // legal balls bowled in this over
  isNewOver: boolean;
  ballsLeftInOver: number;
  /** Bowlers who may not bowl the next over. */
  ineligibleBowlers: string[];
}

/**
 * ICC: a bowler can't bowl consecutive overs, and in limited-overs cricket is
 * capped at a share of the innings. Both are enforced here rather than trusted
 * to the scorer, who has enough to think about.
 */
export function nextBallContext(balls: Ball[], format: MatchFormat): NextBallContext {
  const legalBalls = balls.filter(isLegalDelivery).length;
  const overNo = Math.floor(legalBalls / 6);
  const ballNo = legalBalls % 6;
  const isNewOver = ballNo === 0;

  const ineligible: string[] = [];
  if (isNewOver && overNo > 0) {
    const prev = [...balls].reverse().find(b => b.over_no === overNo - 1);
    if (prev?.bowler_id) ineligible.push(prev.bowler_id);
  }
  const spells = bowlingCard(balls);
  for (const [id, l] of spells) {
    if (l.legalBalls >= format.maxOversPerBowler * 6 && !ineligible.includes(id)) {
      ineligible.push(id);
    }
  }

  return {
    overNo, ballNo, isNewOver,
    ballsLeftInOver: 6 - ballNo,
    ineligibleBowlers: ineligible,
  };
}

/**
 * A free hit follows a no-ball in limited-overs cricket: the batter can only be
 * out run out (or the handful of oddities we don't score for). Worth surfacing —
 * it changes how the batter plays and the crowd wants to know.
 */
export function isFreeHit(balls: Ball[]): boolean {
  const last = balls[balls.length - 1];
  return last?.extra_type === 'nb';
}
