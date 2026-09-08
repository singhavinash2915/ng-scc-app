-- ─── Season 2026-27 starts on the 1st, not the 14th ──────────────────────────
-- The seasons row says 14 September. The app's own season definition — the one
-- every leaderboard, ranking and "this season" figure uses — runs 1 September to
-- 31 August. The two disagreeing is not cosmetic: the Annual Report takes its
-- "Season 2026-27" period from this row, so it reports the season as ₹0 in,
-- ₹0 out, having excluded everything that happened in the first fortnight.
--
-- That fortnight is not quiet. Six members paid ₹27,000 between the 4th and the
-- 8th, and ₹1,50,000 went to the Four Star owner on the 5th — the largest single
-- payment of the season, sitting outside the season it belongs to.
--
-- The 14th appears to be arbitrary: it is not the first fixture (10 September,
-- since moved) and not the first booked slot (1 October).
--
-- Safe to run more than once.

UPDATE public.seasons
SET    start_date = '2026-09-01'
WHERE  name       = 'Season 2026-27'
  AND  start_date = '2026-09-14';


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: 2026-09-01 → 2027-05-31, and the three figures that were being
-- excluded now falling inside the window.
SELECT s.name, s.start_date, s.end_date,
       (SELECT to_char(coalesce(sum(amount),0), 'FM999,999,999')
          FROM public.season_fund_payments p
         WHERE p.date BETWEEN s.start_date AND s.end_date)   AS member_money_in_window,
       (SELECT to_char(coalesce(sum(amount),0), 'FM999,999,999')
          FROM public.ground_payments g
         WHERE g.date BETWEEN s.start_date AND s.end_date)   AS ground_paid_in_window
FROM   public.seasons s
WHERE  s.name = 'Season 2026-27';
