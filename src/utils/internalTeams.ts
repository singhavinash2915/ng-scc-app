import type { Match } from '../types';

// ─── Who is actually playing an internal match ─────────────────────────────────
// The club now runs two internal competitions — the old Dhurandars vs Bazigars
// rivalry and SCC MahaSangram (Brahmos vs Agni) — and both are stored as
// match_type='internal'. Every screen used to print "Dhurandars vs Bazigars" for
// any internal fixture, so a MahaSangram match showed under teams that weren't
// playing in it.
//
// The names are already in the data: the sync writes `opponent` as
// "<side A> vs <side B>". Read them from there rather than hard-coding, and a
// third internal competition needs no code change at all.

const LEGACY = { home: 'Dhurandars', away: 'Bazigars' } as const;

export interface InternalSides {
  home: string;
  away: string;
  /** Short forms for tight spaces — first word of each. */
  homeShort: string;
  awayShort: string;
  /** "A vs B", ready to print. */
  label: string;
}

/** Strip the club prefix so cards read "Brahmos", not "SCC Brahmos". */
const tidy = (s: string) => s.replace(/^(SCC|Sangria)\s+/i, '').trim();

export function internalSides(match?: Pick<Match, 'opponent'> | null): InternalSides {
  const parts = (match?.opponent ?? '').split(/\s+vs\.?\s+/i)
    .map(tidy)
    .filter(Boolean);

  const home = parts[0] || LEGACY.home;
  const away = parts[1] || LEGACY.away;

  return {
    home, away,
    homeShort: home.split(/\s+/)[0],
    awayShort: away.split(/\s+/)[0],
    label: `${home} vs ${away}`,
  };
}
