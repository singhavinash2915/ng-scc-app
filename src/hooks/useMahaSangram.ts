import { useMemo } from 'react';
import type { Match, Member, InternalTeam } from '../types';
import type { MatchScorecard, BatterRow, BowlerRow } from './useMatchScorecard';

// ─── SCC MahaSangram — the competition, scored ─────────────────────────────────
// Brahmos vs Agni is a series, not a set of friendlies, so it needs the three
// things any competition needs: a table, a series score, and an MVP race.
//
// Everything is derived from data the app already has — internal fixtures and
// their scorecards — so nothing here needs its own table or admin screen. The
// only thing it depends on is `winning_team` being allowed to hold 'brahmos' or
// 'agni', which is add_mahasangram_teams.sql.

export const MAHA_SIDES: [InternalTeam, InternalTeam] = ['brahmos', 'agni'];

/** Is this fixture part of MahaSangram (as opposed to the older rivalry)? */
export function isMahaSangram(m: Pick<Match, 'match_type' | 'opponent'>): boolean {
  return m.match_type === 'internal' && /brahmos|agni/i.test(m.opponent ?? '');
}

export interface SideStanding {
  side: InternalTeam;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;          // 2 a win, 1 a no-result
  /** Most recent first: 'W' | 'L' | '-' */
  form: Array<'W' | 'L' | '-'>;
}

export interface MvpRow {
  member: Member;
  side: InternalTeam | null;
  runs: number;
  wickets: number;
  dismissals: number;
  matches: number;
  /** Runs + 20 a wicket + 10 a dismissal — bat and ball weighted to matter equally. */
  points: number;
}

export interface ValueRow extends MvpRow {
  /** What the auction paid, in ₹ lakh. Captains are their retention price. */
  price: number;
  /** MVP points per ₹ crore spent — the whole point of the index. */
  perCrore: number;
  /** Ratio against the squad average, so 2.0 = twice the going rate. */
  vsAverage: number;
}

export interface MahaSangram {
  fixtures: Match[];
  played: number;
  upcoming: number;
  standings: [SideStanding, SideStanding];
  /** The side ahead on points, or null when they're level. */
  leader: InternalTeam | null;
  seriesScore: string;     // "2–1"
  mvps: MvpRow[];
  /**
   * Value for money. Only meaningful once matches have been played, so it's
   * empty until then rather than ranking everyone at zero.
   */
  value: ValueRow[];
}

const emptyStanding = (side: InternalTeam): SideStanding => ({
  side, played: 0, won: 0, lost: 0, noResult: 0, points: 0, form: [],
});

/** Which side a scorecard innings belongs to. */
function sideOfInnings(teamName: string | null): InternalTeam | null {
  const n = (teamName || '').toLowerCase();
  if (n.includes('brahmos')) return 'brahmos';
  if (n.includes('agni')) return 'agni';
  return null;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function useMahaSangram(
  matches: Match[],
  members: Member[],
  scorecards: MatchScorecard[] | null,
  /** memberId → auction price in ₹ lakh. Omit and the value index stays empty. */
  priceOf?: Record<string, number>,
): MahaSangram {
  return useMemo(() => {
    const fixtures = matches
      .filter(isMahaSangram)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const decided = fixtures.filter(f => f.result !== 'upcoming');

    // ── Table ────────────────────────────────────────────────────────────
    const table: Record<InternalTeam, SideStanding> = {
      brahmos: emptyStanding('brahmos'),
      agni: emptyStanding('agni'),
      dhurandars: emptyStanding('dhurandars'),
      bazigars: emptyStanding('bazigars'),
    };

    for (const f of decided) {
      const winner = f.winning_team as InternalTeam | null;
      for (const side of MAHA_SIDES) {
        const row = table[side];
        row.played += 1;
        if (!winner) {
          // Played but nobody recorded as winning — a tie or an unrecorded result.
          row.noResult += 1;
          row.points += 1;
          row.form.push('-');
        } else if (winner === side) {
          row.won += 1;
          row.points += 2;
          row.form.push('W');
        } else {
          row.lost += 1;
          row.form.push('L');
        }
      }
    }
    for (const side of MAHA_SIDES) table[side].form = table[side].form.slice(0, 5);

    const [a, b] = [table[MAHA_SIDES[0]], table[MAHA_SIDES[1]]];
    const leader = a.points === b.points ? null : (a.points > b.points ? a.side : b.side);

    // ── MVP race ─────────────────────────────────────────────────────────
    // Name-matched off the scorecards, the same way the rest of the app does it.
    const byName = new Map<string, Member>();
    members.forEach(m => byName.set(normalise(m.name), m));
    const resolve = (name: string | null | undefined): Member | undefined => {
      if (!name) return undefined;
      const k = normalise(name);
      return byName.get(k) ?? members.find(m => normalise(m.name).includes(k) || k.includes(normalise(m.name)));
    };

    const tally = new Map<string, MvpRow>();
    const bump = (name: string | null, side: InternalTeam | null,
                  add: Partial<Pick<MvpRow, 'runs' | 'wickets' | 'dismissals'>>) => {
      const member = resolve(name);
      if (!member) return;
      const row = tally.get(member.id) ?? {
        member, side, runs: 0, wickets: 0, dismissals: 0, matches: 0, points: 0,
      };
      row.runs += add.runs ?? 0;
      row.wickets += add.wickets ?? 0;
      row.dismissals += add.dismissals ?? 0;
      if (side && !row.side) row.side = side;
      tally.set(member.id, row);
    };

    const fixtureIds = new Set(decided.map(f => f.id));
    const cards = (scorecards ?? []).filter(sc => fixtureIds.has(sc.match_id));
    const seen = new Map<string, Set<string>>();   // memberId → matchIds

    for (const sc of cards) {
      const innings: Array<[InternalTeam | null, BatterRow[] | null, BowlerRow[] | null]> = [
        [sideOfInnings(sc.innings1_team_name), sc.innings1_batting, sc.innings2_bowling],
        [sideOfInnings(sc.innings2_team_name), sc.innings2_batting, sc.innings1_bowling],
      ];
      for (const [side, batting, bowlingAgainst] of innings) {
        (batting ?? []).forEach(bt => {
          bump(bt.name, side, { runs: bt.runs || 0 });
          const m = resolve(bt.name);
          if (m) {
            if (!seen.has(m.id)) seen.set(m.id, new Set());
            seen.get(m.id)!.add(sc.match_id);
          }
        });
        // Bowlers in the OTHER innings belong to this side.
        (bowlingAgainst ?? []).forEach(bw => {
          bump(bw.name, side, { wickets: bw.wickets || 0 });
          const m = resolve(bw.name);
          if (m) {
            if (!seen.has(m.id)) seen.set(m.id, new Set());
            seen.get(m.id)!.add(sc.match_id);
          }
        });
      }
    }

    const mvps = [...tally.values()]
      .map(r => ({
        ...r,
        matches: seen.get(r.member.id)?.size ?? 0,
        points: r.runs + r.wickets * 20 + r.dismissals * 10,
      }))
      .filter(r => r.points > 0)
      .sort((x, y) => y.points - x.points || y.runs - x.runs);

    /**
     * Value for money: MVP points per ₹ crore paid at auction. The argument the
     * auction format exists to create — a ₹20 L player outscoring a ₹5 Cr one
     * per rupee is the story, and next year's captains get to bid with the
     * receipts in front of them.
     */
    const priced = mvps
      .map(r => {
        const price = priceOf?.[r.member.id] ?? 0;
        return { ...r, price, perCrore: price > 0 ? r.points / (price / 100) : 0, vsAverage: 0 };
      })
      .filter(r => r.price > 0);
    const avgPerCrore = priced.length
      ? priced.reduce((n, r) => n + r.perCrore, 0) / priced.length
      : 0;
    const value = priced
      .map(r => ({ ...r, vsAverage: avgPerCrore > 0 ? r.perCrore / avgPerCrore : 0 }))
      .sort((x, y) => y.perCrore - x.perCrore);

    return {
      fixtures,
      played: decided.length,
      upcoming: fixtures.length - decided.length,
      standings: [a, b],
      leader,
      seriesScore: `${a.won}–${b.won}`,
      mvps,
      value,
    };
  }, [matches, members, scorecards, priceOf]);
}
