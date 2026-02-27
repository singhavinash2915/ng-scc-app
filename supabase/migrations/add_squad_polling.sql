-- Squad Polling: Allow members to indicate availability for upcoming matches
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add polling columns to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS polling_enabled BOOLEAN DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS polling_deadline TIMESTAMPTZ;

-- 2. Create match_polls table
CREATE TABLE IF NOT EXISTS match_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('available', 'unavailable', 'maybe')),
  note TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, member_id)
);

-- 3. Enable RLS with public access (same pattern as other tables)
ALTER TABLE match_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on match_polls"
  ON match_polls FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on match_polls"
  ON match_polls FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on match_polls"
  ON match_polls FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access on match_polls"
  ON match_polls FOR DELETE USING (true);

-- 4. Index for fast lookups by match
CREATE INDEX IF NOT EXISTS idx_match_polls_match ON match_polls(match_id);
CREATE INDEX IF NOT EXISTS idx_match_polls_member ON match_polls(member_id);
