-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — LIVE auction state
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The old auction runner kept everything in one browser's localStorage, so only
-- the auctioneer could see it and clearing that browser lost the night. This
-- puts the whole auction in the database: the admin writes, everyone reads, and
-- a refresh (or a flat phone) loses nothing.
--
-- One row per season in scc_auction; one row per player resolved in
-- scc_auction_picks. Money is in ₹ LAKH throughout, same as the league grades.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_auction (
  season           TEXT PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'setup',   -- 'setup' | 'live' | 'done'

  team1_name       TEXT NOT NULL DEFAULT 'Team 1',
  team2_name       TEXT NOT NULL DEFAULT 'Team 2',
  team1_captain_id UUID REFERENCES members(id) ON DELETE SET NULL,
  team2_captain_id UUID REFERENCES members(id) ON DELETE SET NULL,

  purse_lakh       INT NOT NULL DEFAULT 2500,       -- ₹25 Cr per team
  squad_size       INT NOT NULL DEFAULT 13,         -- captain + 12 bought

  pool_order       UUID[] NOT NULL DEFAULT '{}',    -- resolved once, at start
  current_idx      INT NOT NULL DEFAULT 0,
  current_bid      INT NOT NULL DEFAULT 0,          -- ₹ lakh
  current_bidder   TEXT,                            -- 'team1' | 'team2' | null

  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scc_auction ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_auction_select" ON scc_auction FOR SELECT USING (true);
CREATE POLICY "scc_auction_all"    ON scc_auction FOR ALL    USING (true);

-- Every resolved player. UNIQUE(season, member_id) means a double-tap on SOLD
-- cannot sell the same player twice.
CREATE TABLE IF NOT EXISTS scc_auction_picks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season     TEXT NOT NULL,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  team       TEXT,                                  -- 'team1' | 'team2' | NULL = unsold
  price      INT NOT NULL DEFAULT 0,                -- ₹ lakh
  round      INT NOT NULL DEFAULT 1,                -- 1 = main, 2 = unsold round
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, member_id)
);

ALTER TABLE scc_auction_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_auction_picks_select" ON scc_auction_picks FOR SELECT USING (true);
CREATE POLICY "scc_auction_picks_all"    ON scc_auction_picks FOR ALL    USING (true);

CREATE INDEX IF NOT EXISTS scc_auction_picks_season_idx ON scc_auction_picks(season);
