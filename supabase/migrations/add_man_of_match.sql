-- Add Man of the Match column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS man_of_match_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_man_of_match ON matches(man_of_match_id);
