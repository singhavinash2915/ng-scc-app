-- ─── Ball-by-ball, rebuilt from CricHeroes ───────────────────────────────────
-- CricHeroes' commentary feed carries every delivery EXCEPT the ones a wicket
-- fell on. Their ball ids run consecutively, so the missing wicket balls show up
-- as gaps, and the scorecard says who was out, how, and to whom. The daily sync
-- (scripts/sync_ch_balls.py) fills the gaps and writes the result here, which is
-- what the pressure curve, Match Centre → Impact and season impact read.
--
-- Player columns are TEXT keys, not member ids: "12345" is a CricHeroes player
-- id, "n:Some Name" a player the scorecard never named with an id. The app maps
-- them to members by name, the same strict matcher the stat sync uses.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS ch_ball_matches (
  ch_match_id  TEXT PRIMARY KEY,
  match_id     UUID REFERENCES matches(id) ON DELETE CASCADE,
  players      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- key → { name, team_id }
  innings      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ innings, team_id, team_name, target, runs, wickets, legal_balls }]
  quality      TEXT NOT NULL CHECK (quality IN ('exact', 'close', 'partial')),
  notes        TEXT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ch_balls (
  id               BIGSERIAL PRIMARY KEY,
  ch_match_id      TEXT NOT NULL REFERENCES ch_ball_matches(ch_match_id) ON DELETE CASCADE,
  innings          SMALLINT NOT NULL CHECK (innings IN (1, 2)),
  seq              INT NOT NULL,
  over_no          INT NOT NULL,
  ball_no          INT NOT NULL,
  striker_id       TEXT,
  non_striker_id   TEXT,
  bowler_id        TEXT,
  runs_off_bat     INT NOT NULL DEFAULT 0,
  extra_type       TEXT CHECK (extra_type IN ('wd', 'nb', 'b', 'lb')),
  extra_runs       INT NOT NULL DEFAULT 0,
  wicket_type      TEXT,
  dismissed_id     TEXT,
  fielder_id       TEXT,
  reconstructed    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (ch_match_id, innings, seq)
);

CREATE INDEX IF NOT EXISTS ch_balls_match ON ch_balls (ch_match_id, innings, seq);
CREATE INDEX IF NOT EXISTS ch_ball_matches_match ON ch_ball_matches (match_id);

ALTER TABLE ch_ball_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_balls        ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public ch ball matches" ON ch_ball_matches;
DROP POLICY IF EXISTS "public ch balls"        ON ch_balls;
CREATE POLICY "public ch ball matches" ON ch_ball_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public ch balls"        ON ch_balls        FOR ALL USING (true) WITH CHECK (true);
