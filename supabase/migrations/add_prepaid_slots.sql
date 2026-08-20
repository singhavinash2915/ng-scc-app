-- ─────────────────────────────────────────────────────────────────────────────
-- Slots a member paid for out of their own pocket
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Avinash paid CricBot XI ₹28,000 for 7 extra slots. That is a LOAN to the
-- club, not a club expense — the club owes him, and it repays him one match at
-- a time as the fees come in.
--
-- The reason this needs recording rather than remembering: without it a member
-- is ₹28,000 out of pocket with nothing on paper, and six months from now,
-- after a couple of matches are rained off, nobody agrees what was settled.
-- That is how clubs fall out.
--
-- Deliberately NOT credited to his member balance. Club funds is the sum of
-- member balances, so crediting him would inflate it by ₹28,000 of cash the
-- club does not have, and every member would see healthier finances than exist.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ground_bookings
  -- Who fronted the money. NULL = paid from club funds as normal.
  ADD COLUMN IF NOT EXISTS prepaid_by UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Has that member been paid back for THIS slot yet?
  ADD COLUMN IF NOT EXISTS prepaid_settled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ground_bookings.prepaid_by IS
  'Member who paid for this slot personally. The club owes them until '
  'prepaid_settled — see the advance tracker on the season page.';

CREATE INDEX IF NOT EXISTS idx_ground_prepaid ON ground_bookings(prepaid_by, prepaid_settled);

-- ── The 7 CricBot XI slots ───────────────────────────────────────────────────
-- Extra sessions, on top of the 91 already booked at Four Star. ₹28,000 / 7 =
-- ₹4,000 each. Marked paid because they ARE paid — just not by the club.
INSERT INTO ground_bookings
  (season_id, date, venue, time_slot, cost, status, payment_status,
   opponent_name, prepaid_by, notes)
SELECT
  s.id, d.date, 'Four Star Ground', '7:00 AM - 9:00 AM', 4000, 'booked', 'paid',
  'CricBot XI', m.id,
  'Advance paid by Avinash Singh — ₹28,000 for 7 slots, non-refundable.'
FROM (SELECT id FROM seasons WHERE status = 'active' ORDER BY start_date DESC LIMIT 1) s
CROSS JOIN (SELECT id FROM members WHERE name ILIKE 'Avinash Singh' LIMIT 1) m
CROSS JOIN (VALUES
  (DATE '2027-03-07'), (DATE '2027-03-20'),
  (DATE '2027-04-04'), (DATE '2027-04-18'),
  (DATE '2027-05-02'), (DATE '2027-05-16'), (DATE '2027-05-30')
) AS d(date)
-- Safe to re-run: won't duplicate if the slots are already there.
WHERE NOT EXISTS (
  SELECT 1 FROM ground_bookings g
  WHERE g.date = d.date AND g.opponent_name = 'CricBot XI'
);

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT date, cost, opponent_name, payment_status, prepaid_settled
FROM ground_bookings WHERE opponent_name = 'CricBot XI' ORDER BY date;

SELECT count(*) AS slots, sum(cost) AS advance_total
FROM ground_bookings WHERE opponent_name = 'CricBot XI';
