-- ─── 19 Nov 2026: one fixture entered twice ──────────────────────────────────
-- The 10 September match against Boundary Blasters was rained off and moved to
-- 19 November. That move worked — the rescheduled row still carries the fixture's
-- CricHeroes id (26922893) and its 07:00 start. A second, empty row for the same
-- match was then created on 8 September: no CricHeroes id, no start time.
--
-- The empty one goes. Nothing is attached to either — no players, polls,
-- comments, scorecard or transactions — so this removes a duplicate line from
-- the calendar and nothing else.
--
-- Safe to run more than once.

DELETE FROM public.matches
WHERE  id          = '0e2b28e7-5737-43e8-afd7-283e4c0d6dd3'
  AND  date        = '2026-11-19'
  AND  opponent    = 'Boundary Blasters'
  AND  ch_match_id IS NULL          -- never the one carrying the real fixture
  AND  start_time  IS NULL;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect exactly one row: ch_match_id 26922893, start_time 07:00.
SELECT date, opponent, venue, start_time, ch_match_id, result
FROM   public.matches
WHERE  date = '2026-11-19';
