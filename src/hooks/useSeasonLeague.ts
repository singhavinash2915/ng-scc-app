import { useMemo } from 'react';
import { useMatches } from './useMatches';
import { useCricketStats } from './useCricketStats';
import type { Match, Member, MemberCricketStats } from '../types';

// The current-season club league. Every external match this season is played
// under it, and CricHeroes tags each match — the sync writes that tag into the
// match's `notes` as "Tournament: <name>". We match on that tag (whitespace-
// normalised, since CricHeroes stored the name with a double space).
export const CURRENT_LEAGUE = {
  name: 'Sangria Cricket Club League 2026-27',
  season: '2026-27',        // matches useCricketStats season key
  window: 'Sep 2026 – Jun 2027',
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Pull the league/tournament name out of a match's notes ("Tournament: X | …"). */
export function leagueNameFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/tournament:\s*([^|]+)/i);
  return m ? m[1].trim() : null;
}

export interface LeagueLeader { member: Member; value: number; label: string; }

export interface SeasonLeague {
  name: string;
  window: string;
  loading: boolean;
  matches: Match[];
  played: Match[];
  upcoming: Match[];
  won: number; lost: number; draw: number;
  winPct: number;
  points: number;              // simple league points: win 2, draw 1
  totalFixtures: number;
  momLeaders: { member: Member; count: number }[];
  topBatter: LeagueLeader | null;
  topBowler: LeagueLeader | null;
}

export function useSeasonLeague(leagueName = CURRENT_LEAGUE.name, season = CURRENT_LEAGUE.season): SeasonLeague {
  const { matches, loading } = useMatches();
  // All external matches this season ARE the league, so season stats double as
  // league leaders. Empty pre-season → the UI shows a "kicks off soon" state.
  const { stats } = useCricketStats(season);

  return useMemo(() => {
    const target = norm(leagueName);
    const leagueMatches = matches
      .filter(m => {
        if (m.match_type === 'internal') return false;
        const ln = leagueNameFromNotes(m.notes);
        return ln && norm(ln) === target;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const played = leagueMatches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const upcoming = leagueMatches.filter(m => m.result === 'upcoming');
    const won = played.filter(m => m.result === 'won').length;
    const lost = played.filter(m => m.result === 'lost').length;
    const draw = played.filter(m => m.result === 'draw').length;
    const decisive = won + lost;

    // MOM leaders within the league (pure match data — no scorecards needed)
    const momMap = new Map<string, { member: Member; count: number }>();
    played.forEach(m => {
      if (m.man_of_match) {
        const entry = momMap.get(m.man_of_match.id) ?? { member: m.man_of_match, count: 0 };
        entry.count += 1;
        momMap.set(m.man_of_match.id, entry);
      }
    });
    const momLeaders = [...momMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    const memberOf = (s: MemberCricketStats): Member | null =>
      (s as unknown as { member?: Member }).member ?? null;

    const topBatterStat = [...stats].filter(s => s.batting_runs > 0).sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topBowlerStat = [...stats].filter(s => s.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const topBatter = topBatterStat && memberOf(topBatterStat)
      ? { member: memberOf(topBatterStat)!, value: topBatterStat.batting_runs, label: 'runs' } : null;
    const topBowler = topBowlerStat && memberOf(topBowlerStat)
      ? { member: memberOf(topBowlerStat)!, value: topBowlerStat.bowling_wickets, label: 'wkts' } : null;

    return {
      name: leagueName,
      window: CURRENT_LEAGUE.window,
      loading,
      matches: leagueMatches,
      played, upcoming,
      won, lost, draw,
      winPct: decisive ? Math.round((won / decisive) * 100) : 0,
      points: won * 2 + draw,
      totalFixtures: leagueMatches.length,
      momLeaders,
      topBatter, topBowler,
    };
  }, [matches, stats, leagueName, loading]);
}
