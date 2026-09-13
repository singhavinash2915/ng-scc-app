// ─── The current season's league configuration ────────────────────────────────
// The four season constants used to be typed in: '2026-27', '2026-09-01' and so
// on. They were right the day they were written and would have gone on being
// 2026-27 for ever — every league page would have kept asking for last season's
// registrations after 1 September 2027, with nothing to show and no error. The
// club's rolling definition already knows what season it is, so take it.
import {
  CURRENT_SEASON, PREVIOUS_SEASON, CURRENT_SEASON_WINDOW, seasonWindow, seasonLabel,
} from './season';

export const SEASON_NEW = CURRENT_SEASON;
export const SEASON_PREV = PREVIOUS_SEASON;

// Cricket season window: Sep 1 → Aug 31.
export const SEASON_NEW_START = CURRENT_SEASON_WINDOW.start;
export const SEASON_NEW_END = CURRENT_SEASON_WINDOW.end;
export const SEASON_PREV_START = seasonWindow(PREVIOUS_SEASON).start;
export const SEASON_PREV_END = seasonWindow(PREVIOUS_SEASON).end;

// ─── Facts that belong to ONE season ──────────────────────────────────────────
// The rest of this file is not a window — it is a record of things that happened
// in a particular season: who won the election, which CricHeroes tournament the
// squads play in, when the auction was held. Those must NOT roll over with the
// date, or on 1 September the app would name last season's captains as this
// season's under a new label. They are stamped with the season they belong to
// and stand down when it passes.
export const LEAGUE_FACTS_SEASON = '2026-27';
export const LEAGUE_FACTS_CURRENT = LEAGUE_FACTS_SEASON === SEASON_NEW;

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
const CAPTAINS_2026_27: readonly string[] = [
  '230629f4-cd80-4903-8b75-c485c75b2de7',   // AKASH JADHAV
  '7545cb6b-41fe-4102-b392-f560ae44805f',   // Avinash Singh
];

// Empty once the season turns: a new season has no captains until it elects
// them, and every screen that names one already handles having none (the
// auction setup falls back to a picker). Naming last year's two would be worse
// than naming nobody.
export const LEAGUE_CAPTAIN_IDS: readonly string[] =
  LEAGUE_FACTS_CURRENT ? CAPTAINS_2026_27 : [];

export const isLeagueCaptain = (id: string) => LEAGUE_CAPTAIN_IDS.includes(id);

// ─── Auction running order ─────────────────────────────────────────────────────
// EMPTY ON PURPOSE — every name is drawn at random from the richest grade still
// on the table, and nobody, including the auctioneer, knows who is next.
//
// A hand-picked opening order was tried and dropped: once players can see the
// running order, whoever is called first looks chosen, and an auction that is
// meant to be even stops feeling that way. Random is the only version that
// needs no defending.
//
// Putting member ids in this list would script the opening sequence again.
// Don't, unless the whole squad has agreed to it.
export const AUCTION_RUNNING_ORDER: readonly string[] = [];

// ─── The internal tournament ───────────────────────────────────────────────────
// What the two auction squads actually play for. Named by the club; the
// CricHeroes link is where the scorecards live.
export const MAHASANGRAM = {
  name: 'SCC MahaSangram',
  // Derived, so the tagline can't claim 2026-27 while the app is in 2027-28.
  tagline: `Brahmos vs Agni · Season ${seasonLabel(LEAGUE_FACTS_SEASON)}`,
  /** Which season the CricHeroes ids below belong to. */
  season: LEAGUE_FACTS_SEASON,
  cricHeroesUrl: 'https://cricheroes.in/scorecard/26509825/scc-mahasangram/scc-agni-vs-scc-brahmos',
  /** CricHeroes ids, read off the tournament's own fixture feed. */
  tournamentId: 2154934,
  teamIds: {
    team1: 14361049,   // SCC Brahmos
    team2: 14361070,   // SCC Agni
  },
} as const;

// ─── How many take the field ───────────────────────────────────────────────────
// SCC plays TWELVE, not eleven — a club rule, so more of the squad gets a game.
// Anything that picks a side (Best XII, AI squad selector, fantasy) should size
// itself from here rather than assuming the standard eleven.
export const PLAYING_SIZE = 12;
export const PLAYING_LABEL = 'XII';
