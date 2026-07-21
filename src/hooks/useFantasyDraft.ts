import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Member, MemberCricketStats } from '../types';
import { useFantasyPoints } from './useFantasyPoints';

export const SQUAD_SIZE = 11;
export const BUDGET = 100;

export interface FantasyTeamRow {
  id: string;
  manager_id: string;
  season: string;
  team_name: string | null;
  player_ids: string[];
  captain_id: string | null;
}

export interface DraftPlayer {
  member: Member;
  price: number;            // credits (4–15), derived from LAST season's form
  points: number;           // THIS season's fantasy points (0 until it starts)
  lastSeasonPoints: number; // last season's total — the form guide behind the price
}

export interface LeagueEntry {
  team: FantasyTeamRow;
  manager: Member | null;
  score: number;
  captainName: string | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useFantasyDraft(
  season: string,
  pricingStats: MemberCricketStats[],   // LAST season — sets the auction prices
  scoringStats: MemberCricketStats[],   // THIS season — earns the points
  members: Member[],
  momCounts: Record<string, number>,    // THIS season's MOM bonuses
) {
  // Real-fantasy split: you pay for past form, you score on new-season deeds.
  const pricingFantasy = useFantasyPoints(pricingStats, members, {});
  const scoringFantasy = useFantasyPoints(scoringStats, members, momCounts);
  const [teams, setTeams] = useState<FantasyTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const pointsById = useMemo(() => {
    const m: Record<string, number> = {};
    scoringFantasy.forEach(f => { m[f.member.id] = f.total; });
    return m;
  }, [scoringFantasy]);

  // Player pool with prices relative to last season's top scorer.
  const draftPlayers: DraftPlayer[] = useMemo(() => {
    const maxTotal = Math.max(1, ...pricingFantasy.map(f => f.total));
    return pricingFantasy.map(f => ({
      member: f.member,
      points: pointsById[f.member.id] || 0,
      lastSeasonPoints: f.total,
      price: clamp(Math.round(4 + 11 * (f.total / maxTotal)), 4, 15),
    }));
  }, [pricingFantasy, pointsById]);

  const priceById = useMemo(() => {
    const m: Record<string, number> = {};
    draftPlayers.forEach(p => { m[p.member.id] = p.price; });
    return m;
  }, [draftPlayers]);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fantasy_teams')
      .select('*')
      .eq('season', season);
    if (error) {
      // Migration not run yet: Postgres 42P01 (relation missing) or PostgREST
      // PGRST205 ("Could not find the table … in the schema cache").
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message)) {
        setTableMissing(true);
      }
      setTeams([]);
    } else {
      setTableMissing(false);
      setTeams((data as FantasyTeamRow[]) || []);
    }
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const saveTeam = useCallback(async (
    managerId: string,
    teamName: string,
    playerIds: string[],
    captainId: string | null,
  ) => {
    const { error } = await supabase
      .from('fantasy_teams')
      .upsert(
        { manager_id: managerId, season, team_name: teamName, player_ids: playerIds, captain_id: captainId, updated_at: new Date().toISOString() },
        { onConflict: 'manager_id,season' },
      );
    if (error) throw error;
    await fetchTeams();
  }, [season, fetchTeams]);

  const teamScore = useCallback((t: FantasyTeamRow) => {
    let score = (t.player_ids || []).reduce((sum, id) => sum + (pointsById[id] || 0), 0);
    if (t.captain_id) score += pointsById[t.captain_id] || 0; // captain counts double
    return Math.round(score);
  }, [pointsById]);

  const leaderboard: LeagueEntry[] = useMemo(() => {
    const memberById: Record<string, Member> = {};
    members.forEach(m => { memberById[m.id] = m; });
    return teams
      .map(t => ({
        team: t,
        manager: memberById[t.manager_id] || null,
        score: teamScore(t),
        captainName: t.captain_id ? (memberById[t.captain_id]?.name ?? null) : null,
      }))
      .sort((a, b) => b.score - a.score);
  }, [teams, members, teamScore]);

  const myTeam = useCallback((managerId: string | null) =>
    managerId ? teams.find(t => t.manager_id === managerId) ?? null : null, [teams]);

  return { draftPlayers, priceById, pointsById, teams, leaderboard, myTeam, teamScore, saveTeam, fetchTeams, loading, tableMissing };
}
