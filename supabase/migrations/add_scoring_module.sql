-- ─────────────────────────────────────────────────────────────────────────────
-- In-app ball-by-ball scoring
-- Run once in Supabase Dashboard → SQL Editor.
--
-- CricHeroes stalls often enough that scoring a match there can be a chore. This
-- lets any member score from the SCC app instead, ball by ball, and produces the
-- same match_scorecards shape the CricHeroes sync writes — so rankings, the MVP
-- race, value-for-money, achievements and records all work off it unchanged.
--
-- Storing one row per BALL rather than running totals is what makes undo,
-- commentary and a live viewer possible, and it's small: a 16-over innings is
-- ~100 rows of ~100 bytes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Match format, set when the fixture is scheduled ──────────────────────────
-- The club plays 12 a side, 16 overs, tennis ball — not the 11/20 defaults, so
-- the scorer has to read the format from the fixture rather than assume.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS overs_per_innings  INT     DEFAULT 16,
  ADD COLUMN IF NOT EXISTS players_per_side   INT     DEFAULT 12,
  ADD COLUMN IF NOT EXISTS max_overs_per_bowler INT   DEFAULT 4,
  -- Set while a match is being scored in-app. Blocks the CricHeroes sync from
  -- overwriting live work, and marks which record is authoritative.
  ADD COLUMN IF NOT EXISTS scoring_source     TEXT    DEFAULT NULL
    CHECK (scoring_source IS NULL OR scoring_source IN ('app', 'cricheroes'));

COMMENT ON COLUMN matches.scoring_source IS
  'app = scored in the SCC app and authoritative; the CricHeroes sync must not '
  'overwrite it. NULL/cricheroes = synced from CricHeroes as before.';

-- ── One row per ball ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc_ball_by_ball (
  id            BIGSERIAL PRIMARY KEY,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings       SMALLINT NOT NULL CHECK (innings IN (1, 2)),

  -- Position in the innings. over_no is 0-based, ball_no counts LEGAL balls
  -- bowled in that over so far (wides and no-balls don't advance it).
  over_no       SMALLINT NOT NULL,
  ball_no       SMALLINT NOT NULL,
  -- Monotonic within an innings; the delta cursor a live viewer polls on.
  seq           INT NOT NULL,

  striker_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  non_striker_id UUID REFERENCES members(id) ON DELETE SET NULL,
  bowler_id      UUID REFERENCES members(id) ON DELETE SET NULL,

  runs_off_bat  SMALLINT NOT NULL DEFAULT 0 CHECK (runs_off_bat >= 0),
  extra_type    TEXT CHECK (extra_type IS NULL OR extra_type IN ('wd','nb','b','lb')),
  extra_runs    SMALLINT NOT NULL DEFAULT 0 CHECK (extra_runs >= 0),

  wicket_type   TEXT CHECK (wicket_type IS NULL OR wicket_type IN
                  ('bowled','caught','lbw','run_out','stumped','hit_wicket','retired')),
  dismissed_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  fielder_id    UUID REFERENCES members(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES members(id) ON DELETE SET NULL,

  -- Undo deletes the highest seq, so this also stops a double-tap duplicating.
  UNIQUE (match_id, innings, seq)
);

CREATE INDEX IF NOT EXISTS idx_bbb_match ON scc_ball_by_ball(match_id, innings, seq);

-- ── Who is scoring right now ─────────────────────────────────────────────────
-- One scorer per match. Two people scoring at once would corrupt an innings, so
-- the lock is claimed and refreshed; if the holder's phone dies, it goes stale
-- and someone else can take over.
CREATE TABLE IF NOT EXISTS scc_scoring_lock (
  match_id      UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  scorer_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  heartbeat_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── The innings context the balls don't carry ────────────────────────────────
-- Who batted first, who's in, and whether an innings is closed. Kept separate
-- so a ball row stays a fact about one delivery and nothing else.
CREATE TABLE IF NOT EXISTS scc_innings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings       SMALLINT NOT NULL CHECK (innings IN (1, 2)),
  batting_team  TEXT NOT NULL,          -- 'scc' | 'opponent' | brahmos | agni | …
  bowling_team  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','closed')),
  target        INT,                    -- innings 2 only
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (match_id, innings)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public, as everywhere else in this schema — any member can score, which is
-- the point, and the lock is what stops two people doing it at once.
ALTER TABLE scc_ball_by_ball ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc_scoring_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc_innings      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public bbb"     ON scc_ball_by_ball;
DROP POLICY IF EXISTS "public lock"    ON scc_scoring_lock;
DROP POLICY IF EXISTS "public innings" ON scc_innings;
CREATE POLICY "public bbb"     ON scc_ball_by_ball FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public lock"    ON scc_scoring_lock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public innings" ON scc_innings      FOR ALL USING (true) WITH CHECK (true);

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT table_name, count(*) AS columns
FROM information_schema.columns
WHERE table_name IN ('scc_ball_by_ball','scc_scoring_lock','scc_innings')
GROUP BY table_name ORDER BY table_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'matches'
  AND column_name IN ('overs_per_innings','players_per_side','max_overs_per_bowler','scoring_source')
ORDER BY column_name;
