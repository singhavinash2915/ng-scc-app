import {
  battingCard, bowlingCard, inningsState, formatOvers,
  type Ball, type MatchFormat,
} from './cricketRules';
import type { Member } from '../types';
import type {
  MatchScorecard, BatterRow, BowlerRow, InningsSummary, InningsExtras,
} from '../hooks/useMatchScorecard';

// ─── Balls → the scorecard shape the app already speaks ────────────────────────
// This is the whole reason in-app scoring is cheap to add. The CricHeroes sync
// writes `match_scorecards` rows in a fixed shape, and every feature downstream
// reads that shape: SCC Rankings, the MVP race, value-for-money, achievements,
// records, Match Centre, player profiles.
//
// So the scorer doesn't need any of them changed — it just has to produce the
// same thing. A scored match becomes indistinguishable from a synced one.

const DISMISSAL_TEXT: Record<string, string> = {
  bowled: 'b', caught: 'c', lbw: 'lbw b', run_out: 'run out',
  stumped: 'st', hit_wicket: 'hit wicket b', retired: 'retired',
};

/** "c Sharma b Khan", "b Khan", "run out (Sharma)" — the standard notation. */
function outText(
  wicket: string | null, bowler: string | null, fielder: string | null,
): string {
  if (!wicket) return 'not out';
  if (wicket === 'run_out') return fielder ? `run out (${fielder})` : 'run out';
  if (wicket === 'caught') return fielder ? `c ${fielder} b ${bowler ?? ''}`.trim() : `c & b ${bowler ?? ''}`.trim();
  if (wicket === 'stumped') return `st ${fielder ?? ''} b ${bowler ?? ''}`.trim();
  if (wicket === 'retired') return 'retired';
  return `${DISMISSAL_TEXT[wicket] ?? wicket} ${bowler ?? ''}`.trim();
}

export interface InningsInput {
  balls: Ball[];
  teamName: string;
  /** Batting order, so players who never faced a ball still appear as DNB. */
  battingOrder?: string[];
  target?: number | null;
}

function buildInnings(
  input: InningsInput,
  members: Member[],
  format: MatchFormat,
): {
  summary: InningsSummary;
  batting: BatterRow[];
  bowling: BowlerRow[];
  extras: InningsExtras;
} {
  const nameOf = (id: string | null) =>
    (id && members.find(m => m.id === id)?.name) || '';

  const st = inningsState(input.balls, format, input.target);
  const bat = battingCard(input.balls);
  const bowl = bowlingCard(input.balls);

  // Batting order = the order players first appear, then anyone listed who
  // never faced a ball (did not bat).
  const seen: string[] = [];
  for (const b of input.balls) {
    if (b.striker_id && !seen.includes(b.striker_id)) seen.push(b.striker_id);
    if (b.non_striker_id && !seen.includes(b.non_striker_id)) seen.push(b.non_striker_id);
  }
  const order = [...seen, ...(input.battingOrder ?? []).filter(id => !seen.includes(id))];

  const batting: BatterRow[] = order.map(id => {
    const l = bat.get(id);
    const runs = l?.runs ?? 0;
    const balls = l?.balls ?? 0;
    return {
      // player_id is CricHeroes' numeric id; we have UUIDs, so 0 marks
      // "scored in the app" and name-matching does the rest, exactly as the
      // rest of the app already resolves players from scorecards.
      player_id: 0,
      name: nameOf(id),
      runs, balls,
      minutes: 0,
      '4s': l?.fours ?? 0,
      '6s': l?.sixes ?? 0,
      SR: balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00',
      out_text: outText(l?.wicketType ?? null, nameOf(l?.bowlerId ?? null), nameOf(l?.fielderId ?? null)),
    } as BatterRow;
  });

  const bowling: BowlerRow[] = [...bowl.entries()]
    .filter(([id]) => id && id !== 'null')
    .map(([id, l]) => ({
      player_id: 0,
      name: nameOf(id),
      overs: Number(formatOvers(l.legalBalls)),
      balls: l.legalBalls,
      maidens: l.maidens,
      runs: l.runs,
      wickets: l.wickets,
      economy_rate: l.economy.toFixed(2),
      wides: l.wides,
      noballs: l.noBalls,
    } as BowlerRow));

  const summary: InningsSummary = {
    score: `${st.runs}/${st.wickets}`,
    over: st.overs,
    rr: st.runRate.toFixed(2),
    total_run: st.runs,
    total_wicket: st.wickets,
    total_extra: st.extras.total,
    overs_played: st.overs,
    is_allout: st.completeReason === 'allout' ? 1 : 0,
  };

  const extras: InningsExtras = {
    wide: st.extras.wd,
    noball: st.extras.nb,
    bye: st.extras.b,
    legbye: st.extras.lb,
    total: st.extras.total,
  } as InningsExtras;

  return { summary, batting, bowling, extras };
}

/**
 * Assemble both innings into a row that can be written straight to
 * `match_scorecards`. Returns the payload rather than saving it, so the caller
 * decides when a match is finished enough to publish.
 */
export function buildScorecard(
  matchId: string,
  first: InningsInput,
  second: InningsInput | null,
  members: Member[],
  format: MatchFormat,
): Partial<MatchScorecard> {
  const i1 = buildInnings(first, members, format);
  const i2 = second ? buildInnings(second, members, format) : null;

  return {
    match_id: matchId,
    // No CricHeroes id — this match was scored here. The sync uses ch_match_id
    // to reconcile, so leaving it null keeps the two sources from colliding.
    ch_match_id: null as unknown as string,
    innings1_team_id: null,
    innings1_team_name: first.teamName,
    innings1_summary: i1.summary,
    innings1_batting: i1.batting,
    innings1_bowling: i1.bowling,
    innings1_extras: i1.extras,
    innings2_team_id: null,
    innings2_team_name: second?.teamName ?? null,
    innings2_summary: i2?.summary ?? null,
    innings2_batting: i2?.batting ?? null,
    innings2_bowling: i2?.bowling ?? null,
    innings2_extras: i2?.extras ?? null,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * A plain-text over-by-over sheet for typing into CricHeroes afterwards.
 *
 * CricHeroes has no public write API, so the score can't be pushed across
 * automatically. This is the next best thing: everything needed to re-enter the
 * match in one screen, at home on wifi, with no clock running.
 */
export function cricHeroesSheet(
  first: InningsInput,
  second: InningsInput | null,
  members: Member[],
  format: MatchFormat,
): string {
  const nameOf = (id: string | null) =>
    (id && members.find(m => m.id === id)?.name) || '?';
  const lines: string[] = [];

  const innings = [first, second].filter(Boolean) as InningsInput[];
  innings.forEach((inn, idx) => {
    const st = inningsState(inn.balls, format, inn.target);
    const bat = battingCard(inn.balls);
    const bowl = bowlingCard(inn.balls);

    lines.push(`INNINGS ${idx + 1} — ${inn.teamName}`);
    lines.push(`${st.runs}/${st.wickets} in ${st.overs} overs  (RR ${st.runRate})`);
    lines.push('');
    lines.push('BATTING');
    for (const [id, l] of bat) {
      lines.push(
        `  ${nameOf(id).padEnd(24)} ${String(l.runs).padStart(3)} (${l.balls})  ` +
        `4s:${l.fours} 6s:${l.sixes}  ${outText(l.wicketType, nameOf(l.bowlerId), nameOf(l.fielderId))}`,
      );
    }
    lines.push('');
    lines.push('BOWLING');
    for (const [id, l] of bowl) {
      if (!id || id === 'null') continue;
      lines.push(
        `  ${nameOf(id).padEnd(24)} ${l.overs}-${l.maidens}-${l.runs}-${l.wickets}  ` +
        `econ ${l.economy}${l.wides ? `  wd:${l.wides}` : ''}${l.noBalls ? `  nb:${l.noBalls}` : ''}`,
      );
    }
    lines.push('');
    lines.push(`EXTRAS  wd:${st.extras.wd}  nb:${st.extras.nb}  b:${st.extras.b}  lb:${st.extras.lb}  (${st.extras.total})`);
    lines.push('');

    // Over-by-over, which is how CricHeroes wants it entered ball by ball.
    lines.push('OVER BY OVER');
    const overs = new Map<number, Ball[]>();
    for (const b of inn.balls) {
      if (!overs.has(b.over_no)) overs.set(b.over_no, []);
      overs.get(b.over_no)!.push(b);
    }
    for (const [ov, group] of [...overs.entries()].sort((a, b) => a[0] - b[0])) {
      const marks = group.map(b => {
        if (b.wicket_type && b.wicket_type !== 'retired') return 'W';
        if (b.extra_type === 'wd') return `wd${b.extra_runs > 1 ? b.extra_runs - 1 : ''}`;
        if (b.extra_type === 'nb') return `nb${b.runs_off_bat || ''}`;
        if (b.extra_type === 'b') return `${b.extra_runs}b`;
        if (b.extra_type === 'lb') return `${b.extra_runs}lb`;
        return String(b.runs_off_bat);
      });
      const conceded = group.reduce((n, b) => n + b.runs_off_bat + b.extra_runs, 0);
      lines.push(`  Ov ${String(ov + 1).padStart(2)}  ${marks.join(' ').padEnd(28)} = ${conceded}  (${nameOf(group[0]?.bowler_id ?? null)})`);
    }
    lines.push('');
    lines.push('─'.repeat(56));
    lines.push('');
  });

  return lines.join('\n');
}
