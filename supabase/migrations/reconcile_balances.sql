-- ─────────────────────────────────────────────────────────────────────────────
-- Make every member's ledger reconcile
-- Run once in Supabase Dashboard → SQL Editor.
--
-- 31 of 48 members' stored balances don't match the sum of their transactions.
-- The research says why:
--
--   • Match fees are NOT the cause — fee transactions match fee-charged
--     appearances to within one across the entire club.
--   • Balances aren't round numbers, so they weren't hand-set.
--   • Every member shares created_at = 2026-01-01, a bulk import.
--
-- So the history was imported partially while balances were set to the real
-- figure of the day. The STORED BALANCE IS THE TRUTH; the ledger is short.
--
-- That is why this adds an opening entry rather than overwriting balances.
-- Rewriting 31 balances to match an admittedly incomplete ledger would destroy
-- correct data to make a wrong number agree with it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fix the reimbursement I mis-tagged ────────────────────────────────────
-- It carried Avinash's member_id, so it read as ₹28,000 coming OUT of his
-- wallet. It didn't — that was club cash paid TO him. A club expense has no
-- member wallet attached.
UPDATE transactions SET member_id = NULL
WHERE description LIKE 'Reimbursed Avinash Singh — 7 CricBot%';

-- ── 2. One opening-balance entry per member who needs it ─────────────────────
-- Dated the day before the club's first recorded transaction, so it sits at
-- the top of every statement and reads as what it is.
INSERT INTO transactions (member_id, type, amount, date, description)
SELECT m.id,
       CASE WHEN d.diff > 0 THEN 'deposit' ELSE 'match_fee' END,
       abs(d.diff),
       (SELECT min(date) - INTERVAL '1 day' FROM transactions),
       'Opening balance — carried in when the club moved to the app'
FROM members m
JOIN LATERAL (
  SELECT m.balance - COALESCE((
    SELECT sum(CASE WHEN t.type IN ('deposit','refund') THEN abs(t.amount)
                    ELSE -abs(t.amount) END)
    FROM transactions t WHERE t.member_id = m.id
  ), 0) AS diff
) d ON abs(d.diff) > 0.5
WHERE NOT EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.member_id = m.id AND t.description LIKE 'Opening balance%'
);

-- ── Check it worked ──────────────────────────────────────────────────────────
-- Should return zero rows: every member's ledger now equals their balance.
SELECT m.name, m.balance,
       COALESCE(sum(CASE WHEN t.type IN ('deposit','refund') THEN abs(t.amount)
                         ELSE -abs(t.amount) END), 0) AS ledger
FROM members m LEFT JOIN transactions t ON t.member_id = m.id
GROUP BY m.id, m.name, m.balance
HAVING abs(m.balance - COALESCE(sum(CASE WHEN t.type IN ('deposit','refund')
       THEN abs(t.amount) ELSE -abs(t.amount) END), 0)) > 0.5;
