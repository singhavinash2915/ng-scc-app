import { useMemo } from 'react';
import type { Member, MemberCricketStats } from '../types';
import { useCricketStats } from './useCricketStats';
import { useMembers } from './useMembers';
import { useMatches } from './useMatches';
import { useMOMCounts } from './useMOMCounts';
import { useFantasyPoints } from './useFantasyPoints';
import { useAllScorecards } from './useAllScorecards';
import { useSccRankings, type RankingMode } from './useSccRankings';
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
  clubWrapped: ClubWrapped;
}

const num = (s: string | null | undefined): number | null => {
  if (!s) return null; const m = s.match(/(\d+)/); return m ? parseInt(m[1], 10) : null;
};

export function useSeasonFinale(season = '2025-26', prevSeason = '2024-25'): SeasonFinale {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats } = useCricketStats(season);
  const { stats: prevStats } = useCricketStats(prevSeason);
  const { counts: momCounts } = useMOMCounts();
  const fantasy = useFantasyPoints(stats, members, momCounts);
  // Player of the Season uses the same ICC-style, opposition-adjusted rating
  // as the SCC Rankings page (geometric mean of bat+bowl, so a player needs to
  // be genuinely good at BOTH — not just accumulate raw runs/wickets like the
  // simple Fantasy Points total used for Team of the Season selection below).
  const { scorecards } = useAllScorecards();
  const sccRankings = useSccRankings(matches, members, scorecards, season as RankingMode);

  return useMemo(() => {
    const memberById: Record<string, Member> = {};
    members.forEach(m => { memberById[m.id] = m; });
    const withMember = stats.filter(s => memberById[s.member_id]);
    const mOf = (id: string) => memberById[id] || null;

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
    // Player of the Season: prefer the ICC-style all-rounder rating (fair to
    // both disciplines via a geometric mean, opposition-adjusted) — falls back
    // to the simple Fantasy Points leader only if rankings aren't available yet
    // (e.g. scorecards still loading) or nobody qualifies as an all-rounder.
    const topAllRounder = sccRankings.allRounders[0] ?? null;
    const mvpMember = topAllRounder?.member ?? mvpF?.member ?? null;
    const mvpValue = topAllRounder ? `${topAllRounder.rating} rating` : (mvpF ? `${Math.round(mvpF.total).toLocaleString('en-IN')} pts` : '—');
    const mvpBlurb = topAllRounder ? 'ICC-style rating — bat + bowl + field, opposition-adjusted' : 'Most valuable across bat, ball & field';
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
      { key: 'mvp', title: 'Player of the Season', emoji: '👑', member: mvpMember, value: mvpValue, blurb: mvpBlurb },
      { key: 'bat', title: 'Best Batter', emoji: '🏏', member: bestBat ? mOf(bestBat.member_id) : null, value: bestBat ? `${bestBat.batting_runs} runs` : '—', blurb: bestBat ? `HS ${bestBat.batting_highest_score} · avg ${bestBat.batting_average?.toFixed(1)}` : '' },
      { key: 'bowl', title: 'Best Bowler', emoji: '🎯', member: bestBowl ? mOf(bestBowl.member_id) : null, value: bestBowl ? `${bestBowl.bowling_wickets} wkts` : '—', blurb: bestBowl ? `best ${bestBowl.bowling_best_figures} · econ ${bestBowl.bowling_economy?.toFixed(1)}` : '' },
      { key: 'field', title: 'Best Fielder', emoji: '🧤', member: bestField ? mOf(bestField.member_id) : null, value: bestField ? `${outfieldDismissals(bestField)} dismissals` : '—', blurb: bestField ? `${bestField.fielding_catches} ct · ${bestField.fielding_run_outs} ro` : '' },
      { key: 'keeper', title: 'Best Wicket-Keeper', emoji: '🥅', member: bestKeeper ? mOf(bestKeeper.member_id) : null, value: bestKeeper ? `${keeperDismissals(bestKeeper)} dismissals` : '—', blurb: bestKeeper ? `${bestKeeper.fielding_caught_behind ?? 0} cb · ${bestKeeper.fielding_stumpings} st` : '' },
      { key: 'improved', title: 'Most Improved', emoji: '📈', member: improved ? mOf(improved.s.member_id) : null, value: improved ? `+${improved.delta}` : '—', blurb: 'Biggest leap from last season' },
      { key: 'six', title: 'Six Machine', emoji: '💥', member: sixMachine ? mOf(sixMachine.member_id) : null, value: sixMachine ? `${sixMachine.batting_sixes} sixes` : '—', blurb: 'Most maximums this season' },
      { key: 'reliable', title: 'Mr. Reliable', emoji: '🧱', member: reliable ? mOf(reliable.member_id) : null, value: reliable ? `avg ${reliable.batting_average?.toFixed(1)}` : '—', blurb: 'Best average (5+ innings)' },
    ].filter(a => a.member);

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
      mvp: mvpMember ? { name: mvpMember.name, points: topAllRounder ? topAllRounder.rating : Math.round(mvpF?.total ?? 0) } : null,
    };

    return { bestXI, awards, clubWrapped };
  }, [members, matches, stats, prevStats, fantasy, season, sccRankings]);
}
