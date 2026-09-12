-- ─── The storage buckets never came across in the migration ──────────────────
-- The database moved to this project; Storage did not. Not just the files —
-- the BUCKETS. `select * from storage.buckets` returns nothing, so every upload
-- in the app fails at the first call, admin or not: match photos, member
-- avatars, sponsor logos. Nothing was wrong with the code; there was simply
-- nowhere to put a file.
--
-- Three buckets, the same three the old project had, public like everything
-- else in this schema (auth is the app's own admin password, and the policies
-- below match what avatars/match-photos/sponsors had before).
--
-- Size limits are set here because the old project had none and a phone photo
-- goes over 10MB easily: 10MB for photos and avatars, 2MB for a logo. Anything
-- larger is refused with a clear error rather than eating the member's data and
-- timing out.
--
-- Safe to run more than once.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',      'avatars',      true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']),
  ('match-photos', 'match-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']),
  ('sponsors',     'sponsors',     true,  2097152, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Policies ─────────────────────────────────────────────────────────────────
-- One set covering all three buckets rather than four policies per bucket.
-- Dropped first so re-running can't collide with a half-created set.
DROP POLICY IF EXISTS "scc public read"   ON storage.objects;
DROP POLICY IF EXISTS "scc public insert" ON storage.objects;
DROP POLICY IF EXISTS "scc public update" ON storage.objects;
DROP POLICY IF EXISTS "scc public delete" ON storage.objects;

CREATE POLICY "scc public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'match-photos', 'sponsors'));

CREATE POLICY "scc public insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('avatars', 'match-photos', 'sponsors'));

CREATE POLICY "scc public update" ON storage.objects FOR UPDATE
  USING (bucket_id IN ('avatars', 'match-photos', 'sponsors'));

CREATE POLICY "scc public delete" ON storage.objects FOR DELETE
  USING (bucket_id IN ('avatars', 'match-photos', 'sponsors'));

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect three public buckets, and four policies on storage.objects.
SELECT id, public, file_size_limit
FROM   storage.buckets
ORDER  BY id;

SELECT policyname, cmd
FROM   pg_policies
WHERE  schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'scc %'
ORDER  BY policyname;
