-- ─────────────────────────────────────────────────────────────────────────────
-- Ground fund becomes wallet money
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Members asked for this and they're right: "I paid ₹10,000 for the ground —
-- if I play, take my match fee out of that." It turns the season fund into a
-- PREPAYMENT. You pay up front, you draw it down as you play, and whoever
-- plays more pays more. Nobody has to fund two pots.
--
-- ⚠️  READ THIS BEFORE RUNNING. After this, member balances total about
-- ₹2,70,000 while the club holds almost no cash from that pot — the ₹2,57,000
-- was paid to the ground owner in June. The money isn't missing; it bought
-- ground slots, and members now hold credit against them. But "club funds" and
-- "cash in hand" have permanently stopped being the same number, and the app
-- has to show both or it will read as though the club is rich. That split
-- ships alongside this migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Correct what was actually paid to the ground owner ────────────────────
-- The club paid ₹2,57,000 in June; the app had only ₹2,35,000 of sessions
-- marked paid. Payment was a lump sum, so which sessions it covers is a
-- convention — earliest-unpaid-first is the honest one.
WITH to_settle AS (
  SELECT id FROM ground_bookings
  WHERE prepaid_by IS NULL AND payment_status <> 'paid' AND cost = 5500
  ORDER BY date
  LIMIT 4                       -- 4 × ₹5,500 = ₹22,000, closes the gap exactly
)
UPDATE ground_bookings SET payment_status = 'paid'
WHERE id IN (SELECT id FROM to_settle);

-- ── 2. Season fund contributions become wallet credit ────────────────────────
-- One deposit per contribution, tagged so it can be found again and so nobody
-- mistakes it for a second payment. Idempotent: re-running adds nothing.
INSERT INTO transactions (member_id, type, amount, date, description)
SELECT p.member_id, 'deposit', p.amount, p.date,
       'Ground fund transferred to wallet · ' || to_char(p.date, 'Mon YYYY')
FROM season_fund_payments p
WHERE NOT EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.member_id = p.member_id
    AND t.date = p.date
    AND t.amount = p.amount
    AND t.description LIKE 'Ground fund transferred to wallet%'
);

-- ── 3. Move the balances to match ────────────────────────────────────────────
-- Only for contributions just transferred, so re-running is safe.
UPDATE members m
SET balance = m.balance + x.total
FROM (
  SELECT t.member_id, SUM(t.amount) AS total
  FROM transactions t
  WHERE t.description LIKE 'Ground fund transferred to wallet%'
    AND t.created_at > now() - interval '2 minutes'
  GROUP BY t.member_id
) x
WHERE m.id = x.member_id;

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT 'paid to owner' AS what, sum(cost) AS amount
FROM ground_bookings WHERE prepaid_by IS NULL AND payment_status = 'paid'
UNION ALL
SELECT 'transferred to wallets', sum(amount)
FROM transactions WHERE description LIKE 'Ground fund transferred to wallet%'
UNION ALL
SELECT 'member balances now', sum(balance) FROM members;
