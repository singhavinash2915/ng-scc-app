import type { Ball } from './cricketRules';

// ─── Challenge metrics ────────────────────────────────────────────────────────
// Two families, and the split matters:
//
//   SCORECARD metrics work off match_scorecards, so they resolve for every
//   match including the CricHeroes-synced ones. These are what CricHeroes
//   itself offers — runs, wickets, boundaries.
//
//   BALL metrics need scc_ball_by_ball, i.e. a match scored in our app. These
//   are the ones CricHeroes structurally cannot do for club cricket: death
//   economy, dot percentage, strike rate in a chase. They're the reason a
//   member might want a match scored here rather than there.
//
// Nothing here stores a result. A challenge is always recomputed from match
// data, so a corrected scorecard corrects the challenge — the leaderboard and
// the challenge can never disagree.

export type Metric =
  | 'runs' | 'wickets' | 'fours' | 'sixes' | 'fifties' | 'catches'
  | 'strike_rate' | 'economy'
  | 'death_economy' | 'dot_percent' | 'chase_strike_rate' | 'partnership';

export interface MetricDef {
  key: Metric;
  label: string;
  /** Shown under the label when picking — says what actually counts. */
  hint: string;
  /** Lower is better (economy, dots conceded). Affects who's winning. */
  lowerWins?: boolean;
  /** Needs ball-by-ball, so only app-scored matches count towards it. */
  needsBalls?: boolean;
  unit?: string;
}

export const METRICS: MetricDef[] = [
  { key: 'runs',    label: 'Most runs',    hint: 'Runs off the bat' },
  { key: 'wickets', label: 'Most wickets', hint: 'Run-outs excluded, as always' },
  { key: 'fours',   label: 'Most fours',   hint: 'Boundaries off the bat' },
  { key: 'sixes',   label: 'Most sixes',   hint: 'The one everybody wants' },
  { key: 'fifties', label: 'Most fifties', hint: 'Scores of 50 or more' },
  { key: 'catches', label: 'Most catches', hint: 'Fielding, which usually goes unnoticed' },
  { key: 'strike_rate', label: 'Best strike rate', hint: 'Minimum 30 balls, so one big over can’t win it' },
  { key: 'economy', label: 'Best economy', hint: 'Minimum 4 overs', lowerWins: true },

  // ── App-scored only ────────────────────────────────────────────────────────
  { key: 'death_economy', label: 'Death-over economy', hint: 'Last 4 overs only — where matches are lost', lowerWins: true, needsBalls: true },
  { key: 'dot_percent', label: 'Most dot balls', hint: 'Percentage of deliveries with no run', unit: '%', needsBalls: true },
  { key: 'chase_strike_rate', label: 'Strike rate in a chase', hint: 'Second innings only — runs under pressure', needsBalls: true },
  { key: 'partnership', label: 'Best partnership', hint: 'Runs added while you were both at the crease', needsBalls: true },
];

export type Category = 'batting' | 'bowling' | 'fielding';

export const CATEGORY: Record<Category, { label: string; emoji: string; metrics: Metric[] }> = {
  batting:  { label: 'Batting',  emoji: '🏏', metrics: ['runs', 'fours', 'sixes', 'fifties', 'strike_rate', 'chase_strike_rate', 'partnership'] },
  bowling:  { label: 'Bowling',  emoji: '⚡', metrics: ['wickets', 'economy', 'death_economy', 'dot_percent'] },
  fielding: { label: 'Fielding', emoji: '🧤', metrics: ['catches'] },
};

export const metricDef = (m: Metric) => METRICS.find(x => x.key === m) ?? METRICS[0];

/** A player's standing in one challenge. */
export interface Standing {
  memberId: string;
  value: number;
  /** Enough data to count? Strike rate off 4 balls is not a strike rate. */
  qualified: boolean;
  detail: string;
}

export interface ScorecardRow {
  member_id: string;
  batting_runs: number;
  batting_balls?: number;
  batting_fours?: number;
  batting_sixes?: number;
  batting_fifties?: number;
  bowling_wickets: number;
  bowling_runs_conceded?: number;
  bowling_balls?: number;
  fielding_catches?: number;
}

/** Scorecard-family metrics — work for every match, synced or app-scored. */
export function standingFromScorecards(
  metric: Metric, rows: ScorecardRow[],
): Standing[] {
  const by = new Map<string, ScorecardRow[]>();
  for (const r of rows) {
    if (!by.has(r.member_id)) by.set(r.member_id, []);
    by.get(r.member_id)!.push(r);
  }

  // "1 wkts" undermines every careful thing on the card. Same trap as the
  // suggestion pitches, one layer down.
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

  const out: Standing[] = [];
  for (const [memberId, rs] of by) {
    const sum = (f: (r: ScorecardRow) => number) => rs.reduce((s, r) => s + (f(r) || 0), 0);
    let value = 0, qualified = true, detail = '';

    switch (metric) {
      case 'runs':    value = sum(r => r.batting_runs); detail = n(value, 'run', 'runs'); break;
      case 'wickets': value = sum(r => r.bowling_wickets); detail = n(value, 'wkt', 'wkts'); break;
      case 'fours':   value = sum(r => r.batting_fours ?? 0); detail = n(value, 'four', 'fours'); break;
      case 'sixes':   value = sum(r => r.batting_sixes ?? 0); detail = n(value, 'six', 'sixes'); break;
      case 'fifties': value = sum(r => r.batting_fifties ?? 0); detail = n(value, 'fifty', 'fifties'); break;
      case 'catches': value = sum(r => r.fielding_catches ?? 0); detail = n(value, 'catch', 'catches'); break;
      case 'strike_rate': {
        const runs = sum(r => r.batting_runs), balls = sum(r => r.batting_balls ?? 0);
        // A strike rate off a handful of balls is noise, not form.
        qualified = balls >= 30;
        value = balls ? (runs / balls) * 100 : 0;
        detail = qualified ? `${value.toFixed(0)} SR (${runs} off ${balls})` : `${balls}/30 balls`;
        break;
      }
      case 'economy': {
        const conceded = sum(r => r.bowling_runs_conceded ?? 0), balls = sum(r => r.bowling_balls ?? 0);
        qualified = balls >= 24;
        value = balls ? (conceded / balls) * 6 : 0;
        detail = qualified ? `${value.toFixed(1)} econ` : `${(balls / 6).toFixed(1)}/4 overs`;
        break;
      }
      default: qualified = false; detail = 'needs app-scored matches';
    }
    out.push({ memberId, value, qualified, detail });
  }
  return rank(metric, out);
}

/** Ball-family metrics — only matches scored in the app carry these. */
export function standingFromBalls(metric: Metric, balls: Ball[], memberIds: string[]): Standing[] {
  const legal = (b: Ball) => b.extra_type !== 'wd' && b.extra_type !== 'nb';
  const out: Standing[] = memberIds.map(memberId => {
    let value = 0, qualified = false, detail = 'no data yet';

    if (metric === 'death_economy') {
      // Last 4 overs of an innings — where club matches are actually lost.
      const mine = balls.filter(b => b.bowler_id === memberId && b.over_no >= 12);
      const bs = mine.filter(legal).length;
      const runs = mine.reduce((s, b) => s + b.runs_off_bat + b.extra_runs, 0);
      qualified = bs >= 12;
      value = bs ? (runs / bs) * 6 : 0;
      detail = qualified ? `${value.toFixed(1)} econ at the death` : `${bs}/12 balls`;
    }

    if (metric === 'dot_percent') {
      const mine = balls.filter(b => b.bowler_id === memberId && legal(b));
      const dots = mine.filter(b => b.runs_off_bat === 0 && b.extra_runs === 0).length;
      qualified = mine.length >= 18;
      value = mine.length ? (dots / mine.length) * 100 : 0;
      detail = qualified ? `${value.toFixed(0)}% dots (${dots}/${mine.length})` : `${mine.length}/18 balls`;
    }

    if (metric === 'chase_strike_rate') {
      // Caller passes second-innings balls only; runs under a required rate
      // are a different thing from runs in a free hit at a total.
      const faced = balls.filter(b => b.striker_id === memberId && legal(b));
      const runs = faced.reduce((s, b) => s + b.runs_off_bat, 0);
      qualified = faced.length >= 15;
      value = faced.length ? (runs / faced.length) * 100 : 0;
      detail = qualified ? `${value.toFixed(0)} SR chasing` : `${faced.length}/15 balls`;
    }

    if (metric === 'partnership') {
      // Runs added while this member was at EITHER end — a partnership is a
      // shared thing, so both batters get credit for it.
      const together = balls.filter(b => b.striker_id === memberId || b.non_striker_id === memberId);
      value = together.reduce((s, b) => s + b.runs_off_bat + b.extra_runs, 0);
      qualified = together.length > 0;
      detail = `${value} added at the crease`;
    }

    return { memberId, value, qualified, detail };
  });
  return rank(metric, out);
}

/** Unqualified players sink to the bottom whichever way the metric runs. */
function rank(metric: Metric, rows: Standing[]): Standing[] {
  const lower = metricDef(metric).lowerWins;
  return rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return lower ? a.value - b.value : b.value - a.value;
  });
}

/** Title for a challenge nobody bothered to name. */
export function autoTitle(metric: Metric, names: string[]): string {
  const def = metricDef(metric);
  if (names.length === 2) return `${names[0]} v ${names[1]} — ${def.label.toLowerCase()}`;
  return `${def.label} — ${names.length} players`;
}

// ─── Suggested challenges ─────────────────────────────────────────────────────
// The reason ours can be easier than CricHeroes'. Theirs opens a form because
// it cannot know who you'd want to play; ours does — it has everyone's season
// in front of it. A rivalry the app spotted and phrased for you is one tap.
//
// Only genuinely close gaps are offered. "You're 400 runs behind Shaan" is not
// a challenge, it's a discouragement, and suggesting it once teaches people to
// ignore the whole feature.

export interface Suggestion {
  metric: Metric;
  opponentId: string;
  /** The line shown on the card — written to be tapped, not read. */
  pitch: string;
  gap: number;
}

export interface SeasonLine {
  memberId: string;
  runs: number;
  wickets: number;
  catches: number;
  matches: number;
}

/**
 * Rivalries worth offering, closest first. A gap counts as close when it's
 * small in absolute terms AND small relative to the leader — 5 runs apart on
 * 20 runs each is a real race; 5 apart on 900 is a rounding error.
 */
export function suggestChallenges(me: SeasonLine, others: SeasonLine[], limit = 3): Suggestion[] {
  const out: Suggestion[] = [];

  const consider = (metric: Metric, mine: number, theirs: number, id: string, plural: string) => {
    // "1 wickets ahead" undermines every careful thing on the card.
    const noun = (n: number) => (n === 1 ? plural.replace(/e?s$/, m => (m === 'es' ? '' : '')) : plural);
    const gap = Math.abs(mine - theirs);
    const top = Math.max(mine, theirs);
    if (top < 5) return;                       // too early in the season to matter
    if (gap > top * 0.25 && gap > 15) return;  // not actually close
    const behind = mine < theirs;
    out.push({
      metric, opponentId: id, gap,
      pitch: gap === 0
        ? `You're level on ${plural}. Settle it.`
        : behind
          ? `They're ${gap} ${noun(gap)} ahead of you this season.`
          : `You're ${gap} ${noun(gap)} ahead — can you hold it?`,
    });
  };

  for (const o of others) {
    if (o.memberId === me.memberId || o.matches < 3) continue;
    consider('runs', me.runs, o.runs, o.memberId, 'runs');
    consider('wickets', me.wickets, o.wickets, o.memberId, 'wickets');
    consider('catches', me.catches, o.catches, o.memberId, 'catches');
  }

  // Closest race first, and never two suggestions against the same person —
  // a list of "you v Rohan" three times reads as a broken app.
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.gap - b.gap)
    .filter(s => (seen.has(s.opponentId) ? false : (seen.add(s.opponentId), true)))
    .slice(0, limit);
}

// ─── Target challenges ────────────────────────────────────────────────────────
// "Four sixes in a match." Different from everything above: not a season total
// but a SINGLE-MATCH feat, and the first person to do it wins outright.
//
// Resolving it needs per-match rows, and CricHeroes gives those keyed by its
// own player_id and a name — there is no member id in a synced scorecard. So
// names have to be matched, which is the exact thing that once inflated a
// player's stats when two Adityas were conflated.
//
// Hence the deliberate omission below: this port of the sync's matcher stops
// after the unambiguous tiers and has NO fuzzy fallback. A challenge can carry
// a stake, and crediting the wrong Aditya with winning someone's chai is worse
// than crediting nobody. Ambiguous means unresolved, and unresolved means the
// challenge simply stays open.

const norm = (s: string) =>
  s.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface NameMatcher { (raw: string): string | null }

/** Build a scorecard-name → member-id resolver. Unambiguous matches only. */
export function buildMatcher(members: Array<{ id: string; name: string }>): NameMatcher {
  const names = new Map(members.map(m => [m.id, norm(m.name)]));
  const toks = new Map(members.map(m => [m.id, new Set(norm(m.name).split(' ').filter(Boolean))]));

  return (raw: string) => {
    const n = norm(raw);
    if (!n) return null;
    const t = new Set(n.split(' ').filter(Boolean));

    // 1. Exact.
    for (const [id, nm] of names) if (nm === n) return id;

    // 2. Member's full name sits inside the scorecard name — "Shaan" in
    //    "Shaan Shaikh". Most specific wins.
    const contained = [...toks.entries()]
      .filter(([, mt]) => mt.size > 0 && [...mt].every(x => t.has(x)))
      .map(([id]) => id);
    if (contained.length) {
      return contained.reduce((a, b) => (toks.get(a)!.size >= toks.get(b)!.size ? a : b));
    }

    // 3. Scorecard name is a subset of exactly ONE member — "Raushan" →
    //    "Raushan Kumar". More than one match is the two-Adityas case, and we
    //    stop rather than guess.
    const supersets = [...toks.entries()]
      .filter(([, mt]) => [...t].every(x => mt.has(x)))
      .map(([id]) => id);
    return supersets.length === 1 ? supersets[0] : null;
  };
}

export interface MatchFeat {
  memberId: string;
  matchId: string;
  value: number;
}

/**
 * Best single-match figure per player for a target metric, plus whether they
 * hit the target and when. Only the metrics that make sense as a one-match
 * feat are supported — "best economy in a match" is a season stat wearing a
 * disguise.
 */
// Catches are absent from the synced innings JSON, so a "3 catches in a match"
// target could never resolve. Offering a contest that can't be won is worse
// than not offering it.
export const TARGET_METRICS: Metric[] = ['runs', 'wickets', 'fours', 'sixes'];

export interface ScorecardMatchRow {
  matchId: string;
  /** Raw scorecard name, matched to a member by buildMatcher. */
  name: string;
  runs: number; wickets: number; fours: number; sixes: number; catches: number;
}

export interface TargetStanding {
  memberId: string;
  best: number;
  hit: boolean;
  matchId: string | null;
  detail: string;
}

export function standingFromTarget(
  metric: Metric, target: number,
  rows: ScorecardMatchRow[], match: NameMatcher, memberIds: string[],
  /** When set, only this fixture counts — the contest is about that Sunday. */
  onlyMatchId?: string | null,
): TargetStanding[] {
  const want = new Set(memberIds);
  if (onlyMatchId) rows = rows.filter(r => r.matchId === onlyMatchId);
  const best = new Map<string, { v: number; matchId: string }>();

  for (const r of rows) {
    const id = match(r.name);
    if (!id || !want.has(id)) continue;
    const v = (r as unknown as Record<string, number>)[metric] ?? 0;
    const cur = best.get(id);
    if (!cur || v > cur.v) best.set(id, { v, matchId: r.matchId });
  }

  // Stripping a trailing "s" gives "sixe" and "catche". Spelled out instead —
  // English plurals are not a regex.
  const UNIT: Partial<Record<Metric, [string, string]>> = {
    runs: ['run', 'runs'], wickets: ['wkt', 'wkts'],
    fours: ['four', 'fours'], sixes: ['six', 'sixes'],
    catches: ['catch', 'catches'],
  };
  const [one, many] = UNIT[metric] ?? ['', ''];
  return memberIds.map(memberId => {
    const b = best.get(memberId);
    const v = b?.v ?? 0;
    const hit = v >= target;
    return {
      memberId, best: v, hit,
      matchId: hit ? (b?.matchId ?? null) : null,
      detail: hit
        ? `Done it — ${v} in a match`
        : `Best so far ${v} ${v === 1 ? one : many}`,
    };
  }).sort((a, b) => (a.hit !== b.hit ? (a.hit ? -1 : 1) : b.best - a.best));
}
