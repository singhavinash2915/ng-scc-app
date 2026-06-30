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

// ── CricHeroes player_id → SCC member UUID ────────────────────────────────────
// CricHeroes scorecard rows carry an authoritative numeric player_id. Matching
// on it is bulletproof — it sidesteps every name-collision problem (most
// notably the TWO Adityas: Purohit 20844962 and Jaiswal 5447632, who otherwise
// get folded together because CricHeroes shows one as "Aditya P" and the other
// as bare "Aditya"). Keep this in sync with CH_TO_SB in scripts/sync_cricheroes.py.
export const CH_PLAYER_TO_MEMBER: Record<number, string> = {
  680643:  '5d623102-766a-4243-83ef-2fb941ae96f3',  // Shaan Shaikh
  3855641: '7545cb6b-41fe-4102-b392-f560ae44805f',  // Avinash Singh
  26474497:'329137e8-ea3d-4a68-94a3-718e24e610cb',  // Adarsh Dwivedi
  5447632: '8fc244d3-cbfb-4c9c-8c5b-efd47143d902',  // Aditya Jaiswal ("Aditya")
  20844962:'b8c4f216-25f5-4e85-881c-4973ab4cb042',  // Aditya Purohit ("Aditya P")
  1450076: 'c800fdc4-92e0-4b58-832d-0672dff61a9c',  // Ajinkya Gharpure
  4391800: '230629f4-cd80-4903-8b75-c485c75b2de7',  // Akash Jadhav
  30975147:'35e097af-b2b0-468c-b0e0-6220de787cf4',  // Anand
  26769238:'4fc80954-a105-4570-9c4a-88fac57b45be',  // Animesh Saxena
  14518769:'69035791-1be6-4cab-8315-120eccefe44b',  // Aprmay Kumar
  2793490: 'c5e6cb6d-394d-4623-ab3d-c28705b77514',  // Arpan Thakur
  36043018:'45a04053-f886-40a5-967c-f581d5b4ffeb',  // Bharat Mishra
  26733102:'01491044-fbf0-48db-ae71-561d153d28e6',  // Dhawal Jain
  27853017:'3505303e-3288-49ef-b1cc-44285ecedbed',  // Gourav Shrivastava
  26218657:'055558d1-2999-44f5-881e-38d80ae4d92f',  // Harshit Upadhyay
  3142063: 'da957ad5-baa8-44b9-9dc6-56f2afa6e7ea',  // Honey Porwal
  30974333:'35481bee-823f-4fbb-9f84-9c9a716c616e',  // Mayank Nayak
  26805965:'8cfc8965-bb5b-4718-a2ba-d1ca202760a5',  // Nikhil
  4842518: '6571e062-9ac5-414f-b0d6-12e53b680327',  // Niraj Parmeshwar
  16794243:'d9729561-fead-488c-9d8f-8a7b52c93567',  // Piyush Pankaj
  16937743:'6ee157f3-e24c-4f1b-aad8-542145f5c828',  // Prateek Singh
  6100183: '2d43ae38-6a5d-4c88-841e-3ccc06a1671d',  // PRATIK PATIL
  15337300:'f258b017-932e-4a63-b217-34410199a1a5',  // Rajat
  30406057:'1c6cb1c4-f523-4b16-9997-0764190931fc',  // Raushan
  33275197:'6c00436e-cd4c-4c86-bc49-e0ba36179223',  // Rishi Gupta
  26739447:'ef718518-322a-4cb6-a843-dba1bdc8fc1f',  // Ritik Lodha
  3954444: '1046e698-8d6e-4f14-8c2d-c7759764f02e',  // Rohan Kumar Rao
  14464945:'e412ba18-86c9-4896-ad06-f687b0bdc88c',  // Saurabh Lele
  4541847: '49439c54-f8bb-45af-81d0-d99a3875f214',  // Shakhil Srivastava
  34079971:'afeea407-dd39-4894-ba6b-e7d81fad005e',  // Shubham Chavhan
  26805068:'7c466077-bd02-4f23-ad4d-218bd8d70fff',  // Shubham Garethiya
  29767342:'3f98ee10-fa48-4c60-b4fb-f85ecc5af1d4',  // Shubham Patil
  26769030:'04e8130d-78c4-44b7-a54e-e50c206941c6',  // Soumyaranjan Mohapatra
  26869497:'09a4ec82-55fa-4ffd-915e-a2bfe71e8768',  // Sudhakar Dama
  5536842: '1f68f840-b4ec-49a2-bcde-49d7fcf17dd0',  // Sushil Yadav
  26769283:'9dcb188f-b007-4427-8114-86984c2c209f',  // Tarang
  26804704:'85762f91-6b6d-46fe-a6cf-9a2b38f07338',  // Vaibhav Shrivastav
  32434601:'64d33e23-8e61-4406-b1c2-e540da9c9da5',  // Vinay Raut
  42750501:'13972b5b-0423-42e2-9490-1ae2f892218c',  // Abhishek Manhas
};

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
  catches:        number;   // OUTFIELD catches only
  caughtBehind:   number;   // wicket-keeper catches (marked with † in CricHeroes)
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
    catches: 0, caughtBehind: 0, stumpings: 0, runOuts: 0,
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
    // Caught: "c FielderName b BowlerName". A leading † marks a wicket-keeper
    // catch (caught behind) — credit it separately from outfield catches so
    // keepers don't inflate the fielding board.
    const inner = d.slice(2);                           // "FielderName b BowlerName"
    const bIdx = inner.search(/\s+b\s+/i);
    let fielderName = bIdx >= 0 ? inner.slice(0, bIdx).trim() : inner.trim();
    const isKeeperCatch = fielderName.includes('†');
    fielderName = fielderName.replace(/†/g, '').trim();
    const m = resolve(fielderName);
    if (m) {
      if (!acc[m.id]) acc[m.id] = emptyAcc();
      if (isKeeperCatch) acc[m.id].caughtBehind++; else acc[m.id].catches++;
      acc[m.id].matchSet.add(matchId);
    }

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
    // Filter to matches that have a CricHeroes ID and are completed.
    // Internal (Dhurandhars vs Baazigars) matches are deliberately EXCLUDED so
    // the club's El Clasico games never pollute season/external player stats —
    // they're tracked separately via the Internal Rivalry views.
    const eligible = matches.filter(m =>
      m.ch_match_id &&
      m.match_type !== 'internal' &&
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

    // Resolve a scorecard row to a member. Order of trust:
    //   1. CricHeroes player_id (authoritative — never collides)
    //   2. admin's manual nameMap override
    //   3. fuzzy name matching
    const resolveRow = (chName: string, playerId?: number | null): Member | null => {
      if (playerId != null) {
        const byId = CH_PLAYER_TO_MEMBER[playerId];
        if (byId && memberById[byId]) return memberById[byId];
      }
      const mapped = nameMap[chName];
      if (mapped && memberById[mapped]) return memberById[mapped];
      return matchPlayer(chName, members);
    };
    // Name-only resolver for fielding (dismissal text has no player_id).
    const resolveName = (chName: string): Member | null => resolveRow(chName, null);

    const acc: Record<string, Acc> = {};
    const unmatchedSet = new Set<string>();
    let errors = 0;

    // ── Preload detailed scorecards from the DB ──────────────────────────────
    // The match_scorecards table is populated reliably by the server-side
    // scripts/sync_scorecards.py (the daily sync). Reading from it — instead of
    // re-fetching every match live from the CricHeroes edge function — is both
    // far faster (one query vs 50+ sequential network calls) and far more
    // reliable: a single transient edge-function failure used to silently drop
    // a match's wickets/runs, undercounting the season leaderboard. We only
    // fall back to the live edge fetch for matches not yet in the table
    // (e.g. one that just finished and hasn't been scorecard-synced yet).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scByChId = new Map<string, Record<string, any>>();
    const chIds = eligible.map(m => String(m.ch_match_id)).filter(Boolean);
    if (chIds.length) {
      const { data: scRows } = await supabase
        .from('match_scorecards')
        .select('ch_match_id, innings1_team_name, innings1_batting, innings1_bowling, innings2_team_name, innings2_batting, innings2_bowling')
        .in('ch_match_id', chIds);
      for (const r of scRows ?? []) scByChId.set(String(r.ch_match_id), r);
    }

    // Build the [{ teamName, batting, bowling }] shape the aggregator expects
    // from a stored match_scorecards row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildScorecard = (r: Record<string, any>) => [
      { teamName: r.innings1_team_name, batting: r.innings1_batting ?? [], bowling: r.innings1_bowling ?? [] },
      { teamName: r.innings2_team_name, batting: r.innings2_batting ?? [], bowling: r.innings2_bowling ?? [] },
    ].filter(inn => inn.teamName);

    for (let i = 0; i < eligible.length; i++) {
      const match = eligible[i];
      setProgress(p => ({ ...p, done: i, message: `Processing ${i + 1} / ${eligible.length} matches…` }));

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let scorecard: Array<Record<string, any>> | undefined;

        const stored = scByChId.get(String(match.ch_match_id));
        if (stored) {
          scorecard = buildScorecard(stored);
        } else {
          // Fallback: match not yet in match_scorecards — fetch it live.
          const res = await fetch(
            `${supabaseUrl}/functions/v1/cricheroes?matchId=${match.ch_match_id}&type=scorecard`,
            { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pp = await res.json() as Record<string, any>;
          scorecard = pp?.scorecard as Array<Record<string, any>> | undefined;
        }
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
              const member = resolveRow(String(b.name ?? ''), b.player_id != null ? Number(b.player_id) : null);
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
              const member = resolveRow(String(b.name ?? ''), b.player_id != null ? Number(b.player_id) : null);
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

      // Polite delay only when we hit the live edge-function fallback —
      // DB reads from match_scorecards don't need throttling.
      if (!scByChId.has(String(match.ch_match_id)) && i < eligible.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
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
          fielding_caught_behind: s.caughtBehind,
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
