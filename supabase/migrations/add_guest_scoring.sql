-- ─── Let the scoring pad record a guest ──────────────────────────────────────
-- A guest is a friend filling in when the club is short. They pay the match fee
-- and that is all the app tracks about them — no wallet, no stats, no
-- leaderboard — so they live in `guests`, deliberately not in `members`.
--
-- The scoring pad could not record one. Every player column on a ball row is a
-- foreign key to members(id), so a guest facing a delivery was rejected by the
-- database: with a fill-in at the crease the innings simply could not be scored.
-- That is the exact situation the pad exists for — CricHeroes down, at somebody
-- else's ground, a player short.
--
-- These columns become plain UUIDs holding EITHER a member id or a guest id.
-- Nothing joins them in SQL (every read is a plain select, resolved in the app
-- against the two rosters), so no query breaks. What is lost is the database's
-- own guarantee that a deleted member's ball rows get nulled — the ON DELETE
-- SET NULL. Members are never hard-deleted in this app, and the app resolves an
-- unknown id to a blank name rather than crashing, so that is an acceptable
-- trade for being able to score the match at all.
--
-- Guest stats stay out of every club figure by an explicit marker, not by luck:
-- an app-built scorecard tags a guest row player_id = -1, and the stat sync
-- skips those rows and refuses to resolve any scorecard name that belongs to a
-- guest. See src/lib/buildScorecard.ts and src/hooks/useStatSync.ts.

BEGIN;

-- What we are about to drop (should list five constraints on scc_ball_by_ball).
SELECT conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conrelid = 'scc_ball_by_ball'::regclass
  AND  contype = 'f'
  AND  confrelid = 'members'::regclass
ORDER  BY conname;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'scc_ball_by_ball'::regclass
      AND  contype = 'f'
      AND  confrelid = 'members'::regclass
      -- created_by is always the scorer, and a scorer is always a member.
      AND  conname NOT LIKE '%created_by%'
  LOOP
    EXECUTE format('ALTER TABLE scc_ball_by_ball DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'dropped %', c.conname;
  END LOOP;
END $$;

COMMENT ON COLUMN scc_ball_by_ball.striker_id IS
  'members(id) OR guests(id) — resolved in the app, not by a foreign key, so a '
  'guest filling in can be scored. Same for non_striker_id, bowler_id, '
  'dismissed_id and fielder_id.';

-- Confirm: expect only the match_id and created_by foreign keys to remain.
SELECT conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conrelid = 'scc_ball_by_ball'::regclass AND contype = 'f'
ORDER  BY conname;

COMMIT;
