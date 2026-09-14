// ─── The other team, on the scoring pad ───────────────────────────────────────
// In an external match half the deliveries involve players who are not in the
// club and whose names the scorer usually does not know. The pad used to offer
// only our squad for every picker, so after an opposition wicket "Who's in
// next?" could only be answered with an SCC name — and that batter's runs would
// have landed on one of ours.
//
// So the other side gets numbered placeholders: "Yashwin Stars batter 4",
// "Yashwin Stars bowler 2". They have to be UUIDs because the ball columns are,
// and they are deterministic so the same placeholder means the same player for
// the whole match without storing anything. Downstream they travel the guest
// path — player_id -1 on the scorecard — so no club figure can pick them up.

const BAT_PREFIX = '00000000-0000-4000-8000-0000000b';
const BOWL_PREFIX = '00000000-0000-4000-8000-0000000c';

export type OppositionRole = 'bat' | 'bowl';

export function oppositionId(role: OppositionRole, n: number): string {
  return (role === 'bat' ? BAT_PREFIX : BOWL_PREFIX) + String(n).padStart(4, '0');
}

export function isOppositionId(id: string | null | undefined): boolean {
  return !!id && (id.startsWith(BAT_PREFIX) || id.startsWith(BOWL_PREFIX));
}

export function oppositionLabel(id: string, team: string): string {
  const n = parseInt(id.slice(-4), 10);
  return `${team} ${id.startsWith(BAT_PREFIX) ? 'batter' : 'bowler'} ${n}`;
}

/** The placeholder players for one role, as picker entries. */
export function oppositionPlayers(role: OppositionRole, count: number, team: string) {
  return Array.from({ length: count }, (_, i) => {
    const id = oppositionId(role, i + 1);
    return { id, name: oppositionLabel(id, team), isGuest: false, isOpposition: true };
  });
}
