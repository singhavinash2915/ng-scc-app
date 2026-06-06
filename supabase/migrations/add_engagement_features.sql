-- ─────────────────────────────────────────────────────────────────────────────
-- Match Day Chat, Fantasy Points, Milestones, Polls/Quizzes, Season Awards
-- Run manually in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Match Day Live Chat ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  emoji TEXT,                            -- optional emoji-only message
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_match_chat_match ON match_chat(match_id, created_at DESC);

ALTER TABLE match_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_chat_select" ON match_chat FOR SELECT USING (true);
CREATE POLICY "match_chat_all"    ON match_chat FOR ALL    USING (true);

-- ── 2. Club Polls / Quizzes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  type TEXT DEFAULT 'poll',              -- 'poll' | 'quiz'
  options JSONB NOT NULL DEFAULT '[]',   -- [{ "text": "Option A", "isCorrect": false }]
  category TEXT DEFAULT 'fun',           -- 'fun' | 'cricket' | 'scc_history'
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE club_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_polls_select" ON club_polls FOR SELECT USING (true);
CREATE POLICY "club_polls_all"    ON club_polls FOR ALL    USING (true);

CREATE TABLE IF NOT EXISTS club_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES club_polls(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, member_id)
);

ALTER TABLE club_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_poll_votes_select" ON club_poll_votes FOR SELECT USING (true);
CREATE POLICY "club_poll_votes_all"    ON club_poll_votes FOR ALL    USING (true);

-- ── 3. Season Awards Voting ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_award_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 'Best Batsman', 'Most Improved', etc.
  emoji TEXT,
  season TEXT NOT NULL,                  -- '2025-26'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE season_award_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "award_cat_select" ON season_award_categories FOR SELECT USING (true);
CREATE POLICY "award_cat_all"    ON season_award_categories FOR ALL    USING (true);

CREATE TABLE IF NOT EXISTS season_award_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES season_award_categories(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, voter_id)
);

ALTER TABLE season_award_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "award_votes_select" ON season_award_votes FOR SELECT USING (true);
CREATE POLICY "award_votes_all"    ON season_award_votes FOR ALL    USING (true);
