-- ─────────────────────────────────────────────────────────────────────────────
-- Miscellaneous expense splitting
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Until now an expense recorded that the club's money had gone, and nothing
-- more: no member's wallet moved, so the cash quietly came out of members'
-- deposits. This adds the other half of the entry.
--
-- A new transaction type 'club_fee' carries each member's share. Deliberately
-- NOT reusing 'match_fee': positive rows wrongly typed as match fees have
-- already cost this club ₹40,820 of misreported figures once, and kit charges
-- must never contaminate match-fee totals. Deliberately not reusing 'expense'
-- with a member attached either — the club's expense and the members' shares
-- would both land in expense totals and double-count the same rupees.
--
-- Two kinds of expense, because they are consumed differently:
--   consumable  — balls, drinks, ground staff. Used up in the month it was
--                 bought, so it is split across that month's players.
--   season_item — bats, stumps, trophies. Used all season, so the cost is
--                 spread evenly over the months remaining in the season and
--                 each slice is split across that month's players. A member
--                 who stops playing in January pays for the months they
--                 played and nothing after.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow the new type.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit', 'match_fee', 'expense', 'refund', 'club_fee'));

-- 2. Describe an expense.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_kind TEXT
  CHECK (expense_kind IS NULL OR expense_kind IN ('consumable', 'season_item'));

-- 3. Tie each member's share back to what it paid for. Without this a split
--    cannot be shown as a group, audited, or undone.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parent_expense_id UUID
  REFERENCES transactions(id) ON DELETE CASCADE;

-- 4. Which month a share belongs to (YYYY-MM). A season item posts a share in
--    several months from one purchase, so the purchase date alone cannot say.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS period TEXT;

CREATE INDEX IF NOT EXISTS idx_tx_parent  ON transactions (parent_expense_id);
CREATE INDEX IF NOT EXISTS idx_tx_period  ON transactions (period);
CREATE INDEX IF NOT EXISTS idx_tx_type    ON transactions (type);

-- 5. A closed month is an audited month. Re-splitting one silently would make
--    a figure a core member already checked quietly wrong.
CREATE TABLE IF NOT EXISTS scc_month_close (
  period      TEXT PRIMARY KEY,          -- 'YYYY-MM'
  closed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  misc_total  NUMERIC NOT NULL DEFAULT 0,
  appearances INT NOT NULL DEFAULT 0,
  note        TEXT
);
ALTER TABLE scc_month_close ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public access" ON scc_month_close;
CREATE POLICY "public access" ON scc_month_close FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Posting and undoing a split, atomically.
--
-- A split writes ~36 member rows and decrements ~36 balances. Doing that as 72
-- separate calls from a browser means a dropped connection can leave half the
-- club charged — the ledger disagreeing with the wallets, which is exactly the
-- failure this whole exercise exists to clean up. One function, one
-- transaction: all of it or none of it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION scc_post_month_split(
  p_period TEXT,            -- 'YYYY-MM'
  p_shares JSONB,           -- [{ "member_id": uuid, "amount": int, "note": text }]
  p_total  NUMERIC,         -- the pot; the shares must add up to it
  p_appearances INT
) RETURNS INT AS $$
DECLARE s JSONB; n INT := 0; summed NUMERIC := 0; post_date DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM scc_month_close WHERE period = p_period) THEN
    RAISE EXCEPTION 'Month % is already closed. Undo it first.', p_period;
  END IF;

  -- Refuse to post a split that does not add up. Rounding that loses rupees is
  -- how a ledger quietly stops reconciling.
  SELECT COALESCE(SUM((x->>'amount')::numeric), 0) INTO summed
  FROM jsonb_array_elements(p_shares) x;
  IF ROUND(summed) <> ROUND(p_total) THEN
    RAISE EXCEPTION 'Shares total % but the pot is %. Not posting.', summed, p_total;
  END IF;

  post_date := (p_period || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day';

  FOR s IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    INSERT INTO transactions (date, type, amount, member_id, description, period, category)
    VALUES (post_date, 'club_fee', -(s->>'amount')::numeric,
            (s->>'member_id')::uuid, s->>'note', p_period, 'misc_split');
    UPDATE members SET balance = balance - (s->>'amount')::numeric
     WHERE id = (s->>'member_id')::uuid;
    n := n + 1;
  END LOOP;

  INSERT INTO scc_month_close (period, misc_total, appearances)
  VALUES (p_period, p_total, p_appearances);

  RETURN n;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION scc_undo_month_split(p_period TEXT)
RETURNS INT AS $$
DECLARE n INT := 0;
BEGIN
  -- Put the money back before removing the rows that say why it went.
  UPDATE members m SET balance = m.balance - t.amount
    FROM transactions t
   WHERE t.member_id = m.id AND t.type = 'club_fee' AND t.period = p_period;

  WITH gone AS (
    DELETE FROM transactions
     WHERE type = 'club_fee' AND period = p_period
    RETURNING 1
  ) SELECT COUNT(*) INTO n FROM gone;

  DELETE FROM scc_month_close WHERE period = p_period;
  RETURN n;
END; $$ LANGUAGE plpgsql;
