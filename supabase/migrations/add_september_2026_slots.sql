-- ─────────────────────────────────────────────────────────────────────────────
-- September 2026 slots for the Book a Match page
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The season now opens on 8 September, but match_slots only ran from 1 October
-- (91 slots, Oct 2026 → May 2027). So the first month of the season was
-- invisible to visiting teams: an opponent looking to book us in September saw
-- nothing at all.
--
-- Tuesdays and Thursdays only, matching the existing weekday pattern and the
-- ₹3,000 weekday price already in the table. No Saturdays — the ground contract
-- that provides them starts in October.
--
-- Nothing before the 8th: 1 and 3 September fall outside the season.
--
-- 8 September is inserted but NOT available. SCC plays its own opener that day
-- (Brahmos vs Agni at Four Star), so the date must exist — otherwise it looks
-- like a free Tuesday — while being unbookable by a visiting team.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO match_slots (date, day_type, price, is_available)
VALUES
  ('2026-09-08', 'weekday', 3000, false),   -- SCC Brahmos vs SCC Agni — season opener
  ('2026-09-10', 'weekday', 3000, true),
  ('2026-09-15', 'weekday', 3000, true),
  ('2026-09-17', 'weekday', 3000, true),
  ('2026-09-22', 'weekday', 3000, true),
  ('2026-09-24', 'weekday', 3000, true),
  ('2026-09-29', 'weekday', 3000, true)
-- Safe to run twice: a date already present is left exactly as it is, so a slot
-- someone has since booked is never quietly reopened.
ON CONFLICT (date) DO NOTHING;

-- Check:
--   SELECT date, to_char(date,'Dy') AS day, day_type, price, is_available
--   FROM match_slots WHERE date BETWEEN '2026-09-01' AND '2026-09-30' ORDER BY date;
-- Expect 7 rows: the 8th unavailable, the other six bookable.
