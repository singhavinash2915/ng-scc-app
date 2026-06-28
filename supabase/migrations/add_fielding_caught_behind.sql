-- Separate wicket-keeper catches (caught behind) from outfield catches so the
-- "Best Fielder" board reflects true outfielding and keepers get their own
-- "Best Wicket-Keeper" recognition.
--
-- CricHeroes already tracks these separately:
--   catches        -> outfield catches      (stored in fielding_catches)
--   caught_behind  -> keeper catches        (this new column)
--   stumpings      -> stored in fielding_stumpings
--
-- Run this in the Supabase SQL editor, then re-run scripts/sync_cricheroes.py
-- to populate it.

ALTER TABLE member_cricket_stats
  ADD COLUMN IF NOT EXISTS fielding_caught_behind integer NOT NULL DEFAULT 0;
