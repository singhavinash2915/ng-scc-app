-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime for the live-stream switch
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The app used to poll app_configs every 60 seconds to notice that a stream had
-- started. That meant a member opening the app just after the switch was
-- flipped could wait a minute to be told there was cricket on — and the banner
-- outlived the match by the same minute. Both are the worst possible minute to
-- be wrong in.
--
-- Postgres only publishes changes for tables in the supabase_realtime
-- publication, so the subscription in useLiveStream is inert until this runs.
-- Nothing breaks without it; the 5-minute backstop poll still works, just
-- slowly.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_configs;
  END IF;
END $$;

-- Realtime sends the OLD row on updates only when the table has a full replica
-- identity. We don't read the old row, but without this the payload arrives
-- with nulls, which makes debugging this later needlessly confusing.
ALTER TABLE public.app_configs REPLICA IDENTITY FULL;
