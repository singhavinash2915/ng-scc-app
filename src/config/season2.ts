// ─── Season 2026-27 launch configuration ───────────────────────────────────────
// Single source of truth for the new season's identity and windows.

export const SEASON_NEW = '2026-27';
export const SEASON_PREV = '2025-26';

// Cricket season window: Sep 1 → Aug 31 (league runs Sep 2026 – Jun 2027).
export const SEASON_NEW_START = '2026-09-01';
export const SEASON_NEW_END = '2027-08-31';
export const SEASON_PREV_START = '2025-09-01';
export const SEASON_PREV_END = '2026-08-31';

// Auction Night — pre-season re-draft event (date TBC; late August).
export const AUCTION_NIGHT = {
  label: 'Late August 2026',
  confirmed: false,
};

// ─── SCC League captains ───────────────────────────────────────────────────────
// The 2026-27 election is over and the result is final, so the two captains are
// recorded here as a fact. Deriving them from the ballots would mean every page
// that names a captain has to read the vote table — the one thing we keep out of
// browsers. Team 1 first, in finishing order.
export const LEAGUE_CAPTAIN_IDS: readonly string[] = [
  '230629f4-cd80-4903-8b75-c485c75b2de7',   // AKASH JADHAV
  '7545cb6b-41fe-4102-b392-f560ae44805f',   // Avinash Singh
];

export const isLeagueCaptain = (id: string) => LEAGUE_CAPTAIN_IDS.includes(id);
