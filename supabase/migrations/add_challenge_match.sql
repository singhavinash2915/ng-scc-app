-- ─────────────────────────────────────────────────────────────────────────────
-- Pin a target challenge to one fixture
-- Run once in Supabase Dashboard → SQL Editor.
--
-- "First to 4 sixes in a match" left open-ended is really "first to 4 sixes
-- ever", which nobody is waiting on. Naming the fixture turns it into a bet
-- about Sunday — both players know when it settles, and the whole club knows
-- which game to watch.
--
-- Nullable on purpose: an open-ended target is still a valid contest, and
-- existing challenges must keep working.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_challenges
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id) ON DELETE SET NULL;

COMMENT ON COLUMN scc_challenges.match_id IS
  'Target challenges only. NULL = any match; set = this fixture decides it.';

CREATE INDEX IF NOT EXISTS idx_challenges_match ON scc_challenges(match_id);

SELECT column_name FROM information_schema.columns
WHERE table_name = 'scc_challenges' AND column_name = 'match_id';
