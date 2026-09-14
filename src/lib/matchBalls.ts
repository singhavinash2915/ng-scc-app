import { supabase } from './supabase';
import { DEFAULT_FORMAT } from './cricketRules';
import { matchPlayerName } from './nameMatch';
import { isOppositionId, oppositionLabel } from './opposition';
import { internalSides } from '../utils/internalTeams';
import type { Member } from '../types';
import type { Format } from './pressure';
import type { FieldEvent, InningsRow, StoredBall } from './matchImpact';

// ─── Every ball of a match, whichever way it was scored ───────────────────────
// Two sources, one shape:
//
//   app         scc_ball_by_ball — scored on our pad; player ids are member,
//               guest or opposition-placeholder ids
//   cricheroes  ch_balls — CricHeroes' commentary with the missing wicket balls
//               rebuilt from the scorecard (scripts/sync_ch_balls.py); player
//               ids are CricHeroes keys, mapped to members here by name
//
// The app source wins when a match has both: it is ball-exact by construction.
// CricHeroes is the normal case — the pad is the fallback for when it is down.

export const SCC_TEAM_ID = 7927431;
const PAGE = 1000;

export interface MatchBalls {
  source: 'app' | 'cricheroes';
  /** 'exact' for the pad; the rebuild's own verdict for CricHeroes. */
  quality: 'exact' | 'close' | 'partial';
  matchId: string;
  date: string;
  opponent: string;
  fmt: Format;
  rows: InningsRow[];
  balls: StoredBall[];
  events: FieldEvent[];
  /** Display name for any player key. */
  name: (key: string) => string;
  /** Display name for a side key. */
  sideName: (key: string) => string;
  /** Member id for a player key, when that player is one of ours. */
  memberOf: (key: string) => string | null;
  /** Whether a side key is SCC (always true for internal matches). */
  isClubSide: (key: string) => boolean;
}

type MatchRow = {
  id: string; date: string; opponent: string | null; match_type: string | null;
  overs_per_innings: number | null; players_per_side: number | null; ch_match_id: string | null;
};
type ChMatch = {
  ch_match_id: string; match_id: string | null; quality: 'exact' | 'close' | 'partial';
  players: Record<string, { name: string; team_id: number | null }>;
  innings: Array<{ innings: number; team_id: number; team_name: string | null; target: number | null; match_overs?: number | null }>;
};

/** PostgREST returns at most 1000 rows; a season of balls is many thousands. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

const fmtOf = (m: MatchRow): Format => ({
  oversPerInnings: m.overs_per_innings ?? DEFAULT_FORMAT.oversPerInnings,
  playersPerSide: m.players_per_side ?? DEFAULT_FORMAT.playersPerSide,
});

const looksLikeScc = (name: string | null | undefined) => /sangria|\bscc\b/i.test(name ?? '');

function fromCricHeroes(m: MatchRow, ch: ChMatch, balls: StoredBall[], members: Member[]): MatchBalls {
  const internal = m.match_type === 'internal';
  const teamName: Record<string, string> = {};
  const club = new Set<string>();
  for (const i of ch.innings) {
    const k = String(i.team_id);
    teamName[k] = i.team_name ?? k;
    if (internal || i.team_id === SCC_TEAM_ID || looksLikeScc(i.team_name)) club.add(k);
  }
  const cache = new Map<string, string | null>();
  const memberOf = (key: string) => {
    if (cache.has(key)) return cache.get(key)!;
    const p = ch.players[key];
    // Only our side's players can be members: an opponent who shares a name
    // with one of ours must never pick up our player's figures.
    const ours = p && (club.has(String(p.team_id)) || (p.team_id == null && club.size === 2));
    const id = ours ? matchPlayerName(p.name, members)?.id ?? null : null;
    cache.set(key, id);
    return id;
  };
  const rows: InningsRow[] = ch.innings.map(i => {
    const other = ch.innings.find(x => x.innings !== i.innings);
    return { innings: i.innings, batting_team: String(i.team_id), bowling_team: other ? String(other.team_id) : 'other', target: i.target };
  });
  return {
    source: 'cricheroes', quality: ch.quality, matchId: m.id, date: m.date,
    opponent: m.opponent ?? 'Opponent', rows, balls, events: [],
    // Overs actually bowled beat the fixture row, which says 16 for most matches.
    fmt: { ...fmtOf(m), oversPerInnings: Math.max(...ch.innings.map(i => i.match_overs ?? 0)) || fmtOf(m).oversPerInnings },
    name: key => ch.players[key]?.name ?? (key.startsWith('n:') ? key.slice(2) : 'Unknown'),
    sideName: key => teamName[key] ?? key,
    memberOf, isClubSide: key => club.has(key),
  };
}

function fromApp(
  m: MatchRow, rows: InningsRow[], balls: StoredBall[], events: FieldEvent[],
  members: Member[], guests: Record<string, string>,
): MatchBalls {
  const internal = m.match_type === 'internal';
  const s2 = internalSides(m as never);
  const home = internal ? s2.home : 'Sangria CC';
  const away = internal ? s2.away : (m.opponent || 'Opponent');
  const memberIds = new Set(members.map(x => x.id));
  const names: Record<string, string> = Object.fromEntries(members.map(x => [x.id, x.name]));
  return {
    source: 'app', quality: 'exact', matchId: m.id, date: m.date,
    opponent: m.opponent ?? 'Opponent', fmt: fmtOf(m), rows, balls, events,
    name: key => isOppositionId(key) ? oppositionLabel(key, away)
      : names[key] ?? (guests[key] ? `${guests[key]} (guest)` : 'Unknown'),
    sideName: key => (key === 'home' ? home : away),
    memberOf: key => (memberIds.has(key) ? key : null),
    isClubSide: key => internal || key === 'home',
  };
}

async function loadMembers(): Promise<Member[]> {
  const { data } = await supabase.from('members').select('id, name, status');
  return (data ?? []) as Member[];
}

/** One match, by its CricHeroes id (what Match Centre is opened with). */
export async function loadMatchBalls(chMatchId: string): Promise<MatchBalls | null> {
  const { data: m } = await supabase.from('matches')
    .select('id, date, opponent, match_type, overs_per_innings, players_per_side, ch_match_id')
    .eq('ch_match_id', chMatchId).limit(1).maybeSingle();
  if (!m) return null;
  const members = await loadMembers();

  const [inn, appBalls] = await Promise.all([
    supabase.from('scc_innings').select('innings, batting_team, target').eq('match_id', m.id),
    all<StoredBall>((f, t) => supabase.from('scc_ball_by_ball').select('*').eq('match_id', m.id).order('seq').range(f, t)),
  ]);
  if (appBalls.length && inn.data?.length) {
    const [ev, g] = await Promise.all([
      supabase.from('scc_field_events').select('innings, seq, kind, fielder_id, runs').eq('match_id', m.id),
      supabase.from('match_guests').select('guest_id, guest:guests(name)').eq('match_id', m.id),
    ]);
    const guests: Record<string, string> = {};
    for (const x of (g.data ?? []) as Array<{ guest_id: string; guest: { name: string } | { name: string }[] | null }>) {
      const gg = Array.isArray(x.guest) ? x.guest[0] : x.guest;
      guests[x.guest_id] = gg?.name ?? 'Guest';
    }
    return fromApp(m, inn.data, appBalls, ev.error ? [] : (ev.data ?? []) as FieldEvent[], members, guests);
  }

  const { data: ch } = await supabase.from('ch_ball_matches').select('*').eq('ch_match_id', chMatchId).maybeSingle();
  if (!ch) return null;
  const balls = await all<StoredBall>((f, t) =>
    supabase.from('ch_balls').select('*').eq('ch_match_id', chMatchId).order('innings').order('seq').range(f, t));
  return balls.length ? fromCricHeroes(m, ch as ChMatch, balls, members) : null;
}

/** Every match with balls in a date window — for the season tables. */
export async function loadSeasonBalls(start: string, end: string): Promise<MatchBalls[]> {
  const members = await loadMembers();
  const out: MatchBalls[] = [];

  // App-scored first; any match found here is skipped on the CricHeroes side.
  const inns = await all<{ match_id: string; innings: number; batting_team: string; target: number | null; match: MatchRow & { result: string } }>((f, t) =>
    supabase.from('scc_innings')
      .select('match_id, innings, batting_team, target, match:matches!inner(id, date, opponent, match_type, overs_per_innings, players_per_side, ch_match_id, result)')
      .gte('match.date', start).lte('match.date', end).range(f, t));
  const appMatches = new Map<string, typeof inns>();
  for (const r of inns) {
    if (['upcoming', 'cancelled'].includes(r.match.result)) continue;
    appMatches.set(r.match_id, [...(appMatches.get(r.match_id) ?? []), r]);
  }
  if (appMatches.size) {
    const ids = [...appMatches.keys()];
    const [balls, ev] = await Promise.all([
      all<StoredBall & { match_id: string }>((f, t) => supabase.from('scc_ball_by_ball').select('*').in('match_id', ids).order('seq').range(f, t)),
      supabase.from('scc_field_events').select('match_id, innings, seq, kind, fielder_id, runs').in('match_id', ids),
    ]);
    for (const [id, list] of appMatches) {
      const mb = balls.filter(b => b.match_id === id);
      if (!mb.length) continue;
      const evs = ev.error ? [] : ((ev.data ?? []) as Array<FieldEvent & { match_id: string }>).filter(e => e.match_id === id);
      out.push(fromApp(list[0].match, list, mb, evs, members, {}));
    }
  }

  const chm = await all<ChMatch & { match: MatchRow }>((f, t) =>
    supabase.from('ch_ball_matches')
      .select('*, match:matches!inner(id, date, opponent, match_type, overs_per_innings, players_per_side, ch_match_id)')
      .gte('match.date', start).lte('match.date', end).range(f, t));
  const todo = chm.filter(c => !appMatches.has(c.match.id));
  if (todo.length) {
    const ids = todo.map(c => c.ch_match_id);
    const balls: Array<StoredBall & { ch_match_id: string }> = [];
    // In chunks: a long IN list makes the URL too long for the gateway.
    for (let i = 0; i < ids.length; i += 20) {
      balls.push(...await all<StoredBall & { ch_match_id: string }>((f, t) =>
        supabase.from('ch_balls').select('*').in('ch_match_id', ids.slice(i, i + 20))
          .order('ch_match_id').order('innings').order('seq').range(f, t)));
    }
    const byMatch = new Map<string, StoredBall[]>();
    for (const b of balls) byMatch.set(b.ch_match_id, [...(byMatch.get(b.ch_match_id) ?? []), b]);
    for (const c of todo) {
      const mb = byMatch.get(c.ch_match_id);
      if (mb?.length) out.push(fromCricHeroes(c.match, c, mb, members));
    }
  }
  return out;
}
