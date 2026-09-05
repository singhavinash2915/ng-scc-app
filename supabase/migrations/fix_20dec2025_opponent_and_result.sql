-- ─── 20 Dec 2025: wrong opponent, inverted result ────────────────────────────
-- Found while backfilling scorecards. This fixture is recorded as a WIN against
-- CricBot XI. Its CricHeroes scorecard (ch_match_id 20882304) is a different
-- match entirely:
--
--   Sangria Cricket Club   50/3 (5.0 ov)
--   BR bulls Unit A & D    56/3 (4.1 ov)
--   "BR bulls Unit A & D won by 7 wickets"
--
-- SCC batted first, made 50/3, and were chased down with seven wickets in hand.
-- The scores already stored on the row (50/3 and 56/3) match that exactly — it
-- is the opponent name and the result that are wrong, which is consistent with
-- this having been entered against the wrong fixture.
--
-- There are two matches on 20 Dec 2025 both labelled CricBot XI. The other one
-- (ch_match_id 18551688, 114/7 vs 110/9) is the real CricBot fixture and is NOT
-- touched here.
--
-- Effect: removes one win the club did not earn and records the loss it did.
-- The head-to-head table stops crediting this result to CricBot XI.
--
-- The row has no players, no transactions and no Man of the Match attached, so
-- nothing else needs adjusting alongside it. Safe to run more than once.

UPDATE public.matches
SET    opponent = 'BR bulls Unit A & D',
       result   = 'lost'
WHERE  id            = 'dd4be683-d716-4543-9ff6-e1bf24d999cd'
  AND  ch_match_id   = '20882304'      -- belt and braces: only the intended row
  AND  date          = '2025-12-20';


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect one row: BR bulls Unit A & D / lost / 50/3 / 56/3, and the other
-- 20 Dec fixture still CricBot XI / won.
SELECT date, opponent, result, our_score, opponent_score, ch_match_id
FROM   public.matches
WHERE  date = '2025-12-20'
ORDER  BY ch_match_id;
