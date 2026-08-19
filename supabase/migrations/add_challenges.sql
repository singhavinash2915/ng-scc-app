-- ─────────────────────────────────────────────────────────────────────────────
-- Competitive Challenges
-- Run once in Supabase Dashboard → SQL Editor.
--
-- CricHeroes announced this and hasn't shipped it. Theirs has to work for
-- millions of strangers, so it's a four-screen create-a-challenge form. Ours
-- doesn't: 46 people who all know each other, and an app that already knows
-- who is 12 runs behind whom. So the main path is a SUGGESTED challenge
-- accepted in one tap, and the form is the rare case.
--
-- Nothing here stores a score. Every challenge is settled by reading the same
-- match data the rest of the app uses — which means results can't drift out of
-- step with the leaderboard, and a corrected scorecard corrects the challenge.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being compared. Ball-level metrics only resolve for matches scored
  -- in the app; the scorecard ones work off the CricHeroes sync too.
  metric        TEXT NOT NULL CHECK (metric IN (
                  'runs','wickets','fours','sixes','fifties','catches',
                  'strike_rate','economy',
                  -- these need scc_ball_by_ball, i.e. an app-scored match
                  'death_economy','dot_percent','chase_strike_rate','partnership'
                )),

  -- 'h2h'   two or more players, highest wins
  -- 'target' everyone races to a number
  kind          TEXT NOT NULL DEFAULT 'h2h' CHECK (kind IN ('h2h','target')),
  target        INT,                       -- kind = 'target' only

  -- The window it counts over. Open-ended until closes_at passes or the
  -- match count is reached.
  starts_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  closes_on     DATE,
  match_count   INT,                       -- "next 3 matches" style

  created_by    UUID REFERENCES members(id) ON DELETE SET NULL,
  title         TEXT,                      -- optional; generated when absent
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','live','settled','declined','cancelled')),
  -- Filled when it settles, so a finished challenge doesn't need recomputing
  -- every time somebody opens the page.
  winner_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  settled_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_status ON scc_challenges(status, closes_on);

-- ── Who is in it ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc_challenge_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES scc_challenges(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- A challenge you were invited to is not one you agreed to. Nobody appears
  -- on a public leaderboard because someone else named them.
  accepted      BOOLEAN NOT NULL DEFAULT FALSE,
  responded_at  TIMESTAMPTZ,
  UNIQUE (challenge_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_players ON scc_challenge_players(member_id, accepted);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public, as everywhere else in this schema. Challenges are club-visible by
-- design: the point is that everyone can see who called whom out.
ALTER TABLE scc_challenges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc_challenge_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public challenges" ON scc_challenges;
DROP POLICY IF EXISTS "public challenge players" ON scc_challenge_players;
CREATE POLICY "public challenges"        ON scc_challenges        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public challenge players" ON scc_challenge_players FOR ALL USING (true) WITH CHECK (true);

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT table_name, count(*) AS columns
FROM information_schema.columns
WHERE table_name IN ('scc_challenges','scc_challenge_players')
GROUP BY table_name ORDER BY table_name;
