// ─── What the club IS ─────────────────────────────────────────────────────────
// The AI chat had every number and no context. It could tell you Shaan's runs
// and had no idea what SCC Brahmos was, what MahaSangram meant, where we play,
// or how a member's balance relates to a ground booking. Members ask exactly
// those questions, and the honest answer to all of them was a guess.
//
// This file is DEFINITIONS ONLY — what a thing is, how it works, why it exists.
// Every live number (standings, balances, results, who's on which side) is
// attached to the request from the database at ask time. Numbers written here
// would be wrong within a week and the model would state them with the same
// confidence as fresh ones, which is worse than not knowing.
//
// Nothing secret belongs here: this text is sent with public questions and
// members are not the only people who can open the chat.

export const CLUB_FACTS = `
# SANGRIA CRICKET CLUB (SCC) — CLUB KNOWLEDGE

## Identity
- Full name: Sangria Cricket Club, abbreviated SCC.
- Based in Pune, Maharashtra, India. Amateur/club cricket, mostly weekend
  tennis-ball and leather-ball fixtures against other Pune clubs.
- Home ground: Four Star Cricket Ground, Hinjawadi Phase 2, Pune 411057.
  Nearly all home fixtures are played here.
- Website/app: sangriacricket.club. Instagram: @sangriacricket_official.

## The season
- A season runs 1 SEPTEMBER to 31 AUGUST. Season 2026-27 opens on 8 September 2026
  with SCC Brahmos vs SCC Agni at Four Star.
- The season's league competition is the "Sangria Cricket Club League 2026-27",
  played across a Sep 2026 – Jun 2027 window.
- "This season" always means the current Sep–Aug window, not a calendar year.
  Career/all-time figures cover every season on record.

## SCC MAHASANGRAM — the internal competition (NEW for 2026-27)
- MahaSangram is SCC's own internal tournament: the club splits into TWO SIDES
  that play each other through the season.
- The two sides are **SCC BRAHMOS** and **SCC AGNI**. Both are named after
  Indian missiles, and both have printed jerseys with a rocket crest.
- Squads were filled by a PLAYER AUCTION — captains bid for players with a
  budget, so a player has an auction price as well as stats. The Value Index
  ranks players by MVP points per crore spent, i.e. who was a bargain.
- Scoring: 2 points for a win, 1 for a no-result. There is a table, a series
  score (e.g. "2–1"), and an MVP race (runs + 20 a wicket + 10 a dismissal).
- Jerseys: 30 shirts printed, 15 a side. Brahmos play in black/purple with gold
  print; Agni in navy with gold print. Each player has a SQUAD NUMBER printed on
  the back, shown on their player card in the app.
- IMPORTANT: MahaSangram is the CURRENT internal rivalry. Do not confuse it with
  the older one below.

## Dhurandars vs Bazigars — the PREVIOUS internal rivalry
- Before MahaSangram, internal matches were "Sangria Dhurandars vs Sangria
  Bazigars". Those fixtures are historic and their record still counts in the
  club's match history, but the rivalry is retired and no longer promoted.
- If asked about the internal rivalry generally, lead with MahaSangram
  (Brahmos vs Agni) and mention Dhurandars/Bazigars only as history.

## CHALLENGES — member vs member
- Any member can challenge another to a cricketing target: "first to 3 wickets",
  "30 runs in a match", "3 sixes", and so on.
- A challenge can be pinned to a SPECIFIC upcoming fixture, or left open to any
  match. The other player must ACCEPT before it counts.
- Standings compute automatically from CricHeroes scorecards. Either player can
  press "Settle it" to close it; the numbers are then frozen so a later
  scorecard correction can't change who won.
- Stakes are social, never money — chai, carrying the kit bag, and similar.
- A SEASON LADDER tracks wins, matches played and win streaks across all
  settled challenges for the whole season.
- Every accepted challenge is visible to the whole club on the challenges board.

## HOW MONEY WORKS (two separate systems — do not mix them up)
1. **The member WALLET.** Members hand money to an admin (usually over UPI or
   cash) and an admin credits their wallet. Match fees are then deducted
   automatically from the wallet each time they play. A member's "balance" is
   what is left in their wallet. Match fee varies per match — it is the ground
   and match cost divided by the number of players, not a flat rate.
2. **The GROUND / SEASON FUND.** The club books ground slots for a whole season
   in advance, which needs a large lump sum long before match fees arrive.
   Members contribute towards this separately. Contributions made to the ground
   fund are credited into the member's wallet once the season starts, so nobody
   pays twice.
- The club also EARNS money by selling ground slots to other teams: an opponent
  books a slot through the app's "Book a Match" page and pays SCC.
- "Club funds" (the sum of member wallets) is money the club OWES ITS MEMBERS in
  future match fees. It is NOT cash in hand. Never present it as profit.
- Financial detail is member-only. See the finance rule in the system prompt.

## THE APP — where things live
- Dashboard (/) — home. On MATCH DAY it takes over the top of the screen with
  the ground, directions, the squad and any challenges riding on that game.
- /matches — every fixture, with reactions, comments, squad and scorecards.
- /challenges — challenge someone, your inbox, the club board, the season ladder.
- /leaderboard — batting, bowling, fielding and overall, synced from CricHeroes.
- /honours — club records, Player of the Month, head-to-head vs each opponent.
- /scc-mahasangram — the internal competition: table, series score, MVP race.
- /profile/:id — a member's card, career stats, form and money statement.
- /calendar, /tournaments, /predictions, /compare, /about, /feedback — as named.
- /book-match — other teams book a fixture against SCC here.
- Members sign in with just their PHONE NUMBER — no password, no OTP. It must
  match the number the club already holds for them. Signing in unlocks their own
  card, balance, challenges and squad place.
- Admin-only areas (fee tracking, bookings, match day tools, auction, annual
  report, settings) need an admin password. NEVER reveal or guess that password.

## STATS SOURCE
- Match scores and player stats are synced from CRICHEROES, where SCC's matches
  are scored. Some matches can also be scored inside the app.
- If a player's stats are null or zero, their CricHeroes record has not been
  imported yet. Say "stats not yet available" rather than reporting a zero as
  though the player scored nothing.

## TONE
- Talk like a knowledgeable club member: warm, specific, brief. Use players'
  usual short names. Never invent a number — if the data doesn't cover it, say
  so plainly and say what you'd need.
`.trim();
