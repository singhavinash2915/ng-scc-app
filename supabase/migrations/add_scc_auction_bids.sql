-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — the auction trail
-- Run once in Supabase Dashboard → SQL Editor. Run it BEFORE auction night.
--
-- Every bid, in order, exactly like the IPL trackers: "SRH 13.00 Cr / LSG 12.80
-- Cr / SRH 12.60 Cr…". The final price alone tells you what a player cost; the
-- trail tells you the story — who pushed, who blinked, how long the war ran.
--
-- This can only be recorded AS IT HAPPENS. Nothing can reconstruct it later, so
-- the table has to exist before the first name is called.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_auction_bids (
  id         BIGSERIAL PRIMARY KEY,
  season     TEXT NOT NULL,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  team       TEXT NOT NULL,              -- 'team1' | 'team2'
  amount     INT  NOT NULL,              -- ₹ lakh
  round      INT  NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scc_auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_auction_bids_select" ON scc_auction_bids FOR SELECT USING (true);
CREATE POLICY "scc_auction_bids_all"    ON scc_auction_bids FOR ALL    USING (true);

CREATE INDEX IF NOT EXISTS scc_auction_bids_lookup_idx
  ON scc_auction_bids(season, member_id, id);
