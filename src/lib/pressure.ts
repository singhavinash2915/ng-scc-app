// ─── Pressure Index, win probability and impact ───────────────────────────────
// The engine behind the live pressure gauge, the Match Centre impact tab and the
// season impact tables. Pure functions: no React, no database, so every number
// on those screens can be reproduced — and tested — from the balls alone.
//
// Why it is built this way
// ────────────────────────
// CricHeroes' MVP 2.0 publishes the shape of its answer and not its formula. The
// shape gives the game away: in their worked example a wicket pushes pressure
// UP from 52 to 81 while the required rate barely moves. So it is not a run-rate
// model with wickets bolted on. It is a RESOURCES model — balls and wickets in
// hand, together — the idea behind Duckworth-Lewis.
//
// Four layers, each feeding the next:
//
//   1. resources()      how much batting a side has left, 0..1
//   2. winProbability   the batting side's chance, in either innings
//   3. pressureIndex    how much the next ball matters × how bad it is, 0..100
//   4. impact           win probability each player moved, over a match
//
// Calibration — all of it from SCC's own record, not a T20 textbook
// ────────────────────────────────────────────────────────────────────────────
// 170 matches with a usable first innings at 15–16 overs:
//   first-innings total   mean 119.8, sd 29.5, median 118
//   chase success         fitted as a logistic by maximum likelihood:
//                         even-money target 120.2, scale 20.2
//   target  90  → model 82%  (actual 91%, 22 matches)
//   target 110  → model 62%  (actual 58%, 50 matches)
//   target 130  → model 38%  (actual 42%, 38 matches)
//   target 150  → model 19%  (actual 21%, 28 matches)
//   target 170  → model  8%  (actual  6%, 16 matches)
// Then, ball by ball, on ~33,000 deliveries rebuilt from CricHeroes (see
// scripts/sync_ch_balls.py) — which found the model underrating chasing sides by
// 10–19 points mid-innings. Chasers pace to a number; chasePar puts that in.
// Re-fit each season with scripts/calibrate_pressure.ts.
//
// Everything is scaled per over so a 12- or 20-over fixture reads sensibly, but
// the numbers were fitted on 16 and are only as good as that sample elsewhere.

/** Calibration, per over of a full innings. Fitted on SCC 16-over matches. */
export const CAL = {
  /** Mean first-innings runs per over. 119.8 / 16. */
  parPerOver: 7.49,
  /** Even-money chase target per over. 120.2 / 16. */
  muPerOver: 7.51,
  /** Logistic scale of the chase curve per over. 20.2 / 16. */
  sPerOver: 1.2625,
  /** Standard deviation of a first-innings total per over. 29.5 / 16. */
  sdTotalPerOver: 1.84,
  /** Resource curve shape. k: how evenly runs come over an innings. */
  k: 0.6,
  /** How hard losing wickets bites. Tuned so the curve tracks DLS for short
   *  formats: 7 down at halfway leaves ~30% of the batting, not 48%. */
  alpha: 1.5,
  /** Ball-to-ball luck: logistic scale of runs per ball. */
  luck: 0.9,
  /** Chasers score more of their resources than a side batting first: they
   *  pace to a number. Multiplies expected remaining runs in a chase. */
  chasePar: 1.2,
  /** Widens (>1) or narrows the chase uncertainty. */
  chaseSpread: 1,
};

export interface Format {
  oversPerInnings: number;
  playersPerSide: number;
}

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number;
  /** Runs to WIN — first-innings total + 1. Absent in the first innings. */
  target?: number | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const logistic = (z: number) => 1 / (1 + Math.exp(-z));

// ─── 1. Resources ─────────────────────────────────────────────────────────────

/**
 * Share of a full innings' scoring potential still available, 0..1.
 *
 * Balls and wickets act together: forty balls with eight wickets in hand is a
 * very different asset from forty balls with two. Shaped like the DLS resource
 * table — at halfway with nobody out a side has ~57% left; with seven down, ~30%.
 */
export function resources(ballsLeft: number, wicketsLost: number, fmt: Format): number {
  const totalBalls = fmt.oversPerInnings * 6;
  const W = Math.max(1, fmt.playersPerSide - 1);
  if (ballsLeft <= 0 || wicketsLost >= W) return 0;
  const u = clamp(ballsLeft / totalBalls, 0, 1);
  const f = Math.pow((W - wicketsLost) / W, CAL.alpha);
  const norm = 1 - Math.exp(-CAL.k);
  return clamp((f * (1 - Math.exp(-CAL.k * u / f))) / norm, 0, 1);
}

// ─── 2. Win probability ───────────────────────────────────────────────────────

/** The batting side's chance of winning, from where they are now. */
export function winProbability(s: InningsState, fmt: Format): number {
  const totalBalls = fmt.oversPerInnings * 6;
  const W = Math.max(1, fmt.playersPerSide - 1);
  const ballsLeft = Math.max(0, totalBalls - s.legalBalls);
  const R = resources(ballsLeft, s.wickets, fmt);
  const par = CAL.parPerOver * fmt.oversPerInnings;
  const S = CAL.sPerOver * fmt.oversPerInnings;
  const expectedMore = par * R;

  if (s.target != null) {
    // ── Chasing ──
    const need = s.target - s.runs;
    if (need <= 0) return 1;
    if (ballsLeft <= 0 || s.wickets >= W) return 0;
    // Two sources of doubt. How the batting side will use what they have left
    // shrinks with their resources; plain ball-to-ball luck — a single versus a
    // four — shrinks only with the square root of the balls. Early on the first
    // dominates; in the last over only the second is left, which is why 6 off 6
    // with wickets in hand is comfortable rather than a coin flip. The core is
    // set so the two together reproduce the fitted scale at the first ball.
    const luck = CAL.luck * Math.sqrt(ballsLeft);
    const core = Math.sqrt(Math.max(S ** 2 - CAL.luck ** 2 * totalBalls, 1));
    const scale = Math.max(Math.hypot(core * R, luck), 0.6) * CAL.chaseSpread;
    // The boost grows as the chase goes on: at the first ball the target is all
    // anyone knows (the fitted curve holds), by the end chasers have paced to it.
    const paced = expectedMore * (1 + (CAL.chasePar - 1) * (1 - R));
    return clamp(logistic((paced - need) / scale), 0.001, 0.999);
  }

  // ── Batting first ──
  // "A competitive score if batting first": project the total from what they
  // have and what they have left, then ask how often a total like that is
  // defended. The projection itself is uncertain early, so its spread is folded
  // into the chase curve's.
  const projected = s.runs + expectedMore;
  const mu = CAL.muPerOver * fmt.oversPerInnings;
  const sdChase = S * Math.PI / Math.sqrt(3);
  const sdProj = CAL.sdTotalPerOver * fmt.oversPerInnings * Math.sqrt(R);
  const scale = Math.sqrt(sdChase ** 2 + sdProj ** 2) * Math.sqrt(3) / Math.PI;
  return clamp(logistic((projected + 1 - mu) / scale), 0.001, 0.999);
}

// ─── 3. Pressure Index ────────────────────────────────────────────────────────

/** Club base rates for what a legal ball produces. Priors until app-scored
 *  matches accumulate enough to fit them; they only shape the leverage term. */
const OUTCOMES: Array<{ runs: number; wicket: boolean; p: number }> = [
  { runs: 0, wicket: false, p: 0.36 },
  { runs: 1, wicket: false, p: 0.30 },
  { runs: 2, wicket: false, p: 0.08 },
  { runs: 3, wicket: false, p: 0.01 },
  { runs: 4, wicket: false, p: 0.12 },
  { runs: 6, wicket: false, p: 0.05 },
  { runs: 0, wicket: true,  p: 0.06 },
];

export type PressureBand = 'Calm' | 'Light' | 'Moderate' | 'High' | 'Extreme';

export const bandOf = (pi: number): PressureBand =>
  pi >= 80 ? 'Extreme' : pi >= 65 ? 'High' : pi >= 40 ? 'Moderate' : pi >= 20 ? 'Light' : 'Calm';

export interface PressureReading {
  /** 0..100 — the higher, the harder the moment for the batting side. */
  index: number;
  band: PressureBand;
  /** Batting side's win probability now, 0..1. */
  winProb: number;
  /** Expected swing in win probability on the next ball. */
  leverage: number;
}

export interface Momentum {
  /** Dots among the last 12 legal balls (or fewer, early on). */
  recentDots: number;
  recentLegal: number;
  /** Wickets among the last 18 balls. */
  recentWickets: number;
}

/**
 * How much pressure the batting side is under before the next ball.
 *
 * The half that makes it feel right is LEVERAGE — how far the next ball can
 * move the result. A chase at 2% or 98% has almost none: nothing hangs on the
 * next ball, however ugly the required rate. Without it, "150 off 12" reads as
 * Extreme when the game is over. Difficulty, a run of dots and recent wickets
 * then push it up, but only while the game is still alive.
 */
export function pressureIndex(s: InningsState, fmt: Format, m?: Momentum): PressureReading {
  const wp = winProbability(s, fmt);
  const totalBalls = fmt.oversPerInnings * 6;
  const W = Math.max(1, fmt.playersPerSide - 1);

  if (s.legalBalls >= totalBalls || s.wickets >= W || (s.target != null && s.runs >= s.target)) {
    return { index: 0, band: 'Calm', winProb: wp, leverage: 0 };
  }

  let leverage = 0;
  let pSum = 0;
  for (const o of OUTCOMES) {
    const next: InningsState = {
      runs: s.runs + o.runs,
      wickets: s.wickets + (o.wicket ? 1 : 0),
      legalBalls: s.legalBalls + 1,
      target: s.target,
    };
    leverage += o.p * Math.abs(winProbability(next, fmt) - wp);
    pSum += o.p;
  }
  leverage /= pSum;

  // Leverage shrinks naturally with time left — one ball of sixty cannot move a
  // match much however close it is. So judge it against what a LEVEL game would
  // swing with this many balls to go: at or above that the game is fully alive;
  // at a small fraction of it (2% or 98%) there is nothing left to feel.
  const ballsLeft = totalBalls - s.legalBalls;
  const levelGame = Math.min(0.17, 0.17 / Math.sqrt(ballsLeft));
  const alive = clamp((2 * leverage) / levelGame, 0, 1);

  const urgency = s.legalBalls / totalBalls;
  const difficulty = clamp((0.7 - wp) / 0.7, 0, 1);
  const dots = m && m.recentLegal > 0 ? m.recentDots / Math.max(m.recentLegal, 6) : 0;
  const wkts = m ? clamp(m.recentWickets / 2, 0, 1) : 0;
  // The last ball or two, when the result rides on it, is extreme whatever the
  // odds say — this is the term that makes "1 off 1" feel like "1 off 1".
  const finale = clamp((leverage - 0.1) / 0.2, 0, 1);

  let raw = alive * (0.12 + 0.22 * urgency + 0.5 * difficulty + 0.12 * dots + 0.15 * wkts)
    + 0.5 * finale;

  // Phase: the death overs carry more, the powerplay a touch less.
  if (urgency >= 0.75) raw *= 1.08;
  else if (urgency < 0.25) raw *= 0.95;

  const index = Math.round(100 * clamp(raw, 0, 1));
  return { index, band: bandOf(index), winProb: wp, leverage };
}

// ─── Walking an innings ball by ball ──────────────────────────────────────────

/** The fields of a delivery the engine needs — a subset of the stored ball. */
export interface EngineBall {
  seq: number;
  over_no: number;
  ball_no: number;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  runs_off_bat: number;
  extra_type: 'wd' | 'nb' | 'b' | 'lb' | null;
  extra_runs: number;
  wicket_type: string | null;
  dismissed_id: string | null;
  fielder_id: string | null;
}

const isLegal = (b: EngineBall) => b.extra_type !== 'wd' && b.extra_type !== 'nb';
/** A retired-hurt batter has not been dismissed and leaves wickets in hand. */
const isDismissal = (b: EngineBall) => !!b.wicket_type && b.wicket_type !== 'retired';

export interface BallReading extends PressureReading {
  seq: number;
  /** "4.3" — over.ball of the delivery this reading came BEFORE. */
  label: string;
  runs: number;
  wickets: number;
  /** Win probability after the ball, so the swing is visible. */
  winProbAfter: number;
}

/** Pressure before every ball of an innings, in order. */
export function pressureCurve(balls: EngineBall[], fmt: Format, target: number | null): BallReading[] {
  const ordered = [...balls].sort((a, b) => a.seq - b.seq);
  const out: BallReading[] = [];
  let runs = 0, wickets = 0, legal = 0;
  const recent: Array<{ dot: boolean; wicket: boolean; legal: boolean }> = [];

  for (const b of ordered) {
    const legalRecent = recent.filter(r => r.legal).slice(-12);
    const m: Momentum = {
      recentDots: legalRecent.filter(r => r.dot).length,
      recentLegal: legalRecent.length,
      recentWickets: recent.slice(-18).filter(r => r.wicket).length,
    };
    const before = pressureIndex({ runs, wickets, legalBalls: legal, target }, fmt, m);

    runs += b.runs_off_bat + b.extra_runs;
    if (isDismissal(b)) wickets += 1;
    if (isLegal(b)) legal += 1;
    const after = winProbability({ runs, wickets, legalBalls: legal, target }, fmt);

    out.push({
      ...before, seq: b.seq,
      label: `${b.over_no}.${b.ball_no + 1}`,
      runs, wickets, winProbAfter: after,
    });
    recent.push({
      dot: b.runs_off_bat + b.extra_runs === 0 && !isDismissal(b),
      wicket: isDismissal(b),
      legal: isLegal(b),
    });
  }
  return out;
}

// ─── 4. Impact ────────────────────────────────────────────────────────────────
// Every ball moves the batting side's win probability. Impact hands that move
// to whoever caused it: the batter gains it, the bowler gains the opposite. A
// dot in a tight chase is negative for the batter and positive for the bowler
// without any special rule — the probability already fell.
//
// Wickets are shared the way a scorer would: bowled, lbw and hit wicket are all
// the bowler's; a catch or stumping splits with the fielder; a run-out is mostly
// the fielder's. A wicket is weighted by how good the batter was — dismissing
// the club's best is worth more than tail-end runs — and breaking a big
// partnership earns a little extra.

export interface ImpactOptions {
  /** Batting average by player id, for "quality of batter dismissed". */
  battingAverage?: Record<string, number>;
  /** The club's average batting average, the neutral point for the above. */
  clubAverage?: number;
  /** Extra fielding events from the pad — dropped catches and runs saved. */
  fieldEvents?: Array<{ seq: number; kind: 'drop' | 'save'; fielder_id: string; runs?: number }>;
}

export interface PlayerImpact {
  playerId: string;
  batting: number;
  bowling: number;
  fielding: number;
  /** On CricHeroes' scale: swinging a match by about half ≈ 10. */
  total: number;
  grade: ImpactGrade;
}

export type ImpactGrade = 'Exceptional' | 'Excellent' | 'Very good' | 'Good' | 'Useful' | 'Marginal';

/** Same bands as CricHeroes publish, so the grades read familiarly. */
export const gradeOf = (score: number): ImpactGrade =>
  score >= 10 ? 'Exceptional' : score >= 7.5 ? 'Excellent' : score >= 5 ? 'Very good'
    : score >= 3 ? 'Good' : score >= 1.5 ? 'Useful' : 'Marginal';

/** Win probability moved × SCALE = impact points. Half a match ≈ 10. */
const SCALE = 20;

const WICKET_SHARE: Record<string, { bowler: number; fielder: number }> = {
  bowled:     { bowler: 1.0, fielder: 0 },
  lbw:        { bowler: 1.0, fielder: 0 },
  hit_wicket: { bowler: 1.0, fielder: 0 },
  caught:     { bowler: 0.75, fielder: 0.25 },
  stumped:    { bowler: 0.6, fielder: 0.4 },
  run_out:    { bowler: 0.1, fielder: 0.9 },
  retired_out: { bowler: 0, fielder: 0 },
};

/**
 * Impact for everyone who took part in one innings. Combine both innings of a
 * match by adding the rows — the function is additive by player.
 */
export function inningsImpact(
  balls: EngineBall[], fmt: Format, target: number | null, opts: ImpactOptions = {},
): Map<string, PlayerImpact> {
  const rows = new Map<string, { batting: number; bowling: number; fielding: number }>();
  const add = (id: string | null, field: 'batting' | 'bowling' | 'fielding', v: number) => {
    if (!id || !Number.isFinite(v)) return;
    const r = rows.get(id) ?? { batting: 0, bowling: 0, fielding: 0 };
    r[field] += v;
    rows.set(id, r);
  };

  const clubAvg = opts.clubAverage && opts.clubAverage > 0 ? opts.clubAverage : 20;
  const quality = (id: string | null) => {
    const a = id ? opts.battingAverage?.[id] : undefined;
    return a && a > 0 ? clamp(a / clubAvg, 0.6, 1.6) : 1;
  };

  const ordered = [...balls].sort((a, b) => a.seq - b.seq);
  let runs = 0, wickets = 0, legal = 0, partnership = 0;

  for (const b of ordered) {
    const before = winProbability({ runs, wickets, legalBalls: legal, target }, fmt);
    const r = b.runs_off_bat + b.extra_runs;
    runs += r;
    const out = isDismissal(b);
    if (out) wickets += 1;
    if (isLegal(b)) legal += 1;
    const after = winProbability({ runs, wickets, legalBalls: legal, target }, fmt);
    const delta = after - before;          // + is good for the batting side

    if (out) {
      // The batter out takes the fall; the credit goes to those who did it.
      add(b.dismissed_id ?? b.striker_id, 'batting', delta * SCALE);
      const share = WICKET_SHARE[b.wicket_type!] ?? { bowler: 1, fielder: 0 };
      const q = quality(b.dismissed_id ?? b.striker_id);
      const gain = -delta * SCALE * q;
      add(b.bowler_id, 'bowling', gain * share.bowler);
      if (share.fielder > 0) add(b.fielder_id ?? b.bowler_id, 'fielding', gain * share.fielder);
      // Breaking a stand: a little extra for ending 25+ together.
      if (partnership >= 25) add(b.bowler_id, 'bowling', Math.min(1.5, (partnership / 25) * 0.4));
      partnership = 0;
    } else if (b.extra_type === 'b' || b.extra_type === 'lb') {
      // Byes are nobody's fault at the crease and nobody's credit either.
      partnership += r;
    } else if (b.extra_type === 'wd' || b.extra_type === 'nb') {
      // The bowler's cost; a no-ball's runs off the bat are still the batter's.
      add(b.bowler_id, 'bowling', -delta * SCALE);
      if (b.runs_off_bat > 0) add(b.striker_id, 'batting', delta * SCALE * (b.runs_off_bat / Math.max(r, 1)));
      partnership += r;
    } else {
      add(b.striker_id, 'batting', delta * SCALE);
      add(b.bowler_id, 'bowling', -delta * SCALE);
      partnership += r;
    }
  }

  // Pad-recorded fielding: a drop costs roughly the wicket it should have been,
  // a save is worth the runs it kept off. Both read at the moment they happened.
  for (const e of opts.fieldEvents ?? []) {
    if (e.kind === 'drop') add(e.fielder_id, 'fielding', -0.6);
    else if (e.kind === 'save') add(e.fielder_id, 'fielding', Math.min(1.2, (e.runs ?? 1) * 0.12));
  }

  const out = new Map<string, PlayerImpact>();
  for (const [id, v] of rows) {
    const total = +(v.batting + v.bowling + v.fielding).toFixed(2);
    out.set(id, {
      playerId: id,
      batting: +v.batting.toFixed(2),
      bowling: +v.bowling.toFixed(2),
      fielding: +v.fielding.toFixed(2),
      total,
      grade: gradeOf(total),
    });
  }
  return out;
}

/** Add two impact maps — two innings of a match, or matches across a season. */
export function mergeImpact(a: Map<string, PlayerImpact>, b: Map<string, PlayerImpact>): Map<string, PlayerImpact> {
  const out = new Map(a);
  for (const [id, v] of b) {
    const cur = out.get(id);
    if (!cur) { out.set(id, v); continue; }
    const total = +(cur.total + v.total).toFixed(2);
    out.set(id, {
      playerId: id,
      batting: +(cur.batting + v.batting).toFixed(2),
      bowling: +(cur.bowling + v.bowling).toFixed(2),
      fielding: +(cur.fielding + v.fielding).toFixed(2),
      total, grade: gradeOf(total),
    });
  }
  return out;
}

/** The balls that swung it — highest pressure, and what happened on them. */
export function keyMoments(curve: BallReading[], limit = 5) {
  return [...curve]
    .map(r => ({ ...r, swing: Math.abs(r.winProbAfter - r.winProb) }))
    .sort((a, b) => b.swing - a.swing)
    .slice(0, limit);
}

/** Recent dots and wickets from the balls so far, for pressureIndex. */
export function momentumOf(balls: EngineBall[]): Momentum {
  const ordered = [...balls].sort((a, b) => a.seq - b.seq);
  const legalRecent = ordered.filter(isLegal).slice(-12);
  return {
    recentDots: legalRecent.filter(b => b.runs_off_bat + b.extra_runs === 0 && !isDismissal(b)).length,
    recentLegal: legalRecent.length,
    recentWickets: ordered.slice(-18).filter(isDismissal).length,
  };
}

/** Band colours, shared by the gauge and the charts so they always agree. */
export const BAND_COLOR: Record<PressureBand, string> = {
  Calm: '#34d399', Light: '#a3e635', Moderate: '#fbbf24', High: '#fb923c', Extreme: '#f43f5e',
};
