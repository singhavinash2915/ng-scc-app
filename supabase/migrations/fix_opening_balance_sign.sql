-- ─────────────────────────────────────────────────────────────────────────────
-- Fix the sign on 19 opening-balance rows
-- Run once in Supabase Dashboard → SQL Editor.
--
-- WHAT WENT WRONG. When the club's ledger was reconciled against stored wallet
-- balances, 31 "Opening balance" rows were written to carry in the position
-- from before the app. Twelve of them were members whose balance needed RAISING
-- and were correctly typed 'deposit' with a positive amount. The other nineteen
-- needed LOWERING — they were correctly typed 'match_fee', but the amount was
-- left POSITIVE. A positive match_fee adds to a wallet instead of subtracting
-- from it, so those nineteen corrections were applied backwards.
--
-- The signature is exact: for all 19 members, and only those 19,
--     stored_balance - sum(their ledger) = -2 x (their opening row)
-- which is what a flipped sign looks like — out by the correction twice over,
-- once for not applying it and once for applying its opposite.
--
-- Two consequences, both fixed by this one change:
--   1. Those 19 wallets disagreed with their own transaction history by
--      -81,640 in total.
--   2. Club-wide match_fee totals were understated by 40,820, because positive
--      "fees" were cancelling out real ones. Aditya Purohit's true fees are
--      6,695; the ledger showed 1,700.
--
-- This only rewrites rows this reconciliation itself created. No real deposit,
-- match fee or expense is touched, and no wallet balance changes — the stored
-- balances were right all along; it is the ledger that was wrong.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Belt and braces: refuse to run if the rows are not in the state described
-- above, so this cannot be applied twice or against a changed database.
DO $$
DECLARE n INT; total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO n, total
  FROM transactions
  WHERE description LIKE 'Opening balance%' AND type = 'match_fee' AND amount > 0;

  IF n <> 19 OR ROUND(total) <> 40820 THEN
    RAISE EXCEPTION
      'Expected 19 positive match_fee opening rows totalling 40820, found % totalling %. Not applying.',
      n, ROUND(total);
  END IF;
END $$;

UPDATE transactions
SET amount = -amount,
    description = description || ' (sign corrected)'
WHERE description LIKE 'Opening balance%'
  AND type = 'match_fee'
  AND amount > 0;

COMMIT;

-- After this, every member's wallet should equal the sum of their own ledger.
-- Verify with:
--
--   SELECT m.name, m.balance,
--          COALESCE(SUM(t.amount), 0) AS ledger,
--          m.balance - COALESCE(SUM(t.amount), 0) AS drift
--   FROM members m LEFT JOIN transactions t ON t.member_id = m.id
--   GROUP BY m.id, m.name, m.balance
--   HAVING ABS(m.balance - COALESCE(SUM(t.amount), 0)) > 1;
--
-- That should return no rows.
