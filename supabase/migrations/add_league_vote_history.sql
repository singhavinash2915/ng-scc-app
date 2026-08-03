-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — record WHEN a ballot changed, not just when it was first cast
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The votes table only ever had created_at. Changing a vote upserts over the
-- same row, so the old choice is gone and the timestamp still points at the
-- FIRST time that member voted. The replay therefore shows everyone's final
-- pick at their original time — which is why a candidate who briefly led on
-- votes that later moved away never appears in the replay at all.
--
-- Two changes:
--   1. updated_at, maintained by a trigger, so the replay can order ballots by
--      when they actually last changed.
--   2. an append-only history table, so a future election can be replayed
--      truthfully — every cast AND every change, in order.
--
-- Neither can recover the 2026-27 history. That is already lost.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_league_captain_votes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION scc_league_touch_vote()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scc_league_votes_touch ON scc_league_captain_votes;
CREATE TRIGGER scc_league_votes_touch
  BEFORE INSERT OR UPDATE ON scc_league_captain_votes
  FOR EACH ROW EXECUTE FUNCTION scc_league_touch_vote();

-- ─── Append-only ballot history ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc_league_vote_history (
  id          BIGSERIAL PRIMARY KEY,
  season      TEXT NOT NULL,
  voter_id    UUID NOT NULL,
  captain_id  UUID,
  action      TEXT NOT NULL,          -- 'cast' | 'changed'
  at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scc_league_vote_history ENABLE ROW LEVEL SECURITY;
-- No public SELECT policy on purpose: this is the most sensitive table in the
-- app. Read it from the Supabase SQL editor, never from a browser.

CREATE OR REPLACE FUNCTION scc_league_log_vote()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO scc_league_vote_history (season, voter_id, captain_id, action)
  VALUES (
    NEW.season, NEW.voter_id, NEW.captain_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'cast' ELSE 'changed' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scc_league_votes_log ON scc_league_captain_votes;
CREATE TRIGGER scc_league_votes_log
  AFTER INSERT OR UPDATE ON scc_league_captain_votes
  FOR EACH ROW EXECUTE FUNCTION scc_league_log_vote();
