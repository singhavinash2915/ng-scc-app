-- ─────────────────────────────────────────────────────────────────────────────
-- Internal-match bonus predictions (Dhurandars vs Bazigars rivalry questions)
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_predictions
  ADD COLUMN IF NOT EXISTS internal_most_sixes TEXT,   -- 'dhurandars' | 'bazigars' | 'tie'
  ADD COLUMN IF NOT EXISTS internal_margin     TEXT,   -- 'thriller' | 'comfortable' | 'dominant'
  ADD COLUMN IF NOT EXISTS internal_milestone  TEXT;   -- 'yes' | 'no' — will anyone score 30+
