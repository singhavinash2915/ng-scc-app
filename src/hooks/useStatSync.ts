/**
 * useStatSync — aggregate batting + bowling stats from CricHeroes scorecards
 * and upsert into member_cricket_stats for "current season" or "all-time".
 *
 * For each match with a ch_match_id, the existing /cricheroes edge function is
 * called to get the full scorecard JSON.  Each player name is fuzzy-matched
 * to an SCC member; unmatched names are surfaced to the admin.
 */
import { useState, useCallback } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { Match, Member } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncProgress {
  total:          number;
  done:           number;
  status:         'idle' | 'running' | 'done' | 'error';
  message:        string;
  unmatched:      string[];   // CricHeroes names that couldn't be mapped to a member
  matchedMembers: number;
  errors:         number;
}

interface Acc {
  matchSet:       Set<string>;
  // batting
  battingInnings: number;
  runs:           number;
  balls:          number;
  fours:          number;
  sixes:          number;
  highest:        number;
  highestNotOut:  boolean;
  ducks:          number;
  fifties:        number;
  hundreds:       number;
  dismissals:     number;
  battingRunOuts: number;
  // bowling
  bowlInnings:    number;
  totalBalls:     number;
  wickets:        number;
  runsConceded:   number;
  bestWkts:       number;
  bestRuns:       number;
  fiveWickets:    number;
  // fielding
  catches:        number;
  stumpings:      number;
  runOuts:        number;
}

function emptyAcc(): Acc {
  return {
    matchSet: new Set(),
    battingInnings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
    highest: 0, highestNotOut: false, ducks: 0, fifties: 0, hundreds: 0, dismissals: 0, battingRunOuts: 0,
    bowlInnings: 0, totalBalls: 0, wickets: 0, runsConceded: 0,
    bestWkts: 0, bestRuns: 9999, fiveWickets: 0,
    catches: 0, stumpings: 0, runOuts: 0,
  };
}

// ── Fielding: parse dismissal text ───────────────────────────────────────────
// CricHeroes formats: "c FielderName b Bowler", "c & b Bowler",
// "st KeeperName b Bowler", "run out (FielderName)", "run out FielderName"
function parseFielding(
  howOut: string,
  matchId: string,
  acc: Record<string, Acc>,
  resolve: (name: string) => Member | null,
) {
  if (!howOut) return;
  // Strip leading/trailing whitespace; keep original casing for name resolution
  const d = howOut.trim();
  const dl = d.toLowerCase();

  if (dl.startsWith('c & b ') || dl.startsWith('c&b ')) {
    // Caught and bowled — the bowler gets the catch
    const bowlerName = d.replace(/^c\s*&\s*b\s+/i, '').trim();
    const m = resolve(bowlerName);
    if (m) { if (!acc[m.id]) acc[m.id] = emptyAcc(); acc[m.id].catches++; acc[m.id].matchSet.add(matchId); }

  } else if (dl.startsWith('c ')) {
    // Caught: "c FielderName b BowlerName"
    const inner = d.slice(2);                           // "FielderName b BowlerName"
    const bIdx = inner.search(/\s+b\s+/i);
    const fielderName = bIdx >= 0 ? inner.slice(0, bIdx).trim() : inner.trim();
    const m = resolve(fielderName);
    if (m) { if (!acc[m.id]) acc[m.id] = emptyAcc(); acc[m.id].catches++; acc[m.id].matchSet.add(matchId); }

  } else if (dl.startsWith('st ')) {
    // Stumped: "st KeeperName b BowlerName"
    const inner = d.slice(3);
    const bIdx = inner.search(/\s+b\s+/i);
    const keeperName = bIdx >= 0 ? inner.slice(0, bIdx).trim() : inner.trim();
    const m = resolve(keeperName);
    if (m) { if (!acc[m.id]) acc[m.id] = emptyAcc(); acc[m.id].stumpings++; acc[m.id].matchSet.add(matchId); }

  } else if (dl.includes('run out')) {
    // Run out: "run out (FielderName)" or "run out FielderName"
    // Sometimes "run out (A/B)" — credit the first name
    const roMatch = d.match(/run out\s*\(?\s*([^)/\n]+)/i);
    if (roMatch) {
      const fielderName = roMatch[1].trim();
      const m = resolve(fielderName);
      if (m) { if (!acc[m.id]) acc[m.id] = emptyAcc(); acc[m.id].runOuts++; acc[m.id].matchSet.add(matchId); }
    }
  }
}

// ── Name matching ────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function matchPlayer(chName: string, members: Member[]): Member | null {
  // Critical: when SCC has TWO members sharing a first name (e.g. Aditya
  // Purohit AND Aditya Jaiswal), CricHeroes scorecard rows like "Aditya P"
  // and "Aditya" must NOT collide. We resolve via the last-name initial
  // when the CH name uses the "First + Initial" form.
  //
  // Rules (in order):
  //   1. Exact normalised match.
  //   2. "First + SingleLetterInitial" → match SCC member whose last name
  //      starts with that letter. If multiple Adityas, "Aditya P" → Purohit.
  //   3. Multi-word name → require first AND last word to match (last word
  //      can be a startsWith match either direction).
  //   4. Single-word first name → only match if EXACTLY ONE SCC member
  //      has that first name. If ambiguous, return null (skip the row).

  const n = norm(chName);
  if (!n) return null;

  // 1. Exact
  let m = members.find(x => norm(x.name) === n);
  if (m) return m;

  const parts = n.split(' ');
  const byFirst = members.filter(x => norm(x.name).split(' ')[0] === parts[0]);

  // 2. "First + Initial" form (e.g. "Aditya P", "Vinay R")
  if (parts.length === 2 && parts[1].length === 1) {
    const chInitial = parts[1][0];
    const initialMatch = byFirst.find(x => {
      const xp = norm(x.name).split(' ');
      const lastWord = xp[xp.length - 1] || '';
      return lastWord[0] === chInitial;
    });
    if (initialMatch) return initialMatch;
    // Fallback only if there's a single candidate with this first name
    if (byFirst.length === 1) return byFirst[0];
    return null; // ambiguous — skip rather than misattribute
  }

  // 3. Multi-word name — require first AND last to align
  if (parts.length >= 2) {
    m = members.find(x => {
      const xp = norm(x.name).split(' ');
      const lastCh  = parts[parts.length - 1];
      const lastSb  = xp[xp.length - 1];
      return xp[0] === parts[0] && (
        lastSb === lastCh ||
        lastSb.startsWith(lastCh) ||
        lastCh.startsWith(lastSb)
      );
    });
    if (m) return m;
    // No surname match: only resolve if first name is unique
    if (byFirst.length === 1) return byFirst[0];
    return null;
  }

  // 4. Single-word first name only — match only if unambiguous
  if (byFirst.length === 1) return byFirst[0];

  return null;
}

// ── Name-map persistence ──────────────────────────────────────────────────────
// Maps CricHeroes display name → SCC member id.
// Stored in localStorage so admin only has to do this once.
const NAME_MAP_KEY = 'scc-ch-name-map';

export function loadNameMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NAME_MAP_KEY) || '{}'); }
  catch { return {}; }
}
export function saveNameMap(map: Record<string, string>) {
  localStorage.setItem(NAME_MAP_KEY, JSON.stringify(map));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useStatSync() {
  const [progress, setProgress] = useState<SyncProgress>({
    total: 0, done: 0, status: 'idle', message: '',
    unmatched: [], matchedMembers: 0, errors: 0,
  });

  const sync = useCallback(async (
    matches:      Match[],
    members:      Member[],
    seasonFilter: { start: string; end: string } | null,  // null = all-time
    seasonLabel:  string,                                  // e.g. '2025-26' or 'all-time'
    nameMap:      Record<string, string> = loadNameMap(),  // chName → memberId
  ) => {
    // Filter to matches that have a CricHeroes ID and are completed
    const eligible = matches.filter(m =>
      m.ch_match_id &&
      ['won', 'lost', 'draw'].includes(m.result) &&
      (!seasonFilter || (m.date >= seasonFilter.start && m.date <= seasonFilter.end))
    );

    if (eligible.length === 0) {
      setProgress({ total: 0, done: 0, status: 'done', message: 'No completed matches with CricHeroes IDs found.', unmatched: [], matchedMembers: 0, errors: 0 });
      return;
    }

    setProgress({ total: eligible.length, done: 0, status: 'running', message: 'Starting…', unmatched: [], matchedMembers: 0, errors: 0 });

    // Build a lookup from member id → Member for nameMap resolution
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));

    // Wrapper that checks manual nameMap before fuzzy matching
    const resolveName = (chName: string): Member | null => {
      const mapped = nameMap[chName];
      if (mapped && memberById[mapped]) return memberById[mapped];
      return matchPlayer(chName, members);
    };

    const acc: Record<string, Acc> = {};
    const unmatchedSet = new Set<string>();
    let errors = 0;

    for (let i = 0; i < eligible.length; i++) {
      const match = eligible[i];
      setProgress(p => ({ ...p, done: i, message: `Processing ${i + 1} / ${eligible.length} matches…` }));

      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/cricheroes?matchId=${match.ch_match_id}&type=scorecard`,
          { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pp = await res.json() as Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scorecard = pp?.scorecard as Array<Record<string, any>> | undefined;
        if (!scorecard?.length) continue;

        for (const raw of scorecard) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const batting = (raw.batting as Array<Record<string, any>>) ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bowling = (raw.bowling as Array<Record<string, any>>) ?? [];

          // Detect if this innings was batted by an SCC team.
          // CricHeroes uses names like "Sangria Cricket Club",
          // "Sangria Dhurandars", "Sangria Bazigars".
          const teamName = String(raw.teamName ?? '').toLowerCase();
          const isSCCBatting = teamName.includes('sangria') || teamName.includes('scc');
          const isInternal   = match.match_type === 'internal';

          // ── Batting rows ──
          // Only process when it is SCC's batting innings.
          // (In internal matches both innings are SCC, so always process.)
          if (isSCCBatting || isInternal) {
            for (const b of batting) {
              if (!Number(b.balls)) continue;       // never faced a ball → skip
              const member = resolveName(String(b.name ?? ''));
              // Unmatched here means an SCC player whose name differs → worth warning
              if (!member) { if (b.name) unmatchedSet.add(String(b.name)); continue; }

              if (!acc[member.id]) acc[member.id] = emptyAcc();
              const s = acc[member.id];
              s.matchSet.add(match.id);
              s.battingInnings++;

              const runs  = Number(b.runs  ?? 0);
              const balls = Number(b.balls ?? 0);
              const notOut = !b.how_to_out || b.how_to_out === '';

              s.runs  += runs;
              s.balls += balls;
              s.fours += Number(b['4s'] ?? 0);
              s.sixes += Number(b['6s'] ?? 0);
              if (!notOut) {
                s.dismissals++;
                if (String(b.how_to_out ?? '').toLowerCase().includes('run out')) s.battingRunOuts++;
              }
              if (runs > s.highest || (runs === s.highest && !s.highestNotOut && notOut)) {
                s.highest = runs; s.highestNotOut = notOut;
              }
              if (runs === 0 && !notOut) s.ducks++;
              if (runs >= 100) s.hundreds++;
              else if (runs >= 50) s.fifties++;
            }
          }

          // ── Bowling rows ──
          // SCC bowls in the OPPONENT's innings (where opponent is batting).
          // For internal matches both innings have SCC bowlers, so always process.
          // Silently skip anyone not in our members list — they're opponents.
          if (!isSCCBatting || isInternal) {
            for (const b of bowling) {
              const member = resolveName(String(b.name ?? ''));
              if (!member) continue;   // opponent bowler — skip silently

              if (!acc[member.id]) acc[member.id] = emptyAcc();
              const s = acc[member.id];
              s.matchSet.add(match.id);
              s.bowlInnings++;

              const wkts = Number(b.wickets ?? 0);
              const runs = Number(b.runs    ?? 0);
              const ov   = Number(b.overs   ?? 0);
              const bl   = Number(b.balls   ?? 0);

              s.totalBalls   += ov * 6 + bl;
              s.wickets      += wkts;
              s.runsConceded += runs;
              if (wkts >= 5) s.fiveWickets++;
              if (wkts > s.bestWkts || (wkts === s.bestWkts && runs < s.bestRuns)) {
                s.bestWkts = wkts; s.bestRuns = runs;
              }
            }
          }

          // ── Fielding: parse dismissal text from OPPONENT batting innings ──
          // SCC players appear as fielders in the opponent's batting innings.
          // For internal matches, both innings have SCC fielders.
          if (!isSCCBatting || isInternal) {
            for (const b of batting) {
              if (!b.how_to_out || b.how_to_out === '') continue;
              parseFielding(String(b.how_to_out), match.id, acc, resolveName);
            }
          }
        }
      } catch (err) {
        console.error(`Error on match ${match.ch_match_id}:`, err);
        errors++;
      }

      // Polite delay to avoid hammering CricHeroes / the edge function
      if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    // ── Compute derived stats + upsert ────────────────────────────────────────
    let matchedMembers = 0;
    for (const [memberId, s] of Object.entries(acc)) {
      const fullOvers     = Math.floor(s.totalBalls / 6);
      const remainBalls   = s.totalBalls % 6;
      const oversNum      = fullOvers + remainBalls / 10;
      const totalOversDec = s.totalBalls / 6;
      const economy       = totalOversDec > 0 ? Math.round((s.runsConceded / totalOversDec) * 100) / 100 : 0;
      const bowlAvg       = s.wickets > 0    ? Math.round((s.runsConceded / s.wickets) * 100) / 100 : 0;
      const bowlSR        = s.wickets > 0    ? Math.round((s.totalBalls / s.wickets) * 10) / 10 : 0;
      const battingAvg    = s.dismissals > 0 ? Math.round((s.runs / s.dismissals) * 100) / 100 : s.runs;
      const sr            = s.balls > 0      ? Math.round((s.runs / s.balls) * 10000) / 100 : 0;
      const bestFigures   = s.bestWkts > 0   ? `${s.bestWkts}/${s.bestRuns}` : '0/0';

      try {
        const { error } = await supabase.from('member_cricket_stats').upsert({
          member_id:             memberId,
          season:                seasonLabel,
          batting_matches:       s.matchSet.size,
          batting_innings:       s.battingInnings,
          batting_runs:          s.runs,
          batting_highest_score: s.highest,
          batting_average:       battingAvg,
          batting_strike_rate:   sr,
          batting_fifties:       s.fifties,
          batting_hundreds:      s.hundreds,
          batting_ducks:         s.ducks,
          batting_fours:         s.fours,
          batting_sixes:         s.sixes,
          batting_run_outs:      s.battingRunOuts,
          bowling_matches:       s.matchSet.size,
          bowling_innings:       s.bowlInnings,
          bowling_overs:         oversNum,
          bowling_wickets:       s.wickets,
          bowling_runs_conceded: s.runsConceded,
          bowling_economy:       economy,
          bowling_average:       bowlAvg,
          bowling_strike_rate:   bowlSR,
          bowling_best_figures:  bestFigures,
          bowling_five_wickets:  s.fiveWickets,
          fielding_catches:      s.catches,
          fielding_stumpings:    s.stumpings,
          fielding_run_outs:     s.runOuts,
          updated_at:            new Date().toISOString(),
          last_synced_at:        new Date().toISOString(),
        }, { onConflict: 'member_id,season' });

        if (error) throw error;
        matchedMembers++;
      } catch (e) {
        console.error('DB upsert error for member', memberId, e);
        errors++;
      }
    }

    setProgress({
      total:          eligible.length,
      done:           eligible.length,
      status:         'done',
      message:        `Synced ${matchedMembers} members from ${eligible.length} matches`,
      unmatched:      [...unmatchedSet].sort(),
      matchedMembers,
      errors,
    });
  }, []);

  const reset = useCallback(() => {
    setProgress({ total: 0, done: 0, status: 'idle', message: '', unmatched: [], matchedMembers: 0, errors: 0 });
  }, []);

  return { progress, sync, reset };
}
