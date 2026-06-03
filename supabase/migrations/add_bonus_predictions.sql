-- ─────────────────────────────────────────────────────────────────────────────
-- Bonus predictions — adds 3 new questions to the prediction game
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_predictions
  ADD COLUMN IF NOT EXISTS score_range     TEXT,    -- 'under_100' | '100_150' | '150_200' | 'over_200'
  ADD COLUMN IF NOT EXISTS fifty_scored    TEXT,    -- 'yes' | 'no'
  ADD COLUMN IF NOT EXISTS five_wicket_haul TEXT;   -- 'yes' | 'no'
