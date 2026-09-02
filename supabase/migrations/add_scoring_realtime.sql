-- ─── Realtime for in-app scoring ──────────────────────────────────────────────
-- The Dashboard's live banner appears the moment an innings row is created by
-- the toss, and disappears when the result is published. Until this runs it can
-- only notice on its 30-second poll, so the club could be up to half a minute
-- into the first over before the app admits a match is on — and stay showing a
-- finished match for the same window afterwards.
--
-- scc_innings ONLY, deliberately. scc_ball_by_ball would fire an event on every
-- delivery to every member with the app open, and the banner does not need it:
-- the score it shows is refreshed by its own poll. This subscription is about
-- the banner appearing and vanishing at the right moment, not the runs.
--
-- Safe to run more than once.

ALTER TABLE public.scc_innings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scc_innings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scc_innings;
  END IF;
END $$;

-- Verify: should return one row.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'scc_innings';
