-- ─── Internal matches are not club wins ──────────────────────────────────────
-- An internal match is SCC against SCC — Brahmos vs Agni. The club cannot beat
-- itself, so such a match must never move the club's win/loss record. The side
-- that won is recorded in winning_team, which is where the rivalry and
-- MahaSangram views read it from.
--
-- add_internal_match_scope.sql set these to 'draw' once already. They came back
-- as 'won' because the writers were never fixed: scripts/sync_internal.py,
-- scripts/sync_matches.py and both result forms on the Matches page all stored
-- 'won'. Those are fixed in the same change as this file, so this is the last
-- time the rows need correcting.
--
-- Effect: the Matches page counted 190 played / 102 won / 88 lost. It should
-- read 181 / 93 / 88 — the nine "wins" were internal matches.

BEGIN;

-- Show what is about to change (read this before committing).
SELECT date, opponent, result, winning_team
FROM   matches
WHERE  match_type = 'internal'
  AND  result IN ('won', 'lost')
ORDER  BY date;

UPDATE matches
SET    result = 'draw'
WHERE  match_type = 'internal'
  AND  result IN ('won', 'lost');

-- Guard: from here on the database refuses to store an internal match as a club
-- win or loss, whatever writes to it — including a sync script someone edits
-- later. NOT VALID skips re-checking history; the UPDATE above already cleaned it.
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_internal_never_won_lost;

ALTER TABLE matches
  ADD CONSTRAINT matches_internal_never_won_lost
  CHECK (match_type IS DISTINCT FROM 'internal' OR result NOT IN ('won', 'lost'))
  NOT VALID;

-- Confirm the club record afterwards: expect 93 won / 88 lost / 181 played.
SELECT result, COUNT(*)
FROM   matches
WHERE  match_type = 'external'
GROUP  BY result
ORDER  BY result;

COMMIT;
