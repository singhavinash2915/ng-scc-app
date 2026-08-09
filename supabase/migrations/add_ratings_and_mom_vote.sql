-- ─────────────────────────────────────────────────────────────────────────────
-- Captain post-match ratings + member-voted Man of the Match
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Two ways to make a match matter after the final ball:
--
--   scc_player_ratings — each captain rates their own XII out of 10. Gives
--     captains a visible job between matches and feeds a "most consistent"
--     award that isn't just runs.
--
--   scc_mom_votes — members vote for Man of the Match alongside the admin's
--     pick. The two disagreeing IS the point; don't replace the official award
--     with it.
--
-- Both are per-match and per-voter, so a UNIQUE constraint does the dedupe and
-- the app can upsert freely when someone changes their mind.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Captain ratings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc_player_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,  -- who is rated
  rated_by    UUID          REFERENCES members(id) ON DELETE SET NULL, -- the captain
  rating      NUMERIC(3,1) NOT NULL CHECK (rating >= 1 AND rating <= 10),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  -- One rating per player per match. Re-rating updates rather than stacking.
  UNIQUE (match_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_player_ratings_match  ON scc_player_ratings(match_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_member ON scc_player_ratings(member_id);

-- ── Member-voted Man of the Match ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc_mom_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,  -- voted for
  created_at  TIMESTAMPTZ DEFAULT now(),
  -- One vote each. Changing your mind updates the row.
  UNIQUE (match_id, voter_id),
  -- No voting for yourself, same rule the predictions game uses.
  CHECK (voter_id <> member_id)
);

CREATE INDEX IF NOT EXISTS idx_mom_votes_match ON scc_mom_votes(match_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public policies, consistent with every other table here: auth is client-side
-- and the anon key ships in the bundle, so these are conventions rather than
-- locks. Worth knowing before anyone treats a rating as confidential — a
-- captain's 4/10 is readable by the player who got it.
ALTER TABLE scc_player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc_mom_votes      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public ratings" ON scc_player_ratings;
CREATE POLICY "public ratings" ON scc_player_ratings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public mom votes" ON scc_mom_votes;
CREATE POLICY "public mom votes" ON scc_mom_votes
  FOR ALL USING (true) WITH CHECK (true);

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('scc_player_ratings', 'scc_mom_votes')
ORDER BY table_name, ordinal_position;
