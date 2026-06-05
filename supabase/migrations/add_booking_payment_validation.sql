-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-validate UPI payment screenshots via Claude Vision
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_bookings
  ADD COLUMN IF NOT EXISTS payment_validation       JSONB,           -- AI extracted info + verdict
  ADD COLUMN IF NOT EXISTS payment_validated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_auto_verified    BOOLEAN DEFAULT false;
