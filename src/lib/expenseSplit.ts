// ─── Splitting misc expenses across the people who used them ──────────────────
// Pure arithmetic, no database, so it can be tested exactly — which matters more
// here than anywhere else in the app. Money that moves out of a member's wallet
// has to be defensible to the rupee when a core member asks.
//
// Two shapes of expense, because they are consumed differently:
//
//   consumable   balls, drinks, ground staff. Used up in the month bought, so
//                the whole cost falls on that month's players.
//   season_item  bats, stumps, trophies. Used all season, so the cost is spread
//                evenly across the months left in the season and each slice is
//                charged to that month's players. Somebody who stops playing in
//                January pays for the months they played and nothing after.

import { SEASON_START_MONTH } from '../config/season';

export type ExpenseKind = 'consumable' | 'season_item';

export interface SplittableExpense {
  id: string;
  /** Positive rupees. Stored negative in the ledger; sign is handled at write. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  kind: ExpenseKind;
  category: string | null;
  description: string | null;
}

/** Season months, from the club's single definition. '2026-11' -> Sep 26–Aug 27. */
export function seasonOf(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const startYear = m >= SEASON_START_MONTH ? y : y - 1;
  const mm = String(SEASON_START_MONTH).padStart(2, '0');
  const endMonth = String(SEASON_START_MONTH - 1 || 12).padStart(2, '0');
  return { start: `${startYear}-${mm}`, end: `${startYear + 1}-${endMonth}` };
}

/** Inclusive count of months from a to b, both 'YYYY-MM'. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am) + 1;
}

export const periodOf = (isoDate: string) => isoDate.slice(0, 7);

/**
 * What this expense contributes to one month.
 *
 * A season item is spread over the months remaining in ITS season, counted from
 * the month it was bought. A bat bought in August with two months left is
 * therefore split over two months, not twelve — the club only gets two months
 * of use out of it this season.
 */
export function sliceFor(e: SplittableExpense, period: string): number {
  const bought = periodOf(e.date);
  if (e.kind === 'consumable') return bought === period ? round2(e.amount) : 0;

  const { end } = seasonOf(bought);
  const months = Math.max(1, monthsBetween(bought, end));
  if (period < bought || period > end) return 0;

  // Whole rupees per month, with the remainder loaded onto the earliest months
  // so the slices sum to the full amount and nothing is left stranded.
  const base = Math.floor(e.amount / months);
  const extra = Math.round(e.amount - base * months);
  const idx = monthsBetween(bought, period) - 1;      // 0-based month offset
  return base + (idx < extra ? 1 : 0);
}

export interface Share { memberId: string; appearances: number; amount: number }

/**
 * Divide a pot across members in proportion to appearances, in whole rupees,
 * summing to EXACTLY the pot.
 *
 * Largest remainder, not naive rounding: 1,940 over 96 appearances rounds down
 * to 1,932 and quietly loses 8 rupees. Over a season that is how a ledger
 * starts disagreeing with itself.
 */
export function splitPot(pot: number, appearances: Record<string, number>): Share[] {
  const total = Object.values(appearances).reduce((s, n) => s + n, 0);
  if (pot <= 0 || total <= 0) return [];

  const rows = Object.entries(appearances)
    .filter(([, n]) => n > 0)
    .map(([memberId, n]) => {
      const exact = (pot * n) / total;
      return { memberId, appearances: n, amount: Math.floor(exact), frac: exact - Math.floor(exact) };
    });

  let left = Math.round(pot) - rows.reduce((s, r) => s + r.amount, 0);
  // Biggest fractional part first; ties broken by more appearances, so the
  // spare rupee lands on someone who played more rather than at random.
  rows.sort((a, b) => b.frac - a.frac || b.appearances - a.appearances);
  for (let i = 0; left > 0 && i < rows.length; i++, left--) rows[i].amount += 1;

  return rows
    .filter(r => r.amount > 0)
    .map(({ memberId, appearances: n, amount }) => ({ memberId, appearances: n, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthPlan {
  period: string;
  pot: number;
  appearances: number;
  perAppearance: number;
  lines: Array<{ expense: SplittableExpense; slice: number }>;
  shares: Share[];
}

/** Everything a month-close needs, computed and checkable before anything posts. */
export function planMonth(
  period: string,
  expenses: SplittableExpense[],
  appearances: Record<string, number>,
): MonthPlan {
  const lines = expenses
    .map(e => ({ expense: e, slice: sliceFor(e, period) }))
    .filter(l => l.slice > 0);
  const pot = lines.reduce((s, l) => s + l.slice, 0);
  const totalApp = Object.values(appearances).reduce((s, n) => s + n, 0);
  return {
    period, pot, appearances: totalApp,
    perAppearance: totalApp ? pot / totalApp : 0,
    lines,
    shares: splitPot(pot, appearances),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
