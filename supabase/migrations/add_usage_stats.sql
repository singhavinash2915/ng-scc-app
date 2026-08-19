-- ─────────────────────────────────────────────────────────────────────────────
-- Usage — aggregate only
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Answers "is anyone using this?" without answering "who". There is no
-- member_id column here and that is deliberate, not an oversight: members sign
-- in with a phone number to see their own season, and nothing told them the
-- club would keep a log of when they opened the app. A named activity board
-- visible to several admins would change what signing in means.
--
-- It also avoids a number that gets used against people — "you open the app
-- daily but never top up" is a conversation the data invites and nobody wants.
-- Turnout and squad polls already show engagement that actually matters.
--
-- One row per session per route, not per page load, so a member browsing for
-- ten minutes writes a handful of rows rather than hundreds. Egress on this
-- club's plan is tight enough to care.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_usage (
  id          BIGSERIAL PRIMARY KEY,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  route       TEXT NOT NULL,
  -- Random per browser session. Lets us count PEOPLE rather than page loads
  -- without knowing which person — it is regenerated every session and maps
  -- to nothing.
  session_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (day, route, session_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_day ON scc_usage(day DESC);

ALTER TABLE scc_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public usage" ON scc_usage;
CREATE POLICY "public usage" ON scc_usage FOR ALL USING (true) WITH CHECK (true);

-- Housekeeping: 90 days is plenty to see a trend, and an unbounded log on a
-- free tier eventually becomes somebody's problem.
DELETE FROM scc_usage WHERE day < CURRENT_DATE - INTERVAL '90 days';

SELECT count(*) AS existing_rows FROM scc_usage;
