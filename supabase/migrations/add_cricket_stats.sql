-- Member Cricket Stats (from CricHeroes weekly sync)
CREATE TABLE IF NOT EXISTS member_cricket_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  season TEXT NOT NULL DEFAULT '2026-27',
  -- Batting
  batting_matches INTEGER DEFAULT 0,
  batting_innings INTEGER DEFAULT 0,
  batting_runs INTEGER DEFAULT 0,
  batting_highest_score INTEGER DEFAULT 0,
  batting_average DECIMAL DEFAULT 0,
  batting_strike_rate DECIMAL DEFAULT 0,
  batting_fifties INTEGER DEFAULT 0,
  batting_hundreds INTEGER DEFAULT 0,
  batting_ducks INTEGER DEFAULT 0,
  batting_fours INTEGER DEFAULT 0,
  batting_sixes INTEGER DEFAULT 0,
  -- Bowling
  bowling_matches INTEGER DEFAULT 0,
  bowling_innings INTEGER DEFAULT 0,
  bowling_overs DECIMAL DEFAULT 0,
  bowling_wickets INTEGER DEFAULT 0,
  bowling_runs_conceded INTEGER DEFAULT 0,
  bowling_economy DECIMAL DEFAULT 0,
  bowling_average DECIMAL DEFAULT 0,
  bowling_strike_rate DECIMAL DEFAULT 0,
  bowling_best_figures TEXT DEFAULT '0/0',
  bowling_five_wickets INTEGER DEFAULT 0,
  -- Fielding
  fielding_catches INTEGER DEFAULT 0,
  fielding_stumpings INTEGER DEFAULT 0,
  fielding_run_outs INTEGER DEFAULT 0,
  -- Meta
  cricheroes_profile_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, season)
);

-- AI Insight Cache
CREATE TABLE IF NOT EXISTS ai_insight_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  insight_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- RLS
ALTER TABLE member_cricket_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read member_cricket_stats" ON member_cricket_stats FOR SELECT USING (true);
CREATE POLICY "Public insert member_cricket_stats" ON member_cricket_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update member_cricket_stats" ON member_cricket_stats FOR UPDATE USING (true);
CREATE POLICY "Public delete member_cricket_stats" ON member_cricket_stats FOR DELETE USING (true);

ALTER TABLE ai_insight_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ai_insight_cache" ON ai_insight_cache FOR SELECT USING (true);
CREATE POLICY "Public insert ai_insight_cache" ON ai_insight_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ai_insight_cache" ON ai_insight_cache FOR UPDATE USING (true);
CREATE POLICY "Public delete ai_insight_cache" ON ai_insight_cache FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cricket_stats_member ON member_cricket_stats(member_id);
CREATE INDEX IF NOT EXISTS idx_cricket_stats_season ON member_cricket_stats(season);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_insight_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_insight_cache(expires_at);
