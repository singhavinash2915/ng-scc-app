-- ─────────────────────────────────────────────────────────────────────────────
-- Match predictions game — members predict winner / top batter / top bowler /
-- MOM before each match. Points awarded once the match settles.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- Predictions
  winner               TEXT,                                          -- 'scc' | 'opponent' | 'draw'
  top_scorer_id        UUID REFERENCES members(id) ON DELETE SET NULL,
  top_wicket_taker_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  mom_id               UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Resolved points (NULL until match settles + scoring runs)
  points_earned INT,
  locked_at TIMESTAMPTZ DEFAULT now(),
  scored_at TIMESTAMPTZ,
  UNIQUE(match_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_match_predictions_match  ON match_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_predictions_member ON match_predictions(member_id);
CREATE INDEX IF NOT EXISTS idx_match_predictions_scored ON match_predictions(scored_at);

ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_predictions_all" ON match_predictions;
CREATE POLICY "match_predictions_all" ON match_predictions FOR ALL USING (true);
