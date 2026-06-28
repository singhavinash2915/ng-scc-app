import { useMemo } from 'react';
import type { Member, MemberCricketStats } from '../types';
import { useCricketStats } from './useCricketStats';
import { useMembers } from './useMembers';
import { useMatches } from './useMatches';
import { useMOMCounts } from './useMOMCounts';
import { useFantasyPoints } from './useFantasyPoints';
import { outfieldDismissals, keeperDismissals, hasKept } from '../utils/fielding';

export interface XIPlayer {
  member: Member;
  role: 'batter' | 'all-rounder' | 'bowler' | 'keeper';
  isCaptain: boolean;
  isVice: boolean;
  line: string;            // headline stat line
}

export interface Award {
  key: string;
  title: string;
  emoji: string;
  member: Member | null;
  value: string;
  blurb: string;
}

export interface ReportCard {
  member: Member;
  batting: string; bowling: string; fielding: string; impact: string; overall: string;
  note: string;
}

export interface ClubWrapped {
  season: string;
  played: number; won: number; lost: number; nr: number; winPct: number;
  biggestWin: string | null;
  highestTotal: string | null;
  topScorer: { name: string; runs: number } | null;
  topWicket: { name: string; wkts: number } | null;
  mostMom: { name: string; count: number } | null;
  elClasico: { dhur: number; baz: number; verdict: string } | null;
  mvp: { name: string; points: number } | null;
}

export interface SeasonFinale {
  bestXI: XIPlayer[];
  awards: Award[];
  reportCards: ReportCard[];
  clubWrapped: ClubWrapped;
}

const num = (s: string | null | undefined): number | null => {
  if (!s) return null; const m = s.match(/(\d+)/); return m ? parseInt(m[1], 10) : null;
};
const dismissals = (s: MemberCricketStats) => s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs;

// Percentile of a value within a sorted-desc list of values → grade.
function grade(value: number, all: number[]): string {
  const sorted = [...all].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0 || value <= 0) return 'C';
  const below = sorted.filter(v => v < value).length;
  const pct = (below / sorted.length) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B+';
  if (pct >= 40) return 'B';
  if (pct >= 20) return 'C+';
  return 'C';
}

export function useSeasonFinale(season = '2025-26', prevSeason = '2024-25'): SeasonFinale {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats } = useCricketStats(season);
  const { stats: prevStats } = useCricketStats(prevSeason);
  const { counts: momCounts } = useMOMCounts();
  const fantasy = useFantasyPoints(stats, members, momCounts);

  return useMemo(() => {
    const memberById: Record<string, Member> = {};
    members.forEach(m => { memberById[m.id] = m; });
    const withMember = stats.filter(s => memberById[s.member_id]);
    const mOf = (id: string) => memberById[id] || null;
    const fanTotal: Record<string, number> = {};
    fantasy.forEach(f => { fanTotal[f.member.id] = f.total; });

    // ── Best XI ───────────────────────────────────────────────────────────────
    const ranked = [...fantasy].filter(f => (f.stats.batting_matches || 0) >= 1);
    const keeperStat = [...withMember]
      .filter(s => s.fielding_stumpings > 0)
      .sort((a, b) => b.fielding_stumpings - a.fielding_stumpings)[0];
    const keeperId = keeperStat?.member_id;

    const top = ranked.slice(0, 11);
    const bestXI: XIPlayer[] = top.map((f, i) => {
      const s = f.stats;
      const isKeeper = s.member_id === keeperId;
      let role: XIPlayer['role'];
      if (isKeeper) role = 'keeper';
      else if (s.batting_runs >= 150 && s.bowling_wickets >= 8) role = 'all-rounder';
      else if (s.bowling_wickets * 22 > s.batting_runs) role = 'bowler';
      else role = 'batter';
      const line = role === 'bowler'
        ? `${s.bowling_wickets} wkts · econ ${s.bowling_economy?.toFixed(1) ?? '—'}`
        : role === 'all-rounder'
          ? `${s.batting_runs} runs · ${s.bowling_wickets} wkts`
          : `${s.batting_runs} runs · HS ${s.batting_highest_score}`;
      return { member: f.member, role, isCaptain: i === 0, isVice: i === 1, line };
    });
    // sort XI by role for display: keeper, batters, all-rounders, bowlers
    const roleOrder = { keeper: 0, batter: 1, 'all-rounder': 2, bowler: 3 };
    bestXI.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    // ── Awards ──────────────────────────────────────────────────────────────
    const maxBy = (fn: (s: MemberCricketStats) => number, minMatches = 1) =>
      [...withMember].filter(s => (s.batting_matches || 0) >= minMatches).sort((a, b) => fn(b) - fn(a))[0];

    const bestBat = maxBy(s => s.batting_runs);
    const bestBowl = maxBy(s => s.bowling_wickets);
    // Best Fielder = outfield catches + run-outs (keepers included fairly).
    const bestField = [...withMember]
      .filter(s => (s.batting_matches || 0) >= 1)
      .sort((a, b) => outfieldDismissals(b) - outfieldDismissals(a))[0];
    const bestKeeper = withMember.filter(hasKept)
      .sort((a, b) => keeperDismissals(b) - keeperDismissals(a))[0];
    const mvpF = fantasy[0];
    const sixMachine = maxBy(s => s.batting_sixes);
    const reliable = [...withMember].filter(s => (s.batting_innings || 0) >= 5)
      .sort((a, b) => (b.batting_average || 0) - (a.batting_average || 0))[0];
    // most improved — biggest fantasy jump vs last season
    const prevById: Record<string, MemberCricketStats> = {};
    prevStats.forEach(p => { prevById[p.member_id] = p; });
    const improved = [...withMember].map(s => {
      const prev = prevById[s.member_id];
      const prevPts = prev ? prev.batting_runs + prev.bowling_wickets * 20 : 0;
      const nowPts = s.batting_runs + s.bowling_wickets * 20;
      return { s, delta: nowPts - prevPts };
    }).filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta)[0];

    const awards: Award[] = [
      { key: 'mvp', title: 'Player of the Season', emoji: '👑', member: mvpF?.member ?? null, value: mvpF ? `${Math.round(mvpF.total).toLocaleString('en-IN')} pts` : '—', blurb: 'Most valuable across bat, ball & field' },
      { key: 'bat', title: 'Best Batter', emoji: '🏏', member: bestBat ? mOf(bestBat.member_id) : null, value: bestBat ? `${bestBat.batting_runs} runs` : '—', blurb: bestBat ? `HS ${bestBat.batting_highest_score} · avg ${bestBat.batting_average?.toFixed(1)}` : '' },
      { key: 'bowl', title: 'Best Bowler', emoji: '🎯', member: bestBowl ? mOf(bestBowl.member_id) : null, value: bestBowl ? `${bestBowl.bowling_wickets} wkts` : '—', blurb: bestBowl ? `best ${bestBowl.bowling_best_figures} · econ ${bestBowl.bowling_economy?.toFixed(1)}` : '' },
      { key: 'field', title: 'Best Fielder', emoji: '🧤', member: bestField ? mOf(bestField.member_id) : null, value: bestField ? `${outfieldDismissals(bestField)} dismissals` : '—', blurb: bestField ? `${bestField.fielding_catches} ct · ${bestField.fielding_run_outs} ro` : '' },
      { key: 'keeper', title: 'Best Wicket-Keeper', emoji: '🥅', member: bestKeeper ? mOf(bestKeeper.member_id) : null, value: bestKeeper ? `${keeperDismissals(bestKeeper)} dismissals` : '—', blurb: bestKeeper ? `${bestKeeper.fielding_caught_behind ?? 0} cb · ${bestKeeper.fielding_stumpings} st` : '' },
      { key: 'improved', title: 'Most Improved', emoji: '📈', member: improved ? mOf(improved.s.member_id) : null, value: improved ? `+${improved.delta}` : '—', blurb: 'Biggest leap from last season' },
      { key: 'six', title: 'Six Machine', emoji: '💥', member: sixMachine ? mOf(sixMachine.member_id) : null, value: sixMachine ? `${sixMachine.batting_sixes} sixes` : '—', blurb: 'Most maximums this season' },
      { key: 'reliable', title: 'Mr. Reliable', emoji: '🧱', member: reliable ? mOf(reliable.member_id) : null, value: reliable ? `avg ${reliable.batting_average?.toFixed(1)}` : '—', blurb: 'Best average (5+ innings)' },
    ].filter(a => a.member);

    // ── Report cards ────────────────────────────────────────────────────────
    const allRuns = withMember.map(s => s.batting_runs);
    const allWkts = withMember.map(s => s.bowling_wickets);
    const allField = withMember.map(dismissals);
    const allImpact = withMember.map(s => fanTotal[s.member_id] || 0);
    const order = ['A+', 'A', 'B+', 'B', 'C+', 'C'];
    const reportCards: ReportCard[] = withMember
      .filter(s => (s.batting_matches || 0) >= 3)
      .map(s => {
        const batting = grade(s.batting_runs, allRuns);
        const bowling = grade(s.bowling_wickets, allWkts);
        const fielding = grade(dismissals(s), allField);
        const impact = grade(fanTotal[s.member_id] || 0, allImpact);
        const overall = [batting, bowling, fielding, impact].sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
        const facets = [['batting', batting], ['bowling', bowling], ['fielding', fielding]] as const;
        const best = facets.slice().sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]))[0];
        const note = order.indexOf(best[1]) <= order.indexOf('B')
          ? `Standout with the ${best[0] === 'batting' ? 'bat' : best[0] === 'bowling' ? 'ball' : 'gloves/in the field'} this season.`
          : 'Solid all-round contributor — room to push next season.';
        return { member: memberById[s.member_id], batting, bowling, fielding, impact, overall, note };
      })
      .sort((a, b) => order.indexOf(a.overall) - order.indexOf(b.overall));

    // ── Club wrapped (external season matches) ────────────────────────────────
    // Season window: '2025-26' → 2025-09-01 .. 2026-08-31
    const startYear = parseInt(season.slice(0, 4), 10);
    const seasonStart = `${startYear}-09-01`;
    const seasonEnd = `${startYear + 1}-08-31`;
    const inSeason = (d: string) => d >= seasonStart && d <= seasonEnd;
    const ext = matches.filter(m => m.match_type === 'external'
      && ['won', 'lost', 'draw'].includes(m.result) && inSeason(m.date));
    const won = ext.filter(m => m.result === 'won').length;
    const lost = ext.filter(m => m.result === 'lost').length;
    const nr = ext.filter(m => m.result === 'draw').length;
    const decisive = won + lost;
    // biggest win by run margin (we batted first & defended)
    let biggestWin: string | null = null; let bestMargin = 0;
    let highestTotal: string | null = null; let bestTotal = 0;
    for (const m of ext) {
      const our = num(m.our_score), opp = num(m.opponent_score);
      if (our != null && our > bestTotal) { bestTotal = our; highestTotal = `${m.our_score} vs ${m.opponent}`; }
      if (m.result === 'won' && our != null && opp != null && our - opp > bestMargin) {
        bestMargin = our - opp; biggestWin = `beat ${m.opponent} by ${our - opp} runs`;
      }
    }
    // Most MOM this season (external matches)
    const momTally: Record<string, number> = {};
    for (const m of ext) if (m.man_of_match_id) momTally[m.man_of_match_id] = (momTally[m.man_of_match_id] || 0) + 1;
    const momLeader = Object.entries(momTally).sort((a, b) => b[1] - a[1])[0];
    const internal = matches.filter(m => m.match_type === 'internal' && m.winning_team && inSeason(m.date));
    const dhur = internal.filter(m => m.winning_team === 'dhurandars').length;
    const baz = internal.filter(m => m.winning_team === 'bazigars').length;

    const clubWrapped: ClubWrapped = {
      season,
      played: ext.length, won, lost, nr,
      winPct: decisive ? Math.round((won / decisive) * 100) : 0,
      biggestWin, highestTotal,
      topScorer: bestBat ? { name: mOf(bestBat.member_id)?.name ?? '—', runs: bestBat.batting_runs } : null,
      topWicket: bestBowl ? { name: mOf(bestBowl.member_id)?.name ?? '—', wkts: bestBowl.bowling_wickets } : null,
      mostMom: momLeader ? { name: mOf(momLeader[0])?.name ?? '—', count: momLeader[1] } : null,
      elClasico: internal.length ? { dhur, baz, verdict: dhur === baz ? 'Honours even' : dhur > baz ? 'Dhurandhars on top' : 'Baazigars on top' } : null,
      mvp: mvpF ? { name: mvpF.member.name, points: Math.round(mvpF.total) } : null,
    };

    return { bestXI, awards, reportCards, clubWrapped };
  }, [members, matches, stats, prevStats, momCounts, fantasy, season]);
}
