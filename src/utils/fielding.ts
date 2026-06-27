// Shared "Best Fielder" logic.
//
// Wicket-keepers rack up caught-behind catches that are stored as ordinary
// catches, which lets them dominate any fielding ranking. We can't separate
// keeper catches from outfield catches in the stored data, so anyone who has
// kept wicket (has stumpings) is treated as a keeper and excluded from
// "Best Fielder", and the fielding score counts catches + run-outs only
// (stumpings are keeper-specific).

interface FieldingLike {
  fielding_catches: number;
  fielding_stumpings: number;
  fielding_run_outs: number;
}

export function isWicketKeeper(s: FieldingLike): boolean {
  return (s.fielding_stumpings ?? 0) > 0;
}

// Outfield dismissals — the metric for Best Fielder (excludes stumpings).
export function outfieldDismissals(s: FieldingLike): number {
  return (s.fielding_catches ?? 0) + (s.fielding_run_outs ?? 0);
}

// Filter a stats list down to genuine outfielders (non-keepers).
export function outfieldersOnly<T extends FieldingLike>(rows: T[]): T[] {
  return rows.filter(s => !isWicketKeeper(s));
}
