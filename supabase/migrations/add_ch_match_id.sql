-- Add CricHeroes match ID to matches table for auto-sync deduplication
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS ch_match_id TEXT UNIQUE;

-- Index for fast lookup during sync
CREATE INDEX IF NOT EXISTS idx_matches_ch_match_id ON matches(ch_match_id);
