-- ─── Step 3: repaying a member, visibly ──────────────────────────────────────
-- The club owes Avinash ₹77,000. Until now the only way to record paying that
-- back was to edit a number or write a note — which is exactly how the last
-- ₹28,000 came to be marked repaid when it never was. A repayment is an event:
-- money moved, on a date, out of a particular pot. So it gets a row.
--
-- Safe to run more than once.


CREATE TABLE IF NOT EXISTS public.member_advance_repayments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id  uuid NOT NULL REFERENCES public.member_advances(id) ON DELETE CASCADE,
  date        date    NOT NULL,
  amount      numeric NOT NULL CHECK (amount > 0),
  -- Which pot it came out of. The club's own rule is opponent money first,
  -- member collections second, so the pot is worth recording rather than
  -- inferring later from the date.
  funded_by   text    NOT NULL CHECK (funded_by IN ('opponent','member_fund','club_wallet')),
  source_ref  uuid,          -- optional: the match_bookings row it came from
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_advance_repayments_advance_idx
  ON public.member_advance_repayments (advance_id);

ALTER TABLE public.member_advance_repayments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public member_advance_repayments" ON public.member_advance_repayments;
CREATE POLICY "public member_advance_repayments"
  ON public.member_advance_repayments FOR ALL USING (true) WITH CHECK (true);


-- ── settled_amount stops being a number anyone can type ──────────────────────
-- It is now maintained from the repayment rows, so the headline figure and the
-- audit trail cannot disagree. The CHECK on member_advances already refuses a
-- settled_amount above the advance, so over-repaying raises rather than silently
-- showing a negative balance.
CREATE OR REPLACE FUNCTION public.scc_sync_advance_settled() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.advance_id, OLD.advance_id);
BEGIN
  UPDATE public.member_advances a
  SET    settled_amount = (
           SELECT COALESCE(sum(r.amount), 0)
           FROM   public.member_advance_repayments r
           WHERE  r.advance_id = a.id)
  WHERE  a.id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scc_sync_advance_settled_trg ON public.member_advance_repayments;
CREATE TRIGGER scc_sync_advance_settled_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.member_advance_repayments
  FOR EACH ROW EXECUTE FUNCTION public.scc_sync_advance_settled();


-- ── What is actually free to repay with ──────────────────────────────────────
-- Money already spent on the ground cannot also repay a member. This view is the
-- difference between money collected and money already committed, per pot, so
-- the app can say "you can repay ₹X today" instead of showing a debt with no
-- indication of whether it can be cleared.
CREATE OR REPLACE VIEW public.v_scc_funds_available AS
WITH collected AS (
  SELECT 'opponent' AS pot,
         COALESCE((SELECT sum(amount) FROM public.match_bookings
                   WHERE payment_status = 'verified'
                     AND status NOT IN ('cancelled','rejected')), 0) AS total
  UNION ALL
  SELECT 'member_fund',
         COALESCE((SELECT sum(amount) FROM public.season_fund_payments), 0)
),
spent_on_ground AS (
  SELECT source AS pot, COALESCE(sum(amount), 0) AS total
  FROM   public.ground_payment_sources
  WHERE  source IN ('opponent','member_fund')
  GROUP  BY source
),
spent_on_repayments AS (
  SELECT funded_by AS pot, COALESCE(sum(amount), 0) AS total
  FROM   public.member_advance_repayments
  WHERE  funded_by IN ('opponent','member_fund')
  GROUP  BY funded_by
)
SELECT c.pot,
       c.total                                   AS collected,
       COALESCE(g.total, 0)                      AS spent_on_ground,
       COALESCE(r.total, 0)                      AS spent_on_repayments,
       c.total - COALESCE(g.total, 0) - COALESCE(r.total, 0) AS available
FROM   collected c
LEFT   JOIN spent_on_ground     g ON g.pot = c.pot
LEFT   JOIN spent_on_repayments r ON r.pot = c.pot;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Nothing is repaid yet, so expect: 0 repayments, ₹77,000 still owed, and both
-- pots fully committed — every rupee collected is already in the ground.
SELECT 'repayments recorded' AS check, count(*)::text AS value
FROM   public.member_advance_repayments
UNION ALL
SELECT 'still owed to members',
       to_char(sum(amount - settled_amount), 'FM999,999,999')
FROM   public.member_advances
UNION ALL
SELECT 'available: ' || pot, to_char(available, 'FM999,999,999')
FROM   public.v_scc_funds_available;
