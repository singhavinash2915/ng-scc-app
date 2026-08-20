-- ─────────────────────────────────────────────────────────────────────────────
-- Settle the CricBot slots from opponent income
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The club received ₹56,000 this season from teams booking slots from us. The
-- members' ₹2,57,000 went to the ground owner as the July advance, so the
-- opponent money is untouched — and it is the right source for this: it arrives
-- OUTSIDE member contributions, nobody budgeted for it, and no member has a
-- claim on it.
--
-- The rule this sets, worth stating out loud: opponent booking income repays
-- members who pay club costs personally, before anything else. So the next
-- person who fronts money knows the club settles, and nobody has to argue it.
--
-- After this the slots are simply paid ground sessions like any other. No debt
-- line, nobody owed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Record the reimbursement ──────────────────────────────────────────────
-- A real expense on a real date. A handshake is not a record, and an audit
-- cannot see one.
INSERT INTO transactions (member_id, type, amount, date, description)
SELECT m.id, 'expense', -28000, CURRENT_DATE,
       'Reimbursed Avinash Singh — 7 CricBot XI slots, from opponent booking income'
FROM members m
WHERE m.name ILIKE 'Avinash Singh'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.description LIKE 'Reimbursed Avinash Singh — 7 CricBot%'
  );

-- ── 2. The slots stop being anyone's advance ─────────────────────────────────
-- prepaid_by is cleared because it is no longer true: the club has paid for
-- these sessions now. They become ordinary paid ground bookings, which is what
-- they should have been all along had the cash been there on the day.
UPDATE ground_bookings
SET prepaid_by = NULL, prepaid_settled = TRUE, payment_status = 'paid',
    notes = 'Bought from CricBot XI. Fronted by Avinash Singh and reimbursed '
         || 'from opponent booking income on ' || to_char(CURRENT_DATE, 'DD Mon YYYY') || '.'
WHERE opponent_name = 'CricBot XI' AND prepaid_by IS NOT NULL;

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT 'reimbursement recorded' AS what, count(*)::text AS value
FROM transactions WHERE description LIKE 'Reimbursed Avinash Singh — 7 CricBot%'
UNION ALL
SELECT 'slots still marked prepaid', count(*)::text
FROM ground_bookings WHERE prepaid_by IS NOT NULL
UNION ALL
SELECT 'CricBot slots now paid', count(*)::text
FROM ground_bookings WHERE opponent_name = 'CricBot XI' AND payment_status = 'paid';
