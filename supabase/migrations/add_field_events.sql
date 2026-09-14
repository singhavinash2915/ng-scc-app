-- ─── Fielding the scorecard cannot see ───────────────────────────────────────
-- A dropped catch and a boundary saved on the rope change a match as surely as
-- a wicket or a four, and neither leaves a trace in the ball rows. The pad's
-- "Dropped" and "Saved" buttons write here; the impact score reads it.
--
-- One row per event, tied to the delivery it happened on (seq). fielder_id has
-- no foreign key on purpose, like the ball columns: guests and opposition
-- placeholders field too. Safe to run more than once.

CREATE TABLE IF NOT EXISTS scc_field_events (
  id          BIGSERIAL PRIMARY KEY,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings     SMALLINT NOT NULL CHECK (innings IN (1, 2)),
  seq         INT,
  kind        TEXT NOT NULL CHECK (kind IN ('drop', 'save')),
  fielder_id  UUID NOT NULL,
  runs        INT NOT NULL DEFAULT 0 CHECK (runs BETWEEN 0 AND 6),
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scc_field_events_match ON scc_field_events (match_id, innings, seq);

ALTER TABLE scc_field_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public field events" ON scc_field_events;
CREATE POLICY "public field events" ON scc_field_events FOR ALL USING (true) WITH CHECK (true);
