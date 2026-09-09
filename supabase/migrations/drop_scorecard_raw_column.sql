-- ─── Drop match_scorecards.raw ───────────────────────────────────────────────
-- It stored the entire unparsed CricHeroes response for every match: 14 KB a
-- row, 189 rows, more than half the table — and nothing has ever read it. Not
-- the app, not the edge functions, not any script. Checked all three before
-- writing this.
--
-- It was not free. The client fetched the table with select('*'), so every
-- member paid roughly half a megabyte for it on each cold open of Rankings,
-- Challenges, MahaSangram, Auction or the Pressure Index. That is a large part
-- of why the organisation went past its 5 GB egress quota. The app no longer
-- selects it, and scripts/sync_scorecards.py no longer writes it.
--
-- If the CricHeroes format ever changes, re-fetching is a better answer than
-- hoarding: the parsed columns are what everything downstream uses, and the
-- sync can always rebuild them from the live API.
--
-- ⚠️  This deletes data that cannot be recovered from within the database.
--     Everything derived from it — batting, bowling, extras, summaries — is
--     already stored in its own columns and is unaffected.
--
-- Safe to run more than once.

-- Size before, so the reclaim is visible rather than assumed.
SELECT 'before' AS stage,
       pg_size_pretty(pg_total_relation_size('public.match_scorecards')) AS table_size;

ALTER TABLE public.match_scorecards DROP COLUMN IF EXISTS raw;

-- DROP COLUMN alone does NOT return the space. Postgres only marks the column
-- dead; the bytes stay in the heap and its TOAST table until something rewrites
-- them. VACUUM FULL does that rewrite. It takes an exclusive lock, which on a
-- table this small is a fraction of a second — but it is the reason to run this
-- when nobody is mid-match rather than during a game.
VACUUM FULL public.match_scorecards;

-- Size after.
SELECT 'after' AS stage,
       pg_size_pretty(pg_total_relation_size('public.match_scorecards')) AS table_size;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: no 'raw' column, and 189 scorecards still present with their parsed
-- innings intact.
SELECT count(*) AS scorecards,
       count(innings1_batting) AS with_innings1,
       count(innings2_batting) AS with_innings2,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'match_scorecards' AND column_name = 'raw') AS raw_column_still_there
FROM   public.match_scorecards;
