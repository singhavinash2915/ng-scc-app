-- ─────────────────────────────────────────────────────────────────────────────
-- Per-batsman balls faced + dot balls, per season.
-- Run once in Supabase Dashboard → SQL Editor, THEN run:
--   python3 scripts/sync_ball_by_ball.py
--
-- CricHeroes scorecards don't store dot balls, so we derive them from the
-- ball-by-ball commentary (attributing each delivery to the batsman by name)
-- and aggregate per member per season. The Leaderboard reads this to show
-- Dot% alongside Ball%.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_ball_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  season      TEXT NOT NULL,            -- 'YYYY-YY' (e.g. '2025-26')
  balls_faced INT  NOT NULL DEFAULT 0,
  dot_balls   INT  NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, season)
);

ALTER TABLE player_ball_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbs_select" ON player_ball_stats FOR SELECT USING (true);
CREATE POLICY "pbs_all"    ON player_ball_stats FOR ALL    USING (true);

CREATE INDEX IF NOT EXISTS idx_pbs_season ON player_ball_stats(season);
