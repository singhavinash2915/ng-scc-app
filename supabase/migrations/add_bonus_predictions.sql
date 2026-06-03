-- ─────────────────────────────────────────────────────────────────────────────
-- Bonus predictions — adds 3 new questions to the prediction game
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_predictions
  ADD COLUMN IF NOT EXISTS score_range       TEXT,    -- 'under_100' | '100_110' | '110_125' | 'over_125'
  ADD COLUMN IF NOT EXISTS fifty_scored      TEXT,    -- 'yes' | 'no'
  ADD COLUMN IF NOT EXISTS three_wicket_haul TEXT;    -- 'yes' | 'no' — anyone takes 3+ wickets
