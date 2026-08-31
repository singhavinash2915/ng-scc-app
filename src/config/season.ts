// ─── When a season runs ───────────────────────────────────────────────────────
// One definition, because there were two. `season2.ts` said a season runs
// 1 Sep → 31 Aug while eight other files hard-coded 1 October, so the same
// match could belong to two different seasons depending on which screen you
// were looking at. With the 2026-27 season opening on 8 September that stops
// being academic: the opener itself would have been filed under last season by
// the Dashboard, Wrapped and the rankings.
//
// The boundary is 1 SEPTEMBER. Not the 8th — a season should start on a month
// boundary so "this month" and "this season" never disagree, and the first
// fixture can fall wherever it likes inside it.
//
// Everything that needs to know what season a date belongs to imports from
// here. Nothing hard-codes a date again.

/** Seasons begin on the 1st of this month. */
export const SEASON_START_MONTH: number = 9;   // September

/** '2026-09-08' -> '2026-27' */
export function seasonKeyOf(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const startYear = m >= SEASON_START_MONTH ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** '2026-27' -> { start: '2026-09-01', end: '2027-08-31' } */
export function seasonWindow(key: string): { start: string; end: string } {
  const startYear = Number(key.slice(0, 4));
  const mm = String(SEASON_START_MONTH).padStart(2, '0');
  const endMonth = SEASON_START_MONTH - 1 || 12;
  const lastDay = new Date(startYear + 1, endMonth, 0).getDate();
  return {
    start: `${startYear}-${mm}-01`,
    end: `${startYear + 1}-${String(endMonth).padStart(2, '0')}-${lastDay}`,
  };
}

const todayIso = () => new Date().toLocaleDateString('en-CA');

/** The season we are in right now, e.g. '2026-27'. */
export const CURRENT_SEASON = seasonKeyOf(todayIso());
export const CURRENT_SEASON_WINDOW = seasonWindow(CURRENT_SEASON);
export const PREVIOUS_SEASON = seasonKeyOf(
  `${Number(CURRENT_SEASON.slice(0, 4)) - 1}-${String(SEASON_START_MONTH).padStart(2, '0')}-01`);

/** Is this date inside the current season? */
export const inCurrentSeason = (isoDate: string) =>
  isoDate >= CURRENT_SEASON_WINDOW.start && isoDate <= CURRENT_SEASON_WINDOW.end;

/** '2026-27' -> '2026–27' for display. */
export const seasonLabel = (key: string) => key.replace('-', '–');
