import type { Match } from '../types';

// ─── When to turn up ──────────────────────────────────────────────────────────
// Kickoff can come from two places: the match itself, or the ground slot it was
// booked into. The match wins when it is set — somebody typed it deliberately —
// and the booking is the fallback for the home fixtures where nobody ever needs
// to.

/** '07:00' -> '7:00 AM'. Returns null for anything unparseable. */
export function prettyTime(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** What to show a member: the match's own time, else the booked slot's. */
export function matchTimeLabel(
  match: Pick<Match, 'start_time'> | null | undefined,
  slotTimeSlot?: string | null,
): string | null {
  return prettyTime(match?.start_time) ?? (slotTimeSlot || null);
}
