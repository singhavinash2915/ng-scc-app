-- ─────────────────────────────────────────────────────────────────────────────
-- SCC internal match days
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Dates the club reserves for its own SCC League matches (Brahmos vs Agni).
-- The Book-a-Match calendar already auto-holds a couple of dates a month; this
-- lets an admin pin an EXACT date so external teams can't book it, and so the
-- squad knows a league match is on that day.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_internal_match_days (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL UNIQUE,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scc_internal_match_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scc_internal_days_select" ON scc_internal_match_days FOR SELECT USING (true);
CREATE POLICY "scc_internal_days_all"    ON scc_internal_match_days FOR ALL    USING (true);
