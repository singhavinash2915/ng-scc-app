-- ─────────────────────────────────────────────────────────────────────────────
-- SCC League — keep the ballot secret from the app entirely
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The admin password is shared, so "admin only" is not a real boundary. These
-- views let the app show the leading THREE NAMES and a ballot count without
-- ever sending vote counts or voter identities to any browser.
--
-- Ranked positions only — no counts, no voters. Equal positions mean a tie,
-- which is all the app needs in order to apply the rating tie-break.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW scc_league_captain_standings AS
SELECT
  v.season,
  v.captain_id,
  RANK() OVER (PARTITION BY v.season ORDER BY COUNT(*) DESC)::int AS position
FROM scc_league_captain_votes v
JOIN scc_league_registrations r
  ON  r.season    = v.season
  AND r.member_id = v.voter_id
  AND r.status    = 'in'          -- ballots from players sitting out never count
WHERE v.captain_id IS NOT NULL
GROUP BY v.season, v.captain_id;

-- Total ballots cast, so members can see their vote landed. No identities.
CREATE OR REPLACE VIEW scc_league_ballot_counts AS
SELECT v.season, COUNT(*)::int AS ballots
FROM scc_league_captain_votes v
JOIN scc_league_registrations r
  ON  r.season    = v.season
  AND r.member_id = v.voter_id
  AND r.status    = 'in'
GROUP BY v.season;

GRANT SELECT ON scc_league_captain_standings TO anon, authenticated;
GRANT SELECT ON scc_league_ballot_counts     TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL HARDENING — run this only when you are happy to lose the app's
-- "your current pick" pre-fill (the app falls back to remembering it on the
-- device instead). Until you run it, anyone who knows the API URL can still
-- read the raw ballots directly, even though the app no longer does.
--
--   DROP POLICY IF EXISTS "scc_league_votes_select" ON scc_league_captain_votes;
--   DROP POLICY IF EXISTS "scc_league_votes_all"    ON scc_league_captain_votes;
--   CREATE POLICY "scc_league_votes_insert" ON scc_league_captain_votes
--     FOR INSERT WITH CHECK (true);
--   CREATE POLICY "scc_league_votes_update" ON scc_league_captain_votes
--     FOR UPDATE USING (true) WITH CHECK (true);
--
-- The views above keep working afterwards — they run with the owner's rights,
-- so the standings still resolve while the raw rows stay unreadable.
-- Your terminal script uses the same anon key, so run it BEFORE this if you
-- want the full audit; afterwards use the Supabase SQL editor for that.
-- ─────────────────────────────────────────────────────────────────────────────
