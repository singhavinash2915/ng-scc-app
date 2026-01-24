-- Add support for internal matches (Sangria Dhurandars vs Sangria Bazigars)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Add match_type column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'external'
CHECK (match_type IN ('external', 'internal'));

-- Add winning_team column for internal matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winning_team TEXT
CHECK (winning_team IS NULL OR winning_team IN ('dhurandars', 'bazigars'));

-- Add team column to match_players for internal matches
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS team TEXT
CHECK (team IS NULL OR team IN ('dhurandars', 'bazigars'));

-- Create index for match_type filtering
CREATE INDEX IF NOT EXISTS idx_matches_match_type ON matches(match_type);
