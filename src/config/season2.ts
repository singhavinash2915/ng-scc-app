// ─── Season 2026-27 launch configuration ───────────────────────────────────────
// Single source of truth for the new season's identity and windows.

export const SEASON_NEW = '2026-27';
export const SEASON_PREV = '2025-26';

// Cricket season window: Sep 1 → Aug 31 (league runs Sep 2026 – Jun 2027).
export const SEASON_NEW_START = '2026-09-01';
export const SEASON_NEW_END = '2027-08-31';
export const SEASON_PREV_START = '2025-09-01';
export const SEASON_PREV_END = '2026-08-31';

// Auction Night — the live draft. Friday 7 Aug 2026, 9 PM IST on Google Meet.
// startsAt is the exact instant, in UTC (9 PM IST = 15:30 UTC), so the poster
// counts down to the right moment on every device.
export const AUCTION_NIGHT = {
  label: 'Friday · 9 PM IST',
  confirmed: true,
  startsAt: new Date('2026-08-07T15:30:00Z'),
  meetUrl: 'https://meet.google.com/zue-ypka-uza',
};

// The two elected captains have named their sides. These are the auction
// defaults; the setup screen still lets the auctioneer override on the night.
export const LEAGUE_TEAM_NAMES = {
  team1: 'SCC Brahmos',   // AKASH JADHAV
  team2: 'SCC Agni',      // Avinash Singh
} as const;

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
