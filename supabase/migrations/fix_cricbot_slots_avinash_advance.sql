-- ─── Step 1: undo a reimbursement that never happened ────────────────────────
-- Avinash fronted ₹28,000 for seven match slots bought from CricBot XI (7 × ₹4,000,
-- Mar–May 2027). The books record that the club paid him back on 20 Aug 2026 out
-- of opponent booking income. It never did — he has not been repaid, and he has
-- since fronted a further ₹49,000 towards the Four Star payment.
--
-- The arithmetic agrees with him rather than with the ledger. Money collected
-- this season is ₹289,000 from members plus ₹69,000 from opponents = ₹358,000.
-- Paid to the Four Star owner so far is ₹257,000 (the ₹285,000 of slots marked
-- paid, less the ₹28,000 of CricBot slots, which went to CricBot XI and not to
-- the ground owner). That leaves ₹101,000 — exactly the ₹69,000 opponent money
-- plus ₹32,000 member money that went into the ₹150,000 paid to Four Star. Had
-- the club really paid the ₹28,000 out, only ₹73,000 would have been left and
-- the payment could not have been made.
--
-- Three corrections, all guarded so they can only touch the intended rows, and
-- all safe to run more than once.


-- ── 1. Delete the reimbursement that never happened ──────────────────────────
-- An expense row is a claim that money left the club. This one didn't, so it
-- understates club cash by ₹28,000 and wrongly shows the debt to Avinash as
-- cleared.

DELETE FROM public.transactions
WHERE  id          = 'bdce7f9a-1368-428c-9653-23a7ae3cb1a1'
  AND  type        = 'expense'
  AND  amount      = -28000
  AND  description LIKE 'Reimbursed Avinash Singh%';


-- ── 2. Mark the seven CricBot slots as fronted by Avinash, and unsettled ─────
-- prepaid_by is exactly this case, and the app already reads it: a slot with a
-- prepaid_by is money the club has NOT spent and still owes that member, and it
-- is kept out of the Four Star owner totals because CricBot XI is a different
-- counterparty. Leaving it null had these seven counted as ₹28,000 paid to the
-- ground owner, which is money he never received.
--
-- prepaid_settled was true, which is the same false claim in another column.

UPDATE public.ground_bookings
SET    prepaid_by       = '7545cb6b-41fe-4102-b392-f560ae44805f',   -- Avinash Singh
       prepaid_settled  = false,
       notes            = 'Bought from CricBot XI. Fronted by Avinash Singh — NOT yet repaid.'
WHERE  opponent_name = 'CricBot XI'
  AND  cost          = 4000
  AND  id IN (
    'e5fdc9ba-309e-487e-9cd9-e14457a4a8e2',   -- 2027-03-07
    '9657da97-c006-4859-baa7-a63d7fa8890d',   -- 2027-03-20
    '384fb27a-9e25-484c-b7c4-a02443272edf',   -- 2027-04-04
    'dcda086e-d1ed-49de-a718-54eb0f9cb2d5',   -- 2027-04-18
    '94660b9a-3751-4632-aa18-882f30307c15',   -- 2027-05-02
    'e4e90690-4c5e-4037-8459-261212f96f57',   -- 2027-05-16
    'c9a496f0-1f69-4b0d-983a-9f8825727298'    -- 2027-05-30
  );


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect, in order:
--   false expense gone          0
--   cricbot slots fronted       7   (all prepaid_by Avinash, none settled)
--   paid to FOUR STAR owner     257000   (was 285000)
--   owed to members             28000    (was 0)
SELECT 'false expense rows left' AS check, count(*)::text AS value
FROM   public.transactions WHERE id = 'bdce7f9a-1368-428c-9653-23a7ae3cb1a1'
UNION ALL
SELECT 'cricbot slots fronted, unsettled', count(*)::text
FROM   public.ground_bookings
WHERE  opponent_name = 'CricBot XI' AND prepaid_by IS NOT NULL AND prepaid_settled = false
UNION ALL
SELECT 'paid to Four Star owner', to_char(coalesce(sum(cost),0), 'FM999,999,999')
FROM   public.ground_bookings
WHERE  payment_status = 'paid' AND prepaid_by IS NULL
UNION ALL
SELECT 'owed to members (fronted slots)', to_char(coalesce(sum(cost),0), 'FM999,999,999')
FROM   public.ground_bookings
WHERE  prepaid_by IS NOT NULL AND prepaid_settled = false;
