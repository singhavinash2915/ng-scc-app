-- ─────────────────────────────────────────────────────────────────────────────
-- Attach a member to a usage row
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The club decided admins should see which members are using the app. That is
-- their call to make, and it is defensible in a club of 46 who all know each
-- other — but it changes what signing in means, so two things go with it:
--
--   1. Visible to ADMINS ONLY. Never to the whole club.
--   2. Members are TOLD, on the sign-in card, before they sign in. Tracking
--      people who were not told is the part that would be wrong, not the
--      tracking itself.
--
-- Nullable: signed-out visitors still count towards totals, they just have no
-- name attached. The anonymous session_key stays and remains what the totals
-- are built from, so nothing already recorded is retro-identified.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_usage
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

COMMENT ON COLUMN scc_usage.member_id IS
  'Who was signed in, when they were. NULL for signed-out visits. Admin-visible '
  'only, and disclosed to members on the sign-in card.';

CREATE INDEX IF NOT EXISTS idx_usage_member ON scc_usage(member_id, day);

SELECT column_name FROM information_schema.columns
WHERE table_name = 'scc_usage' AND column_name = 'member_id';
