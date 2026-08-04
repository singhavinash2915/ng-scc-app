-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — unsold rounds
-- Run once in Supabase Dashboard → SQL Editor. (After add_scc_auction.sql.)
--
-- Players passed over in the main pass come back at base price in round 2, and
-- again in round 3 if they are still there. The auction only finishes when both
-- squads are full or nobody is left to sell, so a team can't end the night short
-- just because their name came up at the wrong moment.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_auction
  ADD COLUMN IF NOT EXISTS round INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN scc_auction.round IS
  '1 = main pass, 2+ = unsold rounds. Picks record the round they were sold in.';
