// ─── Awards Night configuration ────────────────────────────────────────────
// Single source of truth for the Season Awards / Awards Night reveal.
//
// Everything crowd-facing — vote tallies, the People's picks, and the on-page
// award reveals — stays SEALED until `date`. Only an admin can peek before then.
// Voting stays OPEN the whole time; only the *results* are hidden.

export const AWARDS_NIGHT = {
  season: '2025-26',
  // Confirmed: Sat 18 July 2026, at the Barguje Farms team outing.
  date: '2026-07-18T18:00:00',
  get label() {
    return new Date(this.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  },
};

/** True once the reveal is unlocked — on/after the party date, or always for admins. */
export function awardsRevealed(isAdmin: boolean, now: number = Date.now()): boolean {
  return isAdmin || now >= new Date(AWARDS_NIGHT.date).getTime();
}

/** True when an admin is seeing the reveal early (i.e. before the party date). */
export function isAdminPreview(isAdmin: boolean, now: number = Date.now()): boolean {
  return isAdmin && now < new Date(AWARDS_NIGHT.date).getTime();
}
