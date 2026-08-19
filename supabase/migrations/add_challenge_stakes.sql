-- ─────────────────────────────────────────────────────────────────────────────
-- Challenge stakes + settlement
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Bragging rights are fine until the third challenge, when nobody remembers
-- who won the first two. A stake is what moves a challenge from the app into
-- the WhatsApp group — and it has to be something the club actually enforces,
-- which is why it's free text agreed between two people rather than anything
-- this app tries to settle.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scc_challenges
  -- "Loser buys chai", "loser carries the kit bag". Deliberately NOT money:
  -- the club has a wallet system and a challenge quietly moving balances
  -- between members would be a different, much more serious feature.
  ADD COLUMN IF NOT EXISTS stake TEXT,
  -- Set when the challenge is settled so a finished one renders from the
  -- stored result rather than being recomputed on every page load — and so a
  -- later stat correction can't silently rewrite history.
  ADD COLUMN IF NOT EXISTS final_standings JSONB;

COMMENT ON COLUMN scc_challenges.stake IS
  'What the loser owes, agreed between players. Free text, never money — the '
  'club wallet is not something a challenge should be able to move.';

COMMENT ON COLUMN scc_challenges.final_standings IS
  'Frozen at settlement. A challenge that has ended must keep the numbers it '
  'ended on, even if a scorecard is corrected afterwards.';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'scc_challenges' AND column_name IN ('stake','final_standings')
ORDER BY column_name;
