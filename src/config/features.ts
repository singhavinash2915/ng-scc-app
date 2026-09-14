// ─── Feature flags ─────────────────────────────────────────────────────────────
// One place to switch parts of the app on and off. Set a flag to `false` and the
// page disappears from the nav AND its route redirects home — no code deleted,
// so anything can be switched back on next season by flipping one value.
//
// Seasonal features (Season Finale, Awards Night, Fantasy Draft) live here so we
// can retire them cleanly once the season's moment has passed.

export const FEATURES = {
  // ── Seasonal / time-boxed ────────────────────────────────────────────────
  /** Season Finale + Awards Night reveal. Done for 2025-26 — the Champions
   *  page (/awards) carries the winners from here on. */
  seasonFinale: false,
  /** Fantasy Draft league. OFF — its own rule was "drafting open until the
   *  first ball", and that was 12 September 2026. Nobody drafted a side
   *  (fantasy_teams is empty) and no page ever linked to it, so it sat behind
   *  a URL counting down to a deadline that had passed. Turn it back on with a
   *  season's draft window and a link from somewhere people look. */
  fantasy: false,
  /** Pre-season Kickoff Hub — a countdown to the first ball. OFF: the first
   *  ball was bowled on 12 September 2026, and the page was still promoting
   *  Auction Night on 7 August and a draft to do "before the first ball". A
   *  countdown to a date in the past is the clearest kind of stale. Nothing is
   *  lost — the auction, the league and the goals all have their own pages. */
  seasonKickoff: false,
  /** Season Awards champions showcase. */
  seasonAwards: true,
  /** SCC League — auction-based internal two-team rivalry.
   *  LIVE — registration + captain voting open for 2026-27. */
  sccLeague: true,

  // ── Core cricket ─────────────────────────────────────────────────────────
  honours: true,        // combined Rankings + Pressure Index + Hall of Fame
  leaderboard: true,
  predictions: true,
  league: true,
  aiInsights: true,

  // ── Club ops ─────────────────────────────────────────────────────────────
  /** Online card/UPI top-ups through Razorpay. OFF — nobody used it, and the
   *  three edge functions behind it were deleted rather than carried to the new
   *  Supabase project, so the page would only fail if it were reachable. Members
   *  top up in person and an admin records the deposit. Turning this back on
   *  means redeploying those functions and setting the three Razorpay secrets. */
  onlinePayments: false,
  finance: true,
  feeTracking: true,
  groundBooking: true,

  // ── Live ─────────────────────────────────────────────────────────────────
  liveStreaming: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const isEnabled = (key: FeatureKey): boolean => FEATURES[key];
