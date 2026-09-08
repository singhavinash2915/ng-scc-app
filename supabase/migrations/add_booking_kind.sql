-- ─── Ad-hoc ground slots, kept out of the season contract ────────────────────
-- The ₹5,44,500 figure is a specific thing: a season deal with the Four Star
-- owner for 91 Tue/Thu/Sat slots running October to May. September is being
-- played ad-hoc while the monsoon decides whether the ground is fit, and a
-- rained-month replacement slot is not part of that deal.
--
-- Recorded as an ordinary booking it would inflate the contract, and the one
-- number a treasurer reads against the actual agreement stops meaning anything.
-- So bookings gain a kind. Everything that exists today is season, which is what
-- the default gives them, and nothing changes until an ad-hoc row is added.
--
-- The same separation the page already makes for the seven CricBot slots, which
-- it shows as "Extra slots · not Four Star" — that split is by prepaid_by, which
-- answers "who paid". This one answers "is it in the contract", and the two are
-- genuinely different questions: an ad-hoc slot paid by the club is neither
-- prepaid nor contracted.
--
-- Safe to run more than once.

ALTER TABLE public.ground_bookings
  ADD COLUMN IF NOT EXISTS booking_kind TEXT NOT NULL DEFAULT 'season';

ALTER TABLE public.ground_bookings
  DROP CONSTRAINT IF EXISTS ground_bookings_booking_kind_check;
ALTER TABLE public.ground_bookings
  ADD CONSTRAINT ground_bookings_booking_kind_check
  CHECK (booking_kind IN ('season', 'adhoc'));


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: 98 season, 0 adhoc — the column exists and has changed nothing yet.
SELECT booking_kind, count(*) AS bookings,
       to_char(sum(cost), 'FM999,999,999') AS total_cost
FROM   public.ground_bookings
GROUP  BY booking_kind
ORDER  BY booking_kind;
