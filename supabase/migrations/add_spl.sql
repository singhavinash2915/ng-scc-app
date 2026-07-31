-- ─────────────────────────────────────────────────────────────────────────────
-- Sangria Premier League (SPL) — registration + captain elections
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Flow: members register their interest → the squad votes for captains and
-- vice-captains → the top vote-getters lead the two teams at the auction.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spl_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season        TEXT NOT NULL,                       -- '2026-27'
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'in',          -- 'in' | 'maybe' | 'out'
  role          TEXT,                                -- 'batter'|'bowler'|'allrounder'|'keeper'
  base_price    INT DEFAULT 100,                     -- self-declared base price
  pitch         TEXT,                                -- one-line sell, read out at the auction
  can_commit    BOOLEAN DEFAULT true,                -- can make ~1 match a month
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE spl_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spl_reg_select" ON spl_registrations FOR SELECT USING (true);
CREATE POLICY "spl_reg_all"    ON spl_registrations FOR ALL    USING (true);

-- One ballot per member per season: a captain pick and a vice-captain pick.
-- Top 2 captain vote-getters lead the two teams; top 2 vice picks are their #2s.
CREATE TABLE IF NOT EXISTS spl_captain_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season       TEXT NOT NULL,
  voter_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  captain_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  vice_id      UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, voter_id)
);

ALTER TABLE spl_captain_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spl_votes_select" ON spl_captain_votes FOR SELECT USING (true);
CREATE POLICY "spl_votes_all"    ON spl_captain_votes FOR ALL    USING (true);
