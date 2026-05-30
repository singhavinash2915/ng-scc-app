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
function parseCHMatch(raw: Record<string, any>, sccTeamId: string): Omit<CHMatch, 'appMatchId' | 'alreadyLinked' | 'status'> {
  const id        = String(raw.match_id ?? raw.id ?? '');
  const dt        = String(raw.start_datetime ?? raw.match_date ?? '');
  const date      = dt ? dt.split('T')[0] : '';
  const team1     = String(raw.team1_name ?? raw.team1?.name ?? '');
  const team2     = String(raw.team2_name ?? raw.team2?.name ?? '');
  const winTeam   = String(raw.winning_team ?? '');
  const status    = String(raw.status ?? '');
  const team1Id   = String(raw.team1_id ?? raw.team1?.id ?? '');
  // team2Id not used currently but may be useful for future disambiguation
  // const team2Id = String(raw.team2_id ?? raw.team2?.id ?? '');

  const sccIsTeam1 = team1Id === sccTeamId || isSCC(team1);
  const opp        = sccIsTeam1 ? team2 : team1;
  const isInternal = isSCC(team1) && isSCC(team2);

  const ourScore   = String(sccIsTeam1 ? (raw.team1_score ?? raw.team1_total ?? '') : (raw.team2_score ?? raw.team2_total ?? ''));
  const theirScore = String(sccIsTeam1 ? (raw.team2_score ?? raw.team2_total ?? '') : (raw.team1_score ?? raw.team1_total ?? ''));

  let result: CHMatch['result'] = 'unknown';
  if (status === 'upcoming' || status === 'live') {
    result = 'upcoming';
  } else if (winTeam) {
    if (isSCC(winTeam)) result = 'won';
    else if (winTeam.toLowerCase() === 'draw' || winTeam.toLowerCase() === 'tie') result = 'draw';
    else result = 'lost';
  } else if (status === 'past') {
    result = 'draw'; // no winner recorded = draw
  }

  return {
    chMatchId: id, date, team1, team2, opponent: isInternal ? '' : opp,
    isInternal, result, ourScore, theirScore,
    tournament: String(raw.tournament_name ?? raw.tournament ?? ''),
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

  // ── Fetch all pages of CricHeroes team matches ──────────────────────────────
  const fetchTeamMatches = useCallback(async (teamId: string, appMatches: Match[]) => {
    if (!teamId.trim()) return;
    setState(s => ({ ...s, fetchStatus: 'fetching', fetchMsg: 'Fetching from CricHeroes…', chMatches: [], totalPages: 0, fetchedPages: 0 }));

    const allCH: Array<Omit<CHMatch, 'appMatchId' | 'alreadyLinked' | 'status'>> = [];
    let page = 1;
    let totalPages = 1;

    try {
      while (page <= totalPages && page <= 20) { // safety cap at 20 pages
        setState(s => ({ ...s, fetchMsg: `Fetching page ${page}${totalPages > 1 ? `/${totalPages}` : ''}…` }));

        const res = await fetch(
          `${supabaseUrl}/functions/v1/cricheroes?teamId=${teamId}&type=team-matches&page=${page}`,
          { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pp: Record<string, any> = await res.json();

        // CricHeroes stores match list in several possible keys
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchList: Record<string, any>[] =
          pp?.teamMatchList?.data ??
          pp?.matchList?.data ??
          pp?.matches?.data ??
          pp?.data ??
          [];

        if (matchList.length === 0 && page === 1) {
          throw new Error('No matches found — check team ID or try again');
        }

        const pagination = pp?.teamMatchList?.pagination ?? pp?.matchList?.pagination ?? pp?.pagination ?? null;
        if (pagination) {
          const perPage = Number(pagination.per_page ?? 10);
          const total   = Number(pagination.total ?? matchList.length);
          totalPages    = Math.ceil(total / perPage);
        }

        for (const raw of matchList) {
          if (!raw.match_id && !raw.id) continue;
          allCH.push(parseCHMatch(raw, teamId));
        }

        setState(s => ({ ...s, totalPages, fetchedPages: page }));
        page++;

        if (page <= totalPages) await new Promise(r => setTimeout(r, 300)); // polite delay
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

  return { state, fetchTeamMatches, applyLinks, reset };
}
