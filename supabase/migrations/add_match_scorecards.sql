-- ─────────────────────────────────────────────────────────────────────────────
-- Detailed scorecards (per-batter + per-bowler) pulled from CricHeroes SSR.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  ch_match_id TEXT NOT NULL,
  -- Innings 1
  innings1_team_id INT,
  innings1_team_name TEXT,
  innings1_summary JSONB,           -- { score, over, rr, total_run, total_wicket, total_extra }
  innings1_batting JSONB,           -- [{ name, runs, balls, 4s, 6s, SR, how_to_out }]
  innings1_bowling JSONB,           -- [{ name, overs, maidens, runs, wickets, economy_rate }]
  innings1_extras JSONB,            -- { wide, noball, byes, etc. }
  -- Innings 2
  innings2_team_id INT,
  innings2_team_name TEXT,
  innings2_summary JSONB,
  innings2_batting JSONB,
  innings2_bowling JSONB,
  innings2_extras JSONB,
  -- Meta
  fetched_at TIMESTAMPTZ DEFAULT now(),
  raw JSONB,                         -- Full pageProps.scorecard for safety / future use
  UNIQUE(match_id)
);

CREATE INDEX IF NOT EXISTS idx_match_scorecards_ch_match_id ON match_scorecards(ch_match_id);
CREATE INDEX IF NOT EXISTS idx_match_scorecards_fetched ON match_scorecards(fetched_at);

ALTER TABLE match_scorecards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_scorecards_all" ON match_scorecards;
CREATE POLICY "match_scorecards_all" ON match_scorecards FOR ALL USING (true);
