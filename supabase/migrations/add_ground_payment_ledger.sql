-- ─── Step 2: a ledger for money paid to the ground, and money owed to members ─
-- Until now "paid to the owner" was inferred by counting ground_bookings rows
-- whose payment_status said 'paid'. That is a schedule of slots, not a record of
-- payments: it cannot say when money moved, how much moved at once, or where it
-- came from. When ₹150,000 went to Four Star this week — ₹69,000 of opponent
-- money, ₹32,000 of member money and ₹49,000 out of Avinash's own pocket — there
-- was nowhere to put any of that.
--
-- Three tables. Safe to run more than once.


-- ── ground_payments: one row per payment actually made ───────────────────────
CREATE TABLE IF NOT EXISTS public.ground_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  date        date        NOT NULL,
  amount      numeric     NOT NULL CHECK (amount > 0),
  paid_to     text        NOT NULL DEFAULT 'Four Star Ground owner',
  method      text,
  reference   text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── ground_payment_sources: where each payment's money came from ─────────────
-- A source is a POINTER to money already recorded elsewhere, never new money.
-- The opponent's ₹69,000 is already in match_bookings and the members' ₹32,000
-- is already in season_fund_payments; recording them here as well is what says
-- where they went, not that more of them arrived. Getting that wrong is how the
-- ₹257,000 double-count happened before.
CREATE TABLE IF NOT EXISTS public.ground_payment_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES public.ground_payments(id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('member_fund','opponent','member_advance','club_wallet')),
  amount      numeric NOT NULL CHECK (amount > 0),
  member_id   uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- An advance is always somebody's, or nobody can be repaid.
  CONSTRAINT ground_payment_sources_advance_needs_member
    CHECK (source <> 'member_advance' OR member_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ground_payment_sources_payment_idx
  ON public.ground_payment_sources (payment_id);

-- ── member_advances: what the club owes a member ─────────────────────────────
-- The single answer to "what is Avinash owed". ground_bookings.prepaid_by keeps
-- its own job — marking slots that club cash did not pay for, so they stay out
-- of the ground-owner totals — but the DEBT is counted here and nowhere else, so
-- the two can never drift into disagreeing about the same rupees.
CREATE TABLE IF NOT EXISTS public.member_advances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  member_id      uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  date           date    NOT NULL,
  amount         numeric NOT NULL CHECK (amount > 0),
  purpose        text    NOT NULL,
  settled_amount numeric NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Repaying more than was lent is always a mistake, never an intention.
  CONSTRAINT member_advances_settled_within_amount CHECK (settled_amount <= amount)
);
CREATE INDEX IF NOT EXISTS member_advances_member_idx ON public.member_advances (member_id);

ALTER TABLE public.ground_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ground_payment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_advances        ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public ground_payments"        ON public.ground_payments;
DROP POLICY IF EXISTS "public ground_payment_sources" ON public.ground_payment_sources;
DROP POLICY IF EXISTS "public member_advances"        ON public.member_advances;
CREATE POLICY "public ground_payments"        ON public.ground_payments        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public ground_payment_sources" ON public.ground_payment_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public member_advances"        ON public.member_advances        FOR ALL USING (true) WITH CHECK (true);


-- ── The invariant, enforced rather than remembered ───────────────────────────
-- Sources may not add up to more than the payment they fund. Over-allocation is
-- the dangerous direction: it is how the same rupee gets spent twice. Under-
-- allocation is merely incomplete, so it is reported by the view below instead
-- of being blocked half-way through entering a split.
CREATE OR REPLACE FUNCTION public.scc_check_payment_sources() RETURNS trigger AS $$
DECLARE
  pay_amount numeric;
  src_total  numeric;
BEGIN
  SELECT amount INTO pay_amount FROM public.ground_payments WHERE id = NEW.payment_id;
  SELECT coalesce(sum(amount), 0) INTO src_total
  FROM   public.ground_payment_sources
  WHERE  payment_id = NEW.payment_id AND id <> NEW.id;

  IF src_total + NEW.amount > pay_amount THEN
    RAISE EXCEPTION
      'Sources (%) would exceed the payment (%) — the same money cannot fund two things.',
      src_total + NEW.amount, pay_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scc_check_payment_sources_trg ON public.ground_payment_sources;
CREATE TRIGGER scc_check_payment_sources_trg
  BEFORE INSERT OR UPDATE ON public.ground_payment_sources
  FOR EACH ROW EXECUTE FUNCTION public.scc_check_payment_sources();

-- Any payment whose split does not add up. Should always be empty.
CREATE OR REPLACE VIEW public.v_ground_payment_unallocated AS
SELECT p.id, p.date, p.amount,
       coalesce(sum(s.amount), 0)            AS allocated,
       p.amount - coalesce(sum(s.amount), 0) AS unallocated
FROM   public.ground_payments p
LEFT   JOIN public.ground_payment_sources s ON s.payment_id = p.id
GROUP  BY p.id, p.date, p.amount
HAVING p.amount - coalesce(sum(s.amount), 0) <> 0;


-- ── Backfill ─────────────────────────────────────────────────────────────────
-- The split is not a guess. Members have put in ₹289,000 and opponents ₹69,000.
-- ₹257,000 has reached the Four Star owner so far and ₹150,000 went this week,
-- and the only division of those totals that fits is ₹257,000 of member money
-- against the earlier payments, then ₹32,000 of member money — the rest of it —
-- plus the whole ₹69,000 of opponent money and ₹49,000 of Avinash's own against
-- the ₹150,000. Every rupee collected this season is then accounted for exactly
-- once, with none left over.
--
-- The earlier ₹257,000 is entered as a single opening figure because the
-- individual payments were made before any of this was recorded.

INSERT INTO public.ground_payments (id, season_id, date, amount, paid_to, notes)
SELECT '11111111-0000-4000-8000-000000000001', s.id, DATE '2026-08-31', 257000,
       'Four Star Ground owner',
       'Opening figure: everything paid to the owner before the payment ledger existed. Not a single transfer.'
FROM   public.seasons s WHERE s.name = 'Season 2026-27'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ground_payments (id, season_id, date, amount, paid_to, notes)
SELECT '11111111-0000-4000-8000-000000000002', s.id, DATE '2026-09-05', 150000,
       'Four Star Ground owner',
       'Paid after the monsoon, funded three ways. Adjust the date if the transfer was another day.'
FROM   public.seasons s WHERE s.name = 'Season 2026-27'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ground_payment_sources (id, payment_id, source, amount, member_id, notes) VALUES
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
   'member_fund', 257000, NULL, 'Season fund contributions collected Mar–May 2026.'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',
   'opponent', 69000, NULL, 'All 19 verified opponent bookings.'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002',
   'member_fund', 32000, NULL, 'Six September collections plus Soumyaranjan''s ₹5,000 of 1 Aug.'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002',
   'member_advance', 49000, '7545cb6b-41fe-4102-b392-f560ae44805f',
   'Fronted by Avinash Singh. Repayable.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_advances (id, season_id, member_id, date, amount, purpose, notes)
SELECT '33333333-0000-4000-8000-000000000001', s.id,
       '7545cb6b-41fe-4102-b392-f560ae44805f', DATE '2026-08-20', 28000,
       'Seven match slots bought from CricBot XI',
       'The seven slots carry prepaid_by for the same reason; the debt is counted here only.'
FROM   public.seasons s WHERE s.name = 'Season 2026-27'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_advances (id, season_id, member_id, date, amount, purpose, notes)
SELECT '33333333-0000-4000-8000-000000000002', s.id,
       '7545cb6b-41fe-4102-b392-f560ae44805f', DATE '2026-09-05', 49000,
       'Share of the ₹150,000 paid to the Four Star owner',
       'To be repaid from opponent collections first, member collections second.'
FROM   public.seasons s WHERE s.name = 'Season 2026-27'
ON CONFLICT (id) DO NOTHING;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: paid 407,000 · unallocated 0 rows · owed to Avinash 77,000
SELECT 'paid to owner'            AS check, to_char(sum(amount),'FM999,999,999') AS value FROM public.ground_payments
UNION ALL
SELECT 'payments not adding up',  count(*)::text FROM public.v_ground_payment_unallocated
UNION ALL
SELECT 'owed to members',         to_char(sum(amount - settled_amount),'FM999,999,999') FROM public.member_advances
UNION ALL
SELECT 'member fund allocated',   to_char(sum(amount),'FM999,999,999') FROM public.ground_payment_sources WHERE source='member_fund'
UNION ALL
SELECT 'opponent allocated',      to_char(sum(amount),'FM999,999,999') FROM public.ground_payment_sources WHERE source='opponent';
