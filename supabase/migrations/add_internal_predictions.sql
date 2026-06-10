-- ─────────────────────────────────────────────────────────────────────────────
-- Internal-match bonus predictions (Dhurandars vs Bazigars rivalry questions)
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_predictions
  -- Rivalry team-comparison bonuses
  ADD COLUMN IF NOT EXISTS internal_most_sixes   TEXT,   -- 'dhurandars' | 'bazigars' | 'tie'
  ADD COLUMN IF NOT EXISTS internal_margin       TEXT,   -- 'thriller' | 'comfortable' | 'dominant'
  ADD COLUMN IF NOT EXISTS internal_milestone    TEXT,   -- 'yes' | 'no' — will anyone score 30+
  ADD COLUMN IF NOT EXISTS internal_highest_team TEXT,   -- 'dhurandars' | 'bazigars' | 'tie' — highest individual score
  ADD COLUMN IF NOT EXISTS internal_duck         TEXT,   -- 'yes' | 'no' — will anyone get out for 0
  -- Per-team star picks
  ADD COLUMN IF NOT EXISTS int_dhur_top_scorer_id UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS int_baz_top_scorer_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS int_dhur_top_wicket_id UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS int_baz_top_wicket_id  UUID REFERENCES members(id) ON DELETE SET NULL;
