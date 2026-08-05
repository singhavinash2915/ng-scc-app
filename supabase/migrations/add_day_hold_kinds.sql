-- ─────────────────────────────────────────────────────────────────────────────
-- Book-a-Match — day holds with a reason
-- Run once in Supabase Dashboard → SQL Editor.
--
-- scc_internal_match_days started life as "dates reserved for an SCC League
-- match". In practice an admin needs to hold a day for three different reasons,
-- and the most common one isn't a league match at all — it's a team that paid
-- the admin directly instead of booking through the app.
--
--   internal — SCC League match (Brahmos vs Agni). The original behaviour.
--   offline  — booked directly with the admin. Records who booked and what they
--              paid, so the money isn't lost track of just because it skipped
--              the app.
--   blocked  — ground genuinely unavailable: maintenance, festival, weather.
--
-- Existing rows default to 'internal', so nothing already pinned changes
-- meaning. The table keeps its name to avoid breaking a live page mid-season.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_internal_match_days
  ADD COLUMN IF NOT EXISTS kind          TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS team_name     TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS amount        NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN scc_internal_match_days.kind IS
  'internal = SCC League match · offline = paid direct to admin · blocked = ground unavailable';
COMMENT ON COLUMN scc_internal_match_days.amount IS
  'What an offline booking actually paid, in ₹. Null for league days and blocks.';
