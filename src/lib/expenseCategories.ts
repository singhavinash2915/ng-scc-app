import type { ExpenseKind } from './expenseSplit';

// ─── Expense categories ───────────────────────────────────────────────────────
// Each category carries its own default for how the cost is used up, because
// that is the part an admin shouldn't have to reason about at 11pm: balls are
// obviously consumed this month, a bat obviously lasts the season. The default
// can always be overridden on the form.
//
// `split: false` means the cost never reaches members — ground payments are
// already funded by match fees, and charging them again would bill the club
// twice for the same thing.

export interface ExpenseCategory {
  key: string;
  label: string;
  emoji: string;
  kind: ExpenseKind | null;   // null = not split across members
  hint: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: 'balls',        label: 'Balls',          emoji: '🏐', kind: 'consumable',
    hint: 'Used up by the matches that month' },
  { key: 'ground_staff', label: 'Ground staff',   emoji: '🧹', kind: 'consumable',
    hint: 'Groundsman, water, match-day bits' },
  { key: 'social',       label: 'Social',         emoji: '🎂', kind: 'consumable',
    hint: 'Cake, drinks, get-togethers' },
  { key: 'kit',          label: 'Bats & kit',     emoji: '🏏', kind: 'season_item',
    hint: 'Bats, stumps, pads — spread over the season' },
  { key: 'awards',       label: 'Awards',         emoji: '🏆', kind: 'season_item',
    hint: 'Trophies and prizes — spread over the season' },
  { key: 'ground',       label: 'Ground booking', emoji: '🏟️', kind: null,
    hint: 'Already covered by match fees — never split' },
  { key: 'other',        label: 'Other',          emoji: '📦', kind: 'consumable',
    hint: 'Anything else the club paid for' },
];

export const categoryOf = (key: string | null | undefined) =>
  EXPENSE_CATEGORIES.find(c => c.key === key) ?? null;
