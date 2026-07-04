-- ─────────────────────────────────────────────────────────────────────────────
-- Team Outing 2026 (Barguje Farms, 18 July) — RSVP + preferences
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Guest-friendly (no login): one RSVP per device. Everyone picks going/maybe/out,
-- a food preference, and whether they need a carpool seat. The 23 already-confirmed
-- names are seeded as "going" so the list is populated from day one.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outing_rsvps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  device_id   TEXT UNIQUE,                       -- per-device id; NULL for seeded rows
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'going',     -- 'going' | 'maybe' | 'out'
  food_pref   TEXT,                              -- 'veg' | 'nonveg' | 'either' | NULL
  drink_pref  TEXT,                              -- 'beer' | 'whisky' | 'soft' | 'none' | NULL
  needs_ride  BOOLEAN DEFAULT false,
  can_drive   BOOLEAN DEFAULT false,             -- offering seats in their car
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Safe if the table already existed from an earlier run without this column.
ALTER TABLE outing_rsvps ADD COLUMN IF NOT EXISTS drink_pref TEXT;

ALTER TABLE outing_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outing_rsvps_select" ON outing_rsvps FOR SELECT USING (true);
CREATE POLICY "outing_rsvps_all"    ON outing_rsvps FOR ALL    USING (true);

-- Seed the 23 confirmed attendees (device_id NULL = seeded, not a live RSVP).
INSERT INTO outing_rsvps (name, status) VALUES
  ('Avinash','going'), ('Shakhil','going'), ('Honey','going'), ('Harshit','going'),
  ('Sumit','going'), ('Cheeku','going'), ('Shubham','going'), ('Monu','going'),
  ('Aditya','going'), ('Abhi','going'), ('Saurabh','going'), ('Divyanshu','going'),
  ('Mayank','going'), ('Prateek','going'), ('Akash','going'), ('Nikhil','going'),
  ('Arpan','going'), ('Vaibhav','going'), ('Amit','going'), ('Adarsh','going'),
  ('Sushil','going'), ('Naveen','going'), ('Bharat','going')
ON CONFLICT DO NOTHING;
