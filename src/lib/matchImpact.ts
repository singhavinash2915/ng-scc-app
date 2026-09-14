import {
  pressureCurve, inningsImpact, mergeImpact, keyMoments,
  type EngineBall, type Format, type BallReading, type PlayerImpact,
} from './pressure';
import { isOppositionId } from './opposition';

// ─── One match, through the pressure engine ───────────────────────────────────
// Everything the Impact tab shows, from the rows the pad stores. Pure, so the
// season tables can run it over every app-scored match without a second copy.
//
// Only app-scored matches have real deliveries. CricHeroes' ball-by-ball feed is
// synthetic commentary with no wickets in it, and an impact score built on that
// would be confidently wrong — so those matches simply have no impact.

export interface InningsRow { innings: number; batting_team: string; target: number | null }
export interface FieldEvent { innings: number; seq: number | null; kind: 'drop' | 'save'; fielder_id: string; runs: number }
export type StoredBall = EngineBall & { innings: number };

export interface InningsImpact {
  innings: number;
  battingKey: string;
  curve: BallReading[];
  moments: Array<BallReading & { swing: number; ball: EngineBall }>;
  peak: BallReading | null;
}

export interface MatchImpact {
  innings: InningsImpact[];
  players: PlayerImpact[];
  /** Side key ('home' / 'away') each player appeared for. */
  sideOf: Record<string, string>;
}

export function computeMatchImpact(
  rows: InningsRow[], balls: StoredBall[], fmt: Format,
  events: FieldEvent[] = [], battingAverage?: Record<string, number>, clubAverage?: number,
): MatchImpact {
  const sideOf: Record<string, string> = {};
  const out: InningsImpact[] = [];
  let total = new Map<string, PlayerImpact>();

  for (const r of [...rows].sort((a, b) => a.innings - b.innings)) {
    const ib = balls.filter(b => b.innings === r.innings).sort((a, b) => a.seq - b.seq);
    if (!ib.length) continue;
    const bowlingKey = r.batting_team === 'home' ? 'away' : 'home';
    for (const b of ib) {
      for (const id of [b.striker_id, b.non_striker_id]) if (id) sideOf[id] ??= r.batting_team;
      for (const id of [b.bowler_id, b.fielder_id]) if (id) sideOf[id] ??= bowlingKey;
    }

    const target = r.innings === 2 ? r.target : null;
    const curve = pressureCurve(ib, fmt, target);
    const bySeq = new Map(ib.map(b => [b.seq, b]));
    const moments = keyMoments(curve, 6).map(m => ({ ...m, ball: bySeq.get(m.seq)! }));
    const peak = curve.reduce<BallReading | null>((p, c) => (!p || c.index > p.index ? c : p), null);

    const imp = inningsImpact(ib, fmt, target, {
      battingAverage, clubAverage,
      fieldEvents: events.filter(e => e.innings === r.innings)
        .map(e => ({ seq: e.seq ?? 0, kind: e.kind, fielder_id: e.fielder_id, runs: e.runs })),
    });
    for (const e of events) if (e.innings === r.innings) sideOf[e.fielder_id] ??= bowlingKey;
    total = mergeImpact(total, imp);
    out.push({ innings: r.innings, battingKey: r.batting_team, curve, moments, peak });
  }

  return {
    innings: out,
    players: [...total.values()].sort((a, b) => b.total - a.total),
    sideOf,
  };
}

/** Only club players (members and guests) belong in club tables. */
export const isClubPlayer = (id: string) => !isOppositionId(id);
