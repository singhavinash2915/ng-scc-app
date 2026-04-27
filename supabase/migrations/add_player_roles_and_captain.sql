-- ─────────────────────────────────────────────────────────────────────────────
-- Player roles + match captain/vice-captain
-- Run manually in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Players: cricket role + style + jersey
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role          TEXT,  -- 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
  ADD COLUMN IF NOT EXISTS batting_style TEXT,  -- 'right_hand' | 'left_hand'
  ADD COLUMN IF NOT EXISTS bowling_style TEXT,  -- 'right_arm_fast' | 'right_arm_medium' | 'off_spin' | 'leg_spin' | 'left_arm_fast' | 'left_arm_spin' | 'none'
  ADD COLUMN IF NOT EXISTS jersey_number INT;

-- Matches: captain + vice-captain
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS captain_id      UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vice_captain_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_captain      ON matches(captain_id);
CREATE INDEX IF NOT EXISTS idx_matches_vice_captain ON matches(vice_captain_id);
