-- ─────────────────────────────────────────────────────────────────────────────
-- Member unavailability — "I'm away these dates"
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The club already has per-match squad polling, but it runs the wrong way round
-- for scheduling: it asks "the match is on the 4th, are you free?" — which needs
-- the fixture to exist first. Picking good dates needs the opposite question,
-- asked before anything is booked: "which weekends will enough people be here?"
--
-- Festive season is when this bites. Members travel home for two or three weeks
-- at a stretch, and a fixture booked into the middle of that is a fixture that
-- gets cancelled.
--
-- A RANGE, not a row per day. People are away "12th to 20th", and storing nine
-- rows for that would make editing it ("actually I'm back on the 18th") a
-- delete-and-recreate instead of changing one field.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scc_member_unavailability (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  from_date  DATE NOT NULL,
  to_date    DATE NOT NULL,
  -- Optional on purpose. This table is readable by anyone technical (the app
  -- has no server-side auth), so nobody should feel obliged to type a private
  -- reason into it. The UI offers harmless chips — Diwali, hometown, travel —
  -- rather than an empty box that invites "hospital".
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sane_range CHECK (to_date >= from_date)
);

-- Every read is either "this member's blocks" or "who is away in this window",
-- so both columns earn an index.
CREATE INDEX IF NOT EXISTS idx_unavail_member ON scc_member_unavailability (member_id);
CREATE INDEX IF NOT EXISTS idx_unavail_dates  ON scc_member_unavailability (from_date, to_date);

ALTER TABLE scc_member_unavailability ENABLE ROW LEVEL SECURITY;

-- Public access, consistent with the rest of the schema: auth in this app is
-- client-side. Who-sees-what is enforced in the UI (a member sees their own
-- entries; admins see everyone), which is a product boundary and not a
-- security one — hence the note on `reason` above.
DROP POLICY IF EXISTS "public access" ON scc_member_unavailability;
CREATE POLICY "public access" ON scc_member_unavailability
  FOR ALL USING (true) WITH CHECK (true);
