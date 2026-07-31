-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — registration + captain elections
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The internal two-team rivalry: members confirm they're in → the squad votes
-- for captains and vice-captains → an auction splits everyone into two teams
-- → one match a month.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_league_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season        TEXT NOT NULL,                       -- '2026-27'
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'in',          -- 'in' | 'out'  (no maybes!)
  role          TEXT,                                -- 'batter'|'bowler'|'allrounder'|'keeper'
  base_price    INT DEFAULT 100,                     -- self-declared base price
  pitch         TEXT,                                -- one-line sell, read out at the auction
  can_commit    BOOLEAN DEFAULT true,                -- can make ~1 match a month
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE scc_league_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_league_reg_select" ON scc_league_registrations FOR SELECT USING (true);
CREATE POLICY "scc_league_reg_all"    ON scc_league_registrations FOR ALL    USING (true);

-- One ballot per member per season: a captain pick and a vice-captain pick.
-- Top 2 captain vote-getters lead the two teams; top 2 vice picks are their #2s.
CREATE TABLE IF NOT EXISTS scc_league_captain_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season       TEXT NOT NULL,
  voter_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  captain_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  vice_id      UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, voter_id)
);

ALTER TABLE scc_league_captain_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_league_votes_select" ON scc_league_captain_votes FOR SELECT USING (true);
CREATE POLICY "scc_league_votes_all"    ON scc_league_captain_votes FOR ALL    USING (true);
