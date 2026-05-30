/**
 * useCHTeamSync — fetch all matches for an SCC CricHeroes team,
 * then auto-link them to app matches by date + opponent name.
 *
 * Workflow:
 *  1. Admin enters SCC CricHeroes team ID → fetchTeamMatches()
 *  2. Hook fetches all pages from CricHeroes team-profile/matches
 *  3. Each CricHeroes match is matched to an app match by date (±1 day)
 *     and opponent name (fuzzy)
 *  4. Admin reviews and calls applyLinks() to bulk-save ch_match_id
 */
import { useState, useCallback } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { Match } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CHMatch {
  chMatchId:    string;
  date:         string;          // YYYY-MM-DD
  team1:        string;
  team2:        string;
  opponent:     string;          // the non-SCC team (empty for internal matches)
  isInternal:   boolean;
  result:       'won' | 'lost' | 'draw' | 'upcoming' | 'unknown';
  ourScore:     string;
  theirScore:   string;
  tournament:   string;
  // Auto-matching
  appMatchId:   string | null;   // matched app match id
  alreadyLinked: boolean;        // ch_match_id already set in app
  status:       'matched' | 'already' | 'no-app-match' | 'skip';
}

export interface TeamSyncState {
  chMatches:   CHMatch[];
  fetchStatus: 'idle' | 'fetching' | 'done' | 'error';
  fetchMsg:    string;
  saveStatus:  'idle' | 'saving' | 'done' | 'error';
  saveMsg:     string;
  totalPages:  number;
  fetchedPages: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normName(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function isSCC(name: string) {
  const n = normName(name);
  return n.includes('sangria') || n.includes('scc');
}

function dateSimilar(a: string, b: string, toleranceDays = 1): boolean {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) <= toleranceDays * 86400000;
}

function opponentSimilar(chOpp: string, appOpp: string | null): boolean {
  if (!appOpp) return false;
  const a = normName(chOpp);
  const b = normName(appOpp);
  if (a === b) return true;
  const aParts = a.split(' ');
  const bParts = b.split(' ');
  // At least 2 words in common
  const common = aParts.filter(w => w.length > 2 && bParts.includes(w));
  return common.length >= 2;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCHMatch(raw: Record<string, any>, sccTeamId: string): Omit<CHMatch, 'appMatchId' | 'alreadyLinked' | 'status'> | null {
  const id = String(raw.match_id ?? raw.id ?? '');
  if (!id || id === 'undefined') return null;

  // Player-profile format: team_a / team_b with summaries
  const teamA    = String(raw.team_a ?? '');
  const teamB    = String(raw.team_b ?? '');
  const teamAId  = String(raw.team_a_id ?? '');
  const teamBId  = String(raw.team_b_id ?? '');
  // Fallback to older keys
  const team1    = teamA || String(raw.team1_name ?? '');
  const team2    = teamB || String(raw.team2_name ?? '');

  // ── STRICT FILTER: only include matches where SCC team ID is one of the teams ──
  // This prevents non-SCC matches from sneaking in when a player plays for multiple teams
  const sccIsTeamA = teamAId === sccTeamId;
  const sccIsTeamB = teamBId === sccTeamId;
  if (!sccIsTeamA && !sccIsTeamB) return null;  // not an SCC match — skip

  const dt       = String(raw.match_start_time ?? raw.start_datetime ?? raw.match_date ?? '');
  const date     = dt ? dt.split('T')[0] : '';
  const winTeam  = String(raw.winning_team ?? '');
  const winTeamId = String(raw.winning_team_id ?? '');
  const status   = String(raw.status ?? '');

  const opp = sccIsTeamA ? team2 : team1;
  // Internal = both teams are SCC (Dhurandars vs Bazigars both under the same team profile)
  const isInternal = sccIsTeamA && sccIsTeamB;

  // Scores
  const ourScore = String(sccIsTeamA
    ? (raw.team_a_summary ?? raw.team1_score ?? '')
    : (raw.team_b_summary ?? raw.team2_score ?? ''));
  const theirScore = String(sccIsTeamA
    ? (raw.team_b_summary ?? raw.team2_score ?? '')
    : (raw.team_a_summary ?? raw.team1_score ?? ''));

  let result: CHMatch['result'] = 'unknown';
  if (status === 'upcoming' || status === 'live') {
    result = 'upcoming';
  } else if (winTeamId && winTeamId !== '0') {
    // Use team ID for result — more reliable than name matching
    if (winTeamId === sccTeamId) result = 'won';
    else result = 'lost';
  } else if (winTeam) {
    if (winTeam.toLowerCase() === 'draw' || winTeam.toLowerCase() === 'tie') result = 'draw';
    else if (isSCC(winTeam)) result = 'won';
    else result = 'lost';
  } else if (status === 'past') {
    result = 'draw';
  }

  return {
    chMatchId: id, date, team1, team2, opponent: isInternal ? '' : opp,
    isInternal, result, ourScore, theirScore,
    tournament: String(raw.tournament_name ?? ''),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCHTeamSync() {
  const [state, setState] = useState<TeamSyncState>({
    chMatches: [], fetchStatus: 'idle', fetchMsg: '', saveStatus: 'idle', saveMsg: '',
    totalPages: 0, fetchedPages: 0,
  });

  const reset = useCallback(() => {
    setState({ chMatches: [], fetchStatus: 'idle', fetchMsg: '', saveStatus: 'idle', saveMsg: '', totalPages: 0, fetchedPages: 0 });
  }, []);

  // ── Fetch ALL team matches in one request via _next/data route ───────────────
  const fetchTeamMatches = useCallback(async (teamId: string, appMatches: Match[]) => {
    if (!teamId.trim()) return;
    setState(s => ({ ...s, fetchStatus: 'fetching', fetchMsg: 'Fetching all matches from CricHeroes…', chMatches: [], totalPages: 0, fetchedPages: 0 }));

    const allCH: Array<Omit<CHMatch, 'appMatchId' | 'alreadyLinked' | 'status'>> = [];
    const seenMatchIds = new Set<string>();

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/cricheroes?teamId=${teamId}&type=team-matches&teamName=x`,
        { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } }
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j?.error ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pp = await res.json() as Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchData = pp?.matches ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchList: Record<string, any>[] = Array.isArray(matchData?.data) ? matchData.data : [];

      if (matchList.length === 0) {
        throw new Error('No matches found — check the team ID');
      }

      setState(s => ({ ...s, fetchMsg: `Processing ${matchList.length} matches…` }));

      for (const raw of matchList) {
        const parsed = parseCHMatch(raw, teamId);
        if (parsed && !seenMatchIds.has(parsed.chMatchId)) {
          seenMatchIds.add(parsed.chMatchId);
          allCH.push(parsed);
        }
      }

      // ── Auto-match CricHeroes matches to app matches ──────────────────────
      const alreadyLinked = new Set(appMatches.filter(m => m.ch_match_id).map(m => m.ch_match_id));

      const linked: CHMatch[] = allCH.map(ch => {
        // Already linked in app?
        if (alreadyLinked.has(ch.chMatchId)) {
          const appM = appMatches.find(m => m.ch_match_id === ch.chMatchId);
          return { ...ch, appMatchId: appM?.id ?? null, alreadyLinked: true, status: 'already' as const };
        }

        // Find app matches on the same date (±1 day)
        const candidates = appMatches.filter(m => dateSimilar(m.date, ch.date, 1));

        if (candidates.length === 0) {
          return { ...ch, appMatchId: null, alreadyLinked: false, status: 'no-app-match' as const };
        }

        // Try to find best match
        let best: Match | null = null;
        if (ch.isInternal) {
          best = candidates.find(m => m.match_type === 'internal') ?? null;
        } else {
          // exact date + opponent
          best = candidates.find(m => m.date === ch.date && opponentSimilar(ch.opponent, m.opponent)) ?? null;
          // fallback: same date, any external
          if (!best) best = candidates.find(m => m.match_type !== 'internal' && m.date === ch.date) ?? null;
          // fallback: ±1 day + opponent match
          if (!best) best = candidates.find(m => opponentSimilar(ch.opponent, m.opponent)) ?? null;
        }

        if (!best) {
          return { ...ch, appMatchId: null, alreadyLinked: false, status: 'no-app-match' as const };
        }
        return { ...ch, appMatchId: best.id, alreadyLinked: false, status: 'matched' as const };
      });

      setState(s => ({
        ...s,
        chMatches: linked,
        fetchStatus: 'done',
        fetchMsg: `Fetched ${linked.length} matches from CricHeroes · ${linked.filter(c => c.status === 'matched').length} auto-linked · ${linked.filter(c => c.status === 'already').length} already set`,
      }));
    } catch (err) {
      setState(s => ({ ...s, fetchStatus: 'error', fetchMsg: err instanceof Error ? err.message : 'Fetch failed' }));
    }
  }, []);

  // ── Save: bulk-update ch_match_id in the matches table ─────────────────────
  const applyLinks = useCallback(async (toSave: CHMatch[]) => {
    const candidates = toSave.filter(c => c.status === 'matched' && c.appMatchId);
    if (candidates.length === 0) return;

    setState(s => ({ ...s, saveStatus: 'saving', saveMsg: `Saving ${candidates.length} match IDs…` }));
    let saved = 0;
    let errors = 0;

    for (const ch of candidates) {
      const { error } = await supabase
        .from('matches')
        .update({ ch_match_id: ch.chMatchId })
        .eq('id', ch.appMatchId!);
      if (error) errors++;
      else saved++;
    }

    // Refresh status of saved items
    setState(s => ({
      ...s,
      saveStatus: 'done',
      saveMsg: `✓ Saved ${saved} CricHeroes IDs${errors > 0 ? ` · ${errors} errors` : ''}`,
      chMatches: s.chMatches.map(c =>
        candidates.some(x => x.chMatchId === c.chMatchId)
          ? { ...c, alreadyLinked: true, status: 'already' }
          : c
      ),
    }));
  }, []);

  // ── Create: insert new match rows for unmatched CricHeroes matches ────────
  const createMissingMatches = useCallback(async (toCreate: CHMatch[]) => {
    const candidates = toCreate.filter(c => c.status === 'no-app-match' && c.date);
    if (candidates.length === 0) return;

    setState(s => ({ ...s, saveStatus: 'saving', saveMsg: `Creating ${candidates.length} matches…` }));
    let created = 0;
    let errors = 0;

    for (const ch of candidates) {
      // Map CricHeroes result to app result
      const resultMap: Record<string, string> = { won: 'won', lost: 'lost', draw: 'draw', upcoming: 'upcoming' };
      const appResult = resultMap[ch.result] ?? 'draw';

      // Determine winning_team for internal matches
      let winningTeam: string | null = null;
      if (ch.isInternal && appResult !== 'draw') {
        // For internal, team1 is typically Dhurandars, team2 Bazigars
        const t1Lower = ch.team1.toLowerCase();
        const t2Lower = ch.team2.toLowerCase();
        if (appResult === 'won') {
          // "won" from SCC perspective — check which team name contains dhurandar/bazigars
          if (t1Lower.includes('dhurandar')) winningTeam = 'dhurandars';
          else if (t1Lower.includes('bazigars') || t1Lower.includes('baazigars')) winningTeam = 'bazigars';
          else if (t2Lower.includes('dhurandar')) winningTeam = 'dhurandars';
          else if (t2Lower.includes('bazigars') || t2Lower.includes('baazigars')) winningTeam = 'bazigars';
        }
      }

      const insertData = {
        date: ch.date,
        venue: '',
        opponent: ch.isInternal ? (ch.team1 + ' vs ' + ch.team2) : ch.opponent,
        result: appResult,
        our_score: ch.ourScore || null,
        opponent_score: ch.theirScore || null,
        match_fee: 0,
        ground_cost: 0,
        other_expenses: 0,
        deduct_from_balance: false,
        notes: ch.tournament || null,
        match_type: ch.isInternal ? 'internal' : 'external',
        winning_team: winningTeam,
        ch_match_id: ch.chMatchId,
        polling_enabled: false,
      };

      const { error } = await supabase.from('matches').insert(insertData);
      if (error) {
        console.error('Insert match error:', ch.chMatchId, error);
        errors++;
      } else {
        created++;
      }
    }

    setState(s => ({
      ...s,
      saveStatus: 'done',
      saveMsg: `✓ Created ${created} matches${errors > 0 ? ` · ${errors} errors` : ''} — reload page to see them`,
      chMatches: s.chMatches.map(c =>
        candidates.some(x => x.chMatchId === c.chMatchId)
          ? { ...c, alreadyLinked: true, status: 'already' as const }
          : c
      ),
    }));
  }, []);

  return { state, fetchTeamMatches, applyLinks, createMissingMatches, reset };
}
