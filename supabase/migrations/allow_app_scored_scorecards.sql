-- ─── A scorecard the app produced doesn't have a CricHeroes id ───────────────
-- match_scorecards was built as a cache of CricHeroes' scorecards, so
-- ch_match_id is NOT NULL. Now that a match can be scored ball by ball in the
-- app, the same table holds cards that CricHeroes never saw: an internal game,
-- a fixture nobody put on CricHeroes, a match scored here because CricHeroes was
-- down. Those have no such id, and the insert is refused outright — the match
-- would be played, scored, and then have nowhere to publish its card.
--
-- Every fixture we have today does carry a CricHeroes id and will keep writing
-- it, which is what lets the stat sync find the card. This only stops the column
-- turning away the ones that genuinely have nothing to put in it.

BEGIN;

ALTER TABLE public.match_scorecards
  ALTER COLUMN ch_match_id DROP NOT NULL;

COMMENT ON COLUMN public.match_scorecards.ch_match_id IS
  'CricHeroes match id when the fixture has one — the key the stat sync uses. '
  'NULL for a match scored in the app that CricHeroes never had.';

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect is_nullable = YES.
SELECT column_name, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'match_scorecards' AND column_name IN ('ch_match_id', 'match_id')
ORDER  BY column_name;
