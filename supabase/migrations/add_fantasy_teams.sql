-- ─────────────────────────────────────────────────────────────────────────────
-- Fantasy Draft League — each member drafts a fantasy XI of SCC players and
-- earns points from their real CricHeroes performances (computed client-side).
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,   -- the member managing this fantasy team
  season      TEXT NOT NULL DEFAULT '2025-26',
  team_name   TEXT,
  player_ids  UUID[] NOT NULL DEFAULT '{}',                              -- drafted squad (member ids)
  captain_id  UUID REFERENCES members(id) ON DELETE SET NULL,           -- captain scores 2x
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, season)
);

ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;

-- Public access (auth is client-side via admin password), consistent with the
-- rest of the app's tables.
DROP POLICY IF EXISTS "fantasy_teams public read"   ON fantasy_teams;
DROP POLICY IF EXISTS "fantasy_teams public write"  ON fantasy_teams;
DROP POLICY IF EXISTS "fantasy_teams public update" ON fantasy_teams;
DROP POLICY IF EXISTS "fantasy_teams public delete" ON fantasy_teams;

CREATE POLICY "fantasy_teams public read"   ON fantasy_teams FOR SELECT USING (true);
CREATE POLICY "fantasy_teams public write"  ON fantasy_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "fantasy_teams public update" ON fantasy_teams FOR UPDATE USING (true);
CREATE POLICY "fantasy_teams public delete" ON fantasy_teams FOR DELETE USING (true);
