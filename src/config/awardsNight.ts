// ─── Awards Night configuration ────────────────────────────────────────────
// Single source of truth for the Season Awards / Awards Night reveal.
//
// Everything crowd-facing — vote tallies, the People's picks, and the on-page
// award reveals — stays SEALED until `date`. Only an admin can peek before then.
// Voting stays OPEN the whole time; only the *results* are hidden.

export const AWARDS_NIGHT = {
  season: '2025-26',
  // Confirmed: Sat 18 July 2026, 5 PM — Awards Night at the Barguje Farms outing.
  date: '2026-07-18T17:00:00',
  // Voting is now CLOSED — set false to reopen. When closed, no new votes are
  // accepted anywhere and the /vote page shows a "voting closed" message.
  votingOpen: false,
  get label() {
    return new Date(this.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  },
};

/**
 * People's Award RESULTS are admin-only — they are NOT auto-revealed to the crowd
 * on the party date. The admin presents them live at the outing. (The data-driven
 * "Awards Night" cards still follow the date-based reveal via awardsRevealed.)
 */
export function peoplesAwardsVisible(isAdmin: boolean): boolean {
  return isAdmin;
}

/** True once the reveal is unlocked — on/after the party date, or always for admins. */
export function awardsRevealed(isAdmin: boolean, now: number = Date.now()): boolean {
  return isAdmin || now >= new Date(AWARDS_NIGHT.date).getTime();
}

/** True when an admin is seeing the reveal early (i.e. before the party date). */
export function isAdminPreview(isAdmin: boolean, now: number = Date.now()): boolean {
  return isAdmin && now < new Date(AWARDS_NIGHT.date).getTime();
}
