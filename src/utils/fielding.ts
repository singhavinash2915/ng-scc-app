// Shared fielding definitions.
//
// CricHeroes tracks two kinds of catches separately:
//   fielding_catches        -> OUTFIELD catches
//   fielding_caught_behind  -> wicket-keeper catches (behind the stumps)
//
// So we DON'T exclude keepers from the fielding board — we simply count the
// right things. Best Fielder rewards outfield work; Best Wicket-Keeper rewards
// behind-the-stumps work.

interface FieldingLike {
  fielding_catches: number;
  fielding_caught_behind?: number;
  fielding_stumpings: number;
  fielding_run_outs: number;
}

// Best Fielder metric — outfield catches + run-outs.
export function outfieldDismissals(s: FieldingLike): number {
  return (s.fielding_catches ?? 0) + (s.fielding_run_outs ?? 0);
}

// Best Wicket-Keeper metric — catches behind the stumps + stumpings.
export function keeperDismissals(s: FieldingLike): number {
  return (s.fielding_caught_behind ?? 0) + (s.fielding_stumpings ?? 0);
}

// Has this player kept wicket at all? (used to surface keeper candidates)
export function hasKept(s: FieldingLike): boolean {
  return keeperDismissals(s) > 0;
}
