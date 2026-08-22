import type { ChallengeRow } from '../hooks/useChallenges';

// ─── The season ladder ────────────────────────────────────────────────────────
// A challenge settles, both players see who won, and then it disappears into a
// list. Nothing carries from one to the next, so a member who has won five in a
// row holds exactly the same position as someone who has never accepted one.
//
// The ladder is what makes a challenge cost something beyond its own stake:
// there is a table, you are on it, and today's match moves you. It's derived
// entirely from settled challenges — no new table, nothing to maintain, and it
// cannot disagree with the results it's built from.

export interface LadderRow {
  memberId: string;
  played: number;
  won: number;
  /** Trailing run of wins — the number worth putting on a card. */
  streak: number;
  bestStreak: number;
  winRate: number;
}

/**
 * Only settled challenges count. Counting live ones would let someone climb by
 * accepting a lot and finishing nothing, which is the opposite of the point.
 */
export function buildLadder(rows: ChallengeRow[]): LadderRow[] {
  const settled = rows
    .filter(r => r.status === 'settled')
    // Oldest first: a streak is a sequence, so the order has to be real.
    // Falling back to closes_on keeps rows settled before settled_at existed
    // in a sensible place rather than bunching them at the epoch.
    .sort((a, b) => (a.settled_at ?? a.closes_on ?? '').localeCompare(
                     b.settled_at ?? b.closes_on ?? ''));

  const acc = new Map<string, LadderRow & { run: number }>();
  const seed = (id: string) => {
    let r = acc.get(id);
    if (!r) { r = { memberId: id, played: 0, won: 0, streak: 0, bestStreak: 0, winRate: 0, run: 0 };
              acc.set(id, r); }
    return r;
  };

  for (const c of settled) {
    // Only players who actually agreed. Someone who declined was never in it.
    const players = (c.players ?? []).filter(p => p.accepted).map(p => p.member_id);
    // A challenge nobody won (nobody qualified) still counts as played — it
    // happened, and hiding it would make the played column disagree with the
    // list of challenges above it.
    for (const id of players) {
      const r = seed(id);
      r.played += 1;
      if (c.winner_id === id) {
        r.won += 1;
        r.run += 1;
        r.bestStreak = Math.max(r.bestStreak, r.run);
      } else {
        r.run = 0;
      }
    }
  }

  return [...acc.values()]
    .map(({ run, ...r }) => ({ ...r, streak: run, winRate: r.played ? r.won / r.played : 0 }))
    // Wins first, then rate: five from five should sit above five from twelve,
    // but nobody should be able to top the table on a single lucky challenge.
    .sort((a, b) => b.won - a.won || b.winRate - a.winRate || b.played - a.played);
}
