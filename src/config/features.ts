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
  /** Fantasy Draft league. Off for now; flip on to relaunch. */
  fantasy: false,
  /** Pre-season Kickoff Hub (countdown, predictions, goals, market values). */
  seasonKickoff: true,
  /** Season Awards champions showcase. */
  seasonAwards: true,
  /** Sangria Premier League — auction-based internal rivalry league. */
  spl: true,

  // ── Core cricket ─────────────────────────────────────────────────────────
  honours: true,        // combined Rankings + Pressure Index + Hall of Fame
  leaderboard: true,
  predictions: true,
  league: true,
  aiInsights: true,

  // ── Club ops ─────────────────────────────────────────────────────────────
  finance: true,
  feeTracking: true,
  groundBooking: true,

  // ── Live ─────────────────────────────────────────────────────────────────
  liveStreaming: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const isEnabled = (key: FeatureKey): boolean => FEATURES[key];
