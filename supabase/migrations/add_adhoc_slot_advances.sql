-- ─── September ad-hoc slots: Avinash pays the owner, the match pays him back ──
-- September is played ad-hoc while the monsoon decides whether Four Star is fit.
-- The arrangement, per slot:
--
--   Avinash pays the Four Star owner the whole slot, upfront.
--     weekday (Tue/Thu) ₹6,000 · weekend ₹8,000
--   The opponent pays HIM half — ₹3,000 weekday, ₹4,000 weekend.
--   The SCC side pays the other half out of their wallets, as the match fee.
--   An internal match has no opponent, so the SCC side pays the whole slot.
--
-- Seven slots, ₹46,000 fronted in all:
--   Sat 12  ₹8,000  Ocean Warriors
--   Tue 15  ₹6,000
--   Thu 17  ₹6,000  SCC Brahmos v SCC Agni (internal — team pays it all)
--   Sun 20  ₹8,000  Yashwin Hinjawadi
--   Tue 22  ₹6,000
--   Thu 24  ₹6,000
--   Tue 29  ₹6,000
--
-- How it is recorded — nothing new, the same shape as the CricBot advance:
--   ground_bookings    booking_kind 'adhoc', prepaid_by Avinash. Ad-hoc keeps it
--                      out of the ₹5,44,500 season contract; prepaid_by keeps it
--                      out of "owed to the owner".
--   member_advances    one per slot, now linked to it by booking_id, so each
--                      match's money repays its own slot.
--   match_bookings     the opponent's half, as every opponent payment already
--                      is. Entered as PENDING — it is not money until it lands.
--                      Mark it verified on the Bookings page when it's in hand.
--
-- Repaying him is automatic: scc_settle_adhoc_slot(date) records what each side
-- has paid, and the app calls it when match fees are charged and when an
-- opponent payment is verified. It is idempotent — safe to call any number of
-- times, it only ever records what's missing.
--
-- Safe to run more than once.

BEGIN;

-- ── 1. An advance can name the slot it paid for ──────────────────────────────
ALTER TABLE public.member_advances
  ADD COLUMN IF NOT EXISTS booking_id uuid
    REFERENCES public.ground_bookings(id) ON DELETE SET NULL;

-- One advance per slot, or the same slot could be repaid twice.
CREATE UNIQUE INDEX IF NOT EXISTS member_advances_booking_id_key
  ON public.member_advances(booking_id) WHERE booking_id IS NOT NULL;


-- ── 2. The seven slots ───────────────────────────────────────────────────────
WITH avinash AS (
  SELECT id FROM public.members WHERE name = 'Avinash Singh'
), season AS (
  SELECT id FROM public.seasons
  WHERE  '2026-09-12' BETWEEN start_date AND end_date
  ORDER  BY start_date DESC LIMIT 1
), slots(date, cost, time_slot, opponent) AS (
  VALUES
    ('2026-09-12'::date, 8000, '6:45 AM - 9:00 AM', 'Ocean Warriors'),
    ('2026-09-15'::date, 6000, '7:00 AM - 9:00 AM', NULL),
    ('2026-09-17'::date, 6000, '7:00 AM - 9:00 AM', 'SCC Brahmos vs SCC Agni'),
    ('2026-09-20'::date, 8000, '7:00 AM - 9:00 AM', 'Yashwin Hinjawadi'),
    ('2026-09-22'::date, 6000, '7:00 AM - 9:00 AM', NULL),
    ('2026-09-24'::date, 6000, '7:00 AM - 9:00 AM', NULL),
    ('2026-09-29'::date, 6000, '7:00 AM - 9:00 AM', NULL)
)
INSERT INTO public.ground_bookings
  (season_id, date, venue, time_slot, cost, status, payment_status,
   booking_kind, prepaid_by, prepaid_settled, opponent_name, match_id, notes)
SELECT (SELECT id FROM season), s.date, 'Four Star Ground', s.time_slot, s.cost,
       'booked', 'paid', 'adhoc', (SELECT id FROM avinash), false, s.opponent,
       (SELECT m.id FROM public.matches m
        WHERE  m.date = s.date AND m.result <> 'cancelled'
        ORDER  BY m.created_at DESC LIMIT 1),
       'Ad-hoc September slot. Avinash paid the owner in full; opponent pays him half, '
       || 'the SCC side the rest from match fees.'
FROM   slots s
WHERE  NOT EXISTS (
  SELECT 1 FROM public.ground_bookings b
  WHERE  b.date = s.date AND b.booking_kind = 'adhoc' AND b.status <> 'cancelled');


-- ── 3. One advance per slot ──────────────────────────────────────────────────
INSERT INTO public.member_advances
  (season_id, member_id, date, amount, purpose, booking_id, notes)
SELECT b.season_id, b.prepaid_by, b.date, b.cost,
       'Ad-hoc slot ' || to_char(b.date, 'Dy DD Mon')
         || COALESCE(' v ' || b.opponent_name, '') || ' — paid to Four Star owner',
       b.id,
       'Repaid automatically: opponent half when verified, SCC half when match fees are charged.'
FROM   public.ground_bookings b
WHERE  b.booking_kind = 'adhoc'
  AND  b.prepaid_by IS NOT NULL
  AND  b.date BETWEEN '2026-09-12' AND '2026-09-29'
  AND  NOT EXISTS (SELECT 1 FROM public.member_advances a WHERE a.booking_id = b.id);


-- ── 4. The opponent's half, for the two fixtures that have an opponent ───────
-- The weekday booking slots already exist at ₹3,000 (half of ₹6,000). The two
-- weekend dates had none. Reserved so the public booking page doesn't offer them.
INSERT INTO public.match_slots (date, day_type, price, is_available)
VALUES ('2026-09-12', 'saturday', 4000, false),
       ('2026-09-20', 'saturday', 4000, false)
ON CONFLICT (date) DO UPDATE SET is_available = false;

INSERT INTO public.match_bookings
  (slot_id, team_name, contact_name, contact_phone, payment_method,
   payment_status, status, amount, match_id, admin_notes, confirmed_at)
SELECT sl.id, v.team, 'Paid to Avinash directly', '-', 'upi',
       'pending', 'confirmed', v.amount,
       (SELECT m.id FROM public.matches m
        WHERE  m.date = v.date AND m.opponent = v.team AND m.result <> 'cancelled'
        LIMIT 1),
       'Half of the ₹8,000 ad-hoc slot, paid to Avinash. Mark verified when received — '
       || 'that repays his advance automatically.',
       now()
FROM  (VALUES ('2026-09-12'::date, 'Ocean Warriors',    4000),
              ('2026-09-20'::date, 'Yashwin Hinjawadi', 4000)) AS v(date, team, amount)
JOIN   public.match_slots sl ON sl.date = v.date
WHERE  NOT EXISTS (
  SELECT 1 FROM public.match_bookings mb
  WHERE  mb.slot_id = sl.id AND mb.status NOT IN ('cancelled', 'rejected'));


-- ── 5. Settling a slot ───────────────────────────────────────────────────────
-- For one date, record whatever each side has paid that isn't recorded yet.
--
--   Opponent half: what the opponent has actually paid (verified), capped at
--                  the slot.
--   SCC half:      the slot less what the opponent AGREED to pay — recorded
--                  once match fees have been charged for a match on that day.
--                  Agreed, not paid: if it waited on the opponent's money, a late
--                  payer would leave the SCC side down as covering the whole slot.
--
-- Returns the slot's position either way, so the app can show it.
CREATE OR REPLACE FUNCTION public.scc_settle_adhoc_slot(p_date date)
RETURNS TABLE (
  booking_id uuid, advance_id uuid, cost numeric,
  opponent_agreed numeric, opponent_paid numeric,
  team_share numeric, fees_charged numeric,
  repaid numeric, outstanding numeric
) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  b          RECORD;
  adv        RECORD;
  v_agreed   numeric;
  v_paid     numeric;
  v_fees     numeric;
  v_opp_due  numeric;
  v_team_due numeric;
  v_opp_done numeric;
  v_team_done numeric;
BEGIN
  FOR b IN
    SELECT * FROM public.ground_bookings g
    WHERE  g.date = p_date AND g.booking_kind = 'adhoc'
      AND  g.prepaid_by IS NOT NULL AND g.status <> 'cancelled'
  LOOP
    SELECT * INTO adv FROM public.member_advances a WHERE a.booking_id = b.id;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT COALESCE(sum(mb.amount), 0),
           COALESCE(sum(mb.amount) FILTER (WHERE mb.payment_status = 'verified'), 0)
      INTO v_agreed, v_paid
    FROM   public.match_bookings mb
    JOIN   public.match_slots sl ON sl.id = mb.slot_id
    WHERE  sl.date = p_date AND mb.status NOT IN ('cancelled', 'rejected');

    -- Fees charged for any non-cancelled match that day: members' wallet
    -- deductions plus guests' cash.
    SELECT COALESCE(sum(-t.amount) FILTER (WHERE t.type = 'match_fee'), 0)
         + COALESCE(sum(t.amount)  FILTER (WHERE t.type = 'deposit'
                                            AND t.member_id IS NULL
                                            AND t.description LIKE 'Guest fee%'), 0)
      INTO v_fees
    FROM   public.transactions t
    JOIN   public.matches m ON m.id = t.match_id
    WHERE  m.date = p_date AND m.result <> 'cancelled';

    v_opp_due  := LEAST(v_paid, b.cost);
    v_team_due := CASE WHEN EXISTS (
                    SELECT 1 FROM public.transactions t
                    JOIN public.matches m ON m.id = t.match_id
                    WHERE m.date = p_date AND m.result <> 'cancelled'
                      AND t.type = 'match_fee')
                  THEN GREATEST(0, b.cost - LEAST(v_agreed, b.cost))
                  ELSE 0 END;

    SELECT COALESCE(sum(r.amount) FILTER (WHERE r.funded_by = 'opponent'), 0),
           COALESCE(sum(r.amount) FILTER (WHERE r.funded_by = 'club_wallet'), 0)
      INTO v_opp_done, v_team_done
    FROM   public.member_advance_repayments r WHERE r.advance_id = adv.id;

    IF v_opp_due > v_opp_done THEN
      INSERT INTO public.member_advance_repayments (advance_id, date, amount, funded_by, notes)
      VALUES (adv.id, CURRENT_DATE, v_opp_due - v_opp_done, 'opponent',
              'Opponent''s half of the ' || to_char(p_date, 'DD Mon') || ' slot');
    END IF;

    IF v_team_due > v_team_done THEN
      INSERT INTO public.member_advance_repayments (advance_id, date, amount, funded_by, notes)
      VALUES (adv.id, CURRENT_DATE, v_team_due - v_team_done, 'club_wallet',
              'SCC side''s share of the ' || to_char(p_date, 'DD Mon') || ' slot, from match fees');
    END IF;

    -- The slot flag and the ledger say the same thing.
    UPDATE public.ground_bookings g
    SET    prepaid_settled = (
             SELECT a.settled_amount >= a.amount
             FROM public.member_advances a WHERE a.id = adv.id)
    WHERE  g.id = b.id;

    RETURN QUERY
      SELECT b.id, adv.id, b.cost::numeric, v_agreed, v_paid,
             GREATEST(0, b.cost - LEAST(v_agreed, b.cost))::numeric, v_fees,
             a.settled_amount, a.amount - a.settled_amount
      FROM   public.member_advances a WHERE a.id = adv.id;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.scc_settle_adhoc_slot(date) TO anon, authenticated;

COMMIT;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect 7 slots, ₹46,000, all still owed (nothing repaid until the match fees
-- are charged and the opponents' money is verified).
SELECT b.date, to_char(b.date, 'Dy') AS day, b.cost, b.opponent_name,
       (b.match_id IS NOT NULL) AS linked_to_fixture,
       a.amount - a.settled_amount AS still_owed_to_avinash
FROM   public.ground_bookings b
JOIN   public.member_advances a ON a.booking_id = b.id
WHERE  b.booking_kind = 'adhoc'
ORDER  BY b.date;

SELECT 'total fronted' AS check, to_char(sum(a.amount), 'FM999,999') AS value
FROM   public.member_advances a WHERE a.booking_id IS NOT NULL
UNION ALL
SELECT 'opponent halves pending', to_char(sum(mb.amount), 'FM999,999')
FROM   public.match_bookings mb JOIN public.match_slots s ON s.id = mb.slot_id
WHERE  s.date IN ('2026-09-12', '2026-09-20') AND mb.payment_status = 'pending';
