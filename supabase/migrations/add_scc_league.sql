-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — registration + captain elections
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The internal two-team rivalry: members confirm they're in → the squad votes
-- for captains → an auction splits everyone into two teams → 2-3 matches a month.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_league_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season        TEXT NOT NULL,                       -- '2026-27'
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'in',          -- 'in' | 'out'  (no maybes!)
  role          TEXT,                                -- 'batter'|'bowler'|'allrounder'|'keeper'
  base_price    INT DEFAULT 20,                      -- GRADED from SCC rating, in ₹ LAKH (20 = ₹20L, 200 = ₹2Cr)
  pitch         TEXT,                                -- one-line sell, read out at the auction
  can_commit    BOOLEAN DEFAULT true,                -- can make ~1 match a month
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE scc_league_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_league_reg_select" ON scc_league_registrations FOR SELECT USING (true);
CREATE POLICY "scc_league_reg_all"    ON scc_league_registrations FOR ALL    USING (true);

-- One ballot per member per season: a single captain pick.
-- The two most-voted players captain the two teams.
CREATE TABLE IF NOT EXISTS scc_league_captain_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season       TEXT NOT NULL,
  voter_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  captain_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, voter_id)
);

ALTER TABLE scc_league_captain_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_league_votes_select" ON scc_league_captain_votes FOR SELECT USING (true);
CREATE POLICY "scc_league_votes_all"    ON scc_league_captain_votes FOR ALL    USING (true);
