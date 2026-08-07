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

// ─── Auction running order ─────────────────────────────────────────────────────
// The order the auctioneer wants for the real night, set by hand: the Icons
// first, then the Grade B men, and Grade C left to the random draw so the tail
// of the auction still has surprises in it.
//
// Anyone on this list comes up in exactly this order. Once they are all gone the
// draw falls back to picking at random within the richest band still on the
// table. An empty list = fully random, which is what a rehearsal should use.
export const AUCTION_RUNNING_ORDER: readonly string[] = [
  '6ee157f3-e24c-4f1b-aad8-542145f5c828',   // Prateek Singh              · ₹1 Cr
  '5d623102-766a-4243-83ef-2fb941ae96f3',   // Shaan                      · ₹2 Cr
  '04e8130d-78c4-44b7-a54e-e50c206941c6',   // Soumyaranjan Mohapatra     · ₹2 Cr
  '1046e698-8d6e-4f14-8c2d-c7759764f02e',   // Rohan Rao                  · ₹1 Cr
  '1c6cb1c4-f523-4b16-9997-0764190931fc',   // Raushan Kumar              · ₹1 Cr
  '1f68f840-b4ec-49a2-bcde-49d7fcf17dd0',   // Sushil Yadav               · ₹1 Cr
  '6571e062-9ac5-414f-b0d6-12e53b680327',   // Niraj Prakash Parmeshwar   · ₹1 Cr
  'da957ad5-baa8-44b9-9dc6-56f2afa6e7ea',   // Honey Porwal               · ₹50 L
  '69035791-1be6-4cab-8315-120eccefe44b',   // Aprmay Kumar               · ₹50 L
  '85762f91-6b6d-46fe-a6cf-9a2b38f07338',   // Vaibhav Shrivastav         · ₹50 L
  '329137e8-ea3d-4a68-94a3-718e24e610cb',   // Adarsh Dwivedi             · ₹50 L
  'b8c4f216-25f5-4e85-881c-4973ab4cb042',   // Aditya Purohit             · ₹50 L
  'e412ba18-86c9-4896-ad06-f687b0bdc88c',   // Saurabh Lele               · ₹50 L
  '8cfc8965-bb5b-4718-a2ba-d1ca202760a5',   // Nikhil                     · ₹50 L
];
