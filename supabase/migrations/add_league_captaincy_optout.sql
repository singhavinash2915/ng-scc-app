-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — let players opt OUT of captaincy
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Being in the auction and wanting to captain are two different questions.
-- Without this, every registered player is on the captain ballot whether they
-- want the job or not, and votes spent on someone who then declines are simply
-- lost — the squad has to vote again.
--
-- Existing rows default to TRUE (available to captain), so nobody who has
-- already registered has to do anything. Anyone who does NOT want the job
-- flips it off on the SCC League page before voting opens.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_league_registrations
  ADD COLUMN IF NOT EXISTS wants_captaincy BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN scc_league_registrations.wants_captaincy IS
  'Player is willing to captain a side. false = keep them off the captain ballot.';
