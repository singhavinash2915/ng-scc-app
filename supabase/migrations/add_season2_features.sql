-- ─────────────────────────────────────────────────────────────────────────────
-- Season 2026-27 launch features: pre-season predictions + personal goals.
-- Run once in Supabase Dashboard → SQL Editor.
-- (fantasy_teams already exists from the 2025-26 fantasy draft — reused as-is.)
-- ─────────────────────────────────────────────────────────────────────────────

-- One pre-season prediction slip per member per season.
-- Locked in the app once the season's first ball is bowled; scored in June.
CREATE TABLE IF NOT EXISTS season_predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season              TEXT NOT NULL,                                   -- '2026-27'
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  top_scorer_id       UUID REFERENCES members(id) ON DELETE SET NULL,
  top_wicket_taker_id UUID REFERENCES members(id) ON DELETE SET NULL,
  mvp_id              UUID REFERENCES members(id) ON DELETE SET NULL,
  predicted_wins      INT,                                             -- wins out of the league fixtures
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE season_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_predictions_select" ON season_predictions FOR SELECT USING (true);
CREATE POLICY "season_predictions_all"    ON season_predictions FOR ALL    USING (true);

-- Personal season goals ("600 runs / 40 wickets") — progress is computed
-- in-app from the season's synced stats.
CREATE TABLE IF NOT EXISTS member_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season       TEXT NOT NULL,                                          -- '2026-27'
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  goal_runs    INT,
  goal_wickets INT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_goals_select" ON member_goals FOR SELECT USING (true);
CREATE POLICY "member_goals_all"    ON member_goals FOR ALL    USING (true);
