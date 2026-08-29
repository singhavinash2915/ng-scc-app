import type { Match, Member } from '../types';

// ─── Answers that need no model ───────────────────────────────────────────────
// "Who captains Brahmos", "when do we play next", "what's my balance" are
// database lookups wearing a question mark. Sending 37,000 tokens to a language
// model so it can read one field back is the expensive way to do a SELECT.
//
// These run locally, cost nothing, return instantly, and — being computed
// rather than generated — cannot be subtly wrong about a number.
//
// The rule throughout: only answer when CERTAIN. Every matcher requires enough
// signal to be unambiguous, and anything else returns null and falls through to
// the model. A fast wrong answer is worse than a slow right one, especially
// about money or who is playing.

export interface QuickContext {
  members: Member[];
  matches: Match[];
  squads: Array<{ name: string; captain: string | null; players: Array<{ name: string; isCaptain: boolean }> }>;
  /** date (YYYY-MM-DD) -> member ids away that day */
  awayOn: (date: string) => Set<string>;
  awayRows: Array<{ member_id: string; from_date: string; to_date: string; reason: string | null }>;
  upcomingSlots: Array<{ date: string; time_slot: string | null; venue: string | null }>;
  seasonStats: Array<{ member_id: string; batting_runs: number; bowling_wickets: number }>;
  careerStats: Array<{ member_id: string; batting_runs: number; bowling_wickets: number }>;
  me: Member | null;
  isAdmin: boolean;
}

const norm = (q: string) => q.toLowerCase().replace(/[^\w\s'’]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q: string, ...w: string[]) => w.every(x => q.includes(x));
const any = (q: string, ...w: string[]) => w.some(x => q.includes(x));

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pretty = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' });

const MONTHS = ['january','february','march','april','may','june',
                'july','august','september','october','november','december'];

/** Returns an answer, or null to let the model handle it. */
export function quickAnswer(question: string, c: QuickContext): string | null {
  const q = norm(question);
  if (!q) return null;

  // ── Captains ────────────────────────────────────────────────────────────
  if (has(q, 'captain')) {
    const wantsBrahmos = q.includes('brahmos');
    const wantsAgni = q.includes('agni');
    if (wantsBrahmos || wantsAgni) {
      const side = c.squads.find(s =>
        s.name.toLowerCase().includes(wantsBrahmos ? 'brahmos' : 'agni'));
      if (side?.captain) return `${side.captain} captains ${side.name}.`;
    }
    // "who are the captains" — both, only when we have both.
    if (c.squads.length === 2 && c.squads.every(s => s.captain)) {
      return c.squads.map(s => `${s.captain} captains ${s.name}.`).join('\n');
    }
  }

  // ── Next match ──────────────────────────────────────────────────────────
  if (any(q, 'next match', 'next game', 'next fixture')
      || has(q, 'when', 'play') || has(q, 'when', 'next')) {
    const today = new Date().toLocaleDateString('en-CA');
    const fixture = c.matches
      .filter(m => m.result === 'upcoming' && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const slot = c.upcomingSlots.find(s => s.date >= today);
    if (fixture) {
      const at = c.upcomingSlots.find(s => s.date === fixture.date);
      const days = Math.round(
        (new Date(fixture.date + 'T00:00:00').getTime() - Date.now()) / 86400000);
      return [
        `Next up: **${fixture.opponent || 'SCC'}** on ${pretty(fixture.date)}`
          + (at?.time_slot ? `, ${at.time_slot}` : ''),
        at?.venue || fixture.venue ? `at ${at?.venue || fixture.venue}.` : '',
        days > 0 ? `That's ${days} day${days === 1 ? '' : 's'} away.` : 'That’s today.',
      ].filter(Boolean).join(' ');
    }
    if (slot) {
      return `No opponent booked yet, but the ground is booked for ${pretty(slot.date)}`
        + (slot.time_slot ? `, ${slot.time_slot}.` : '.');
    }
  }

  // ── Who's away ──────────────────────────────────────────────────────────
  if (any(q, 'away', 'unavailable', 'travelling', 'traveling')) {
    const month = MONTHS.findIndex(m => q.includes(m));
    if (month >= 0) {
      // Whichever occurrence of that month is next — a question asked in
      // August about November means this coming November.
      const now = new Date();
      const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      const rows = c.awayRows.filter(r => {
        const from = new Date(r.from_date + 'T00:00:00');
        const to = new Date(r.to_date + 'T00:00:00');
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return from <= end && to >= start;
      });
      const label = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)}`;
      if (rows.length === 0) return `Nobody has blocked any dates in ${label}.`;
      if (!c.isAdmin) {
        return `${rows.length} member${rows.length === 1 ? ' has' : 's have'} blocked dates in ${label}. `
          + `Who they are is visible to club admins.`;
      }
      const byId = new Map(c.members.map(m => [m.id, m.name]));
      const lines = rows
        .sort((a, b) => a.from_date.localeCompare(b.from_date))
        .map(r => `- **${byId.get(r.member_id) ?? 'Unknown'}** — `
          + `${pretty(r.from_date)} to ${pretty(r.to_date)}`
          + (r.reason ? ` (${r.reason})` : ''));
      return `Away in ${label}:\n${lines.join('\n')}`;
    }
  }

  // ── Most runs / most wickets ────────────────────────────────────────────
  if (has(q, 'most') && any(q, 'run', 'wicket')) {
    const wickets = q.includes('wicket');
    const career = any(q, 'all time', 'all-time', 'career', 'ever');
    const rows = career ? c.careerStats : c.seasonStats;
    if (rows.length) {
      const byId = new Map(c.members.map(m => [m.id, m.name]));
      const top = [...rows]
        .sort((a, b) => (wickets ? b.bowling_wickets - a.bowling_wickets
                                 : b.batting_runs - a.batting_runs))[0];
      const val = wickets ? top.bowling_wickets : top.batting_runs;
      if (val > 0) {
        return `**${byId.get(top.member_id) ?? 'Unknown'}** — ${val} `
          + `${wickets ? 'wickets' : 'runs'} ${career ? 'across all seasons' : 'this season'}.`;
      }
    }
  }

  // ── Your own details ────────────────────────────────────────────────────
  if (any(q, 'my ', "i'm", 'i am') || q.startsWith('my')) {
    if (!c.me) return null;                       // signed out — let the model explain
    if (any(q, 'balance', 'wallet', 'money', 'owe')) {
      return `Your wallet balance is ${inr(c.me.balance)}.`;
    }
    if (any(q, 'jersey', 'number', 'shirt')) {
      const n = c.me.jersey_number;
      const side = c.me.jersey_team === 'brahmos' ? 'SCC Brahmos'
                 : c.me.jersey_team === 'agni' ? 'SCC Agni' : null;
      if (n != null && side) return `You're **#${n}** for **${side}**.`;
      if (n != null) return `Your squad number is **#${n}**.`;
    }
  }

  // ── Club record ─────────────────────────────────────────────────────────
  if (any(q, 'win rate', 'how many matches', 'won how many', 'our record')) {
    const done = c.matches.filter(m =>
      m.match_type !== 'internal' && ['won', 'lost', 'draw'].includes(m.result));
    const won = done.filter(m => m.result === 'won').length;
    const lost = done.filter(m => m.result === 'lost').length;
    const decisive = won + lost;
    if (done.length) {
      return `${c.matches.length} matches on record. Of the external ones: `
        + `**${won} won, ${lost} lost**`
        + (decisive ? ` — a ${Math.round((won / decisive) * 100)}% win rate.` : '.');
    }
  }

  return null;
}

/** The questions the club can answer instantly, shown as chips. */
export const INSTANT_QUESTIONS = [
  'Who is the captain of Brahmos?',
  'Who is the captain of Agni?',
  'When do we play next?',
  "Who's away in November?",
  'Who has the most wickets this season?',
  'What is my balance?',
];
