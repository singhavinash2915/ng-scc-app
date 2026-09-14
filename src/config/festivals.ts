// ─── Festivals the club marks ─────────────────────────────────────────────────
// A table, not a special case. The first one asked for was Ganesh Chaturthi, and
// building it as "the Ganesh banner" would mean writing the whole thing again in
// October for Diwali — and remembering to take the last one down.
//
// Each entry carries its own date, words and colours. A banner appears on the
// day and retires itself at midnight; nothing needs removing afterwards.
//
// Dates are lunar and move every year, so they are listed per year rather than
// computed. When the list runs out the feature simply goes quiet, which is the
// right failure: a wrong date on a festival greeting is worse than none.

export interface Festival {
  /** ISO date of the day itself. */
  date: string;
  /** Days the banner stays up, starting on `date`. Ganesh Chaturthi runs ten. */
  days: number;
  /** What it is called, in English. */
  name: string;
  /** The greeting, in Devanagari — the line the poster leads with. */
  greeting: string;
  /** The same words in Latin script, for anyone whose device has no Devanagari. */
  greetingLatin: string;
  /** A line that ties the day to the club. Kept cricketing, not preachy. */
  wish: string;
  /** Poster palette: a deep ground, a warm rise, and the accent metal. */
  colors: { deep: string; warm: string; accent: string; ink: string };
  /** Motifs drawn on the poster. No depiction of a deity — see FestivalPoster. */
  motifs: string[];
}

export const FESTIVALS: Festival[] = [
  {
    date: '2026-09-14',
    days: 10,                       // through to Anant Chaturdashi
    name: 'Ganesh Chaturthi',
    greeting: 'गणपति बाप्पा मोरया',
    greetingLatin: 'Ganpati Bappa Morya',
    wish: 'May the season ahead bring runs, wickets, and every obstacle cleared.',
    colors: { deep: '#4a1103', warm: '#c2410c', accent: '#fbbf24', ink: '#fff7ed' },
    motifs: ['ॐ', '🪔', '🌺'],
  },
  {
    date: '2026-11-08',
    days: 1,
    name: 'Diwali',
    greeting: 'शुभ दीपावली',
    greetingLatin: 'Shubh Deepavali',
    wish: 'Light, luck and a long batting line-up to the whole SCC family.',
    colors: { deep: '#3b0764', warm: '#a21caf', accent: '#fcd34d', ink: '#fdf4ff' },
    motifs: ['🪔', '✨', '🌸'],
  },
];

/** The festival to show today, if any. `today` is the club's local date. */
export function festivalFor(today: string): Festival | null {
  for (const f of FESTIVALS) {
    const start = new Date(f.date + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + f.days - 1);
    const d = new Date(today + 'T00:00:00');
    if (d >= start && d <= end) return f;
  }
  return null;
}

/** Which day of the festival today is — "Day 3 of 10" on a ten-day one. */
export function festivalDay(f: Festival, today: string): number {
  const start = new Date(f.date + 'T00:00:00');
  const d = new Date(today + 'T00:00:00');
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
}
