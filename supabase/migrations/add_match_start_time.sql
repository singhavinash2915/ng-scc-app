-- ─────────────────────────────────────────────────────────────────────────────
-- A start time on the match itself
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Kickoff has only ever existed on ground_bookings.time_slot. At Four Star that
-- is fine — it is always 7-9am and nobody asks. But a match at someone else's
-- ground has no booking row, so the app holds no time for it at all.
--
-- The first fixture that actually needs this is 13 September at A2Z Lavale:
-- the poll goes out, and the app cannot tell anyone when to turn up.
--
-- Stored as TEXT in 24-hour 'HH:MM'. Not a TIME column: this is a wall-clock
-- time at a ground in Pune, never an instant, and keeping it out of the date
-- machinery means no driver or browser can helpfully shift it by a timezone.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE matches ADD COLUMN IF NOT EXISTS start_time TEXT
  CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

COMMENT ON COLUMN matches.start_time IS
  'Wall-clock start, 24h HH:MM. Falls back to the ground booking''s slot when null.';

-- Backfill the two September fixtures, which is why this exists.
UPDATE matches SET start_time = '07:00'
 WHERE date IN ('2026-09-08', '2026-09-13') AND start_time IS NULL;
