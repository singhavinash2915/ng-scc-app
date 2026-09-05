-- ─── MahaSangram: internal matches become first-class ─────────────────────────
-- This season is roughly a third internal (Brahmos vs Agni), and until now an
-- internal match contributed nothing to any individual number in the app — a
-- third of everyone's cricket was invisible. This migration is the data half of
-- fixing that. Safe to run more than once.
--
-- Three separate things, in order.


-- ── 1. Internal matches are not club wins ────────────────────────────────────
-- Every played internal match was stored as result='won'. SCC played itself, so
-- there was no opponent to beat: those ten rows were free wins sitting in the
-- club's record. Nothing surfaced them because every stats query filters
-- internal out, but the moment anything stops filtering they would have counted.
--
-- 'draw' is what the in-app scorer already writes for a finished internal match.
-- Who actually won is in winning_team, which is where the rivalry score reads
-- from, so no information is lost by this.

UPDATE public.matches
SET    result = 'draw'
WHERE  match_type = 'internal'
  AND  result = 'won';


-- ── 2. Delete the orphaned internal fixture ──────────────────────────────────
-- 13 Apr 2025: no winning_team, no players, no scorecard, no ball data, no
-- photos, no transactions, no comments, no tournament link. It records that a
-- match happened and nothing whatsoever about it, so it can only ever add one
-- to a count. Checked for dependents in every table that references match_id
-- before writing this; there are none.

DELETE FROM public.matches
WHERE  id = '8a9de443-79ef-4388-9d93-5dae89ba0e3d'
  AND  match_type = 'internal'
  AND  date = '2025-04-13';


-- ── 3. Per-scope player stats ────────────────────────────────────────────────
-- member_cricket_stats held one row per (member, season). It now holds one per
-- (member, season, scope) so external and MahaSangram are counted separately
-- and can be shown apart or added together.
--
-- Existing rows are all external — that is the only thing the sync has ever
-- written — so the default backfills them correctly.

ALTER TABLE public.member_cricket_stats
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'external';

ALTER TABLE public.member_cricket_stats
  DROP CONSTRAINT IF EXISTS member_cricket_stats_scope_check;
ALTER TABLE public.member_cricket_stats
  ADD CONSTRAINT member_cricket_stats_scope_check CHECK (scope IN ('external', 'internal'));

-- Combined figures cannot be derived from what was stored. An average needs the
-- number of times out, a strike rate needs balls faced, and an economy needs
-- balls bowled — and bowling_overs is in overs.balls notation ("34.3" is 34
-- overs and 3 balls), which cannot be added up. Adding two seasons' worth of
-- those columns would produce plausible, wrong numbers. These three are the raw
-- counts that CAN be added, so Combined is computed rather than approximated.
ALTER TABLE public.member_cricket_stats
  ADD COLUMN IF NOT EXISTS batting_balls      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batting_dismissals INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bowling_balls      INTEGER NOT NULL DEFAULT 0;

-- The sync upserts on this key, so it has to include scope or an internal sync
-- would overwrite the external row for the same member and season.
ALTER TABLE public.member_cricket_stats
  DROP CONSTRAINT IF EXISTS member_cricket_stats_member_id_season_key;
DROP INDEX IF EXISTS member_cricket_stats_member_season_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS member_cricket_stats_member_season_scope_uniq
  ON public.member_cricket_stats (member_id, season, scope);


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: no internal 'won' rows left, the orphan gone, and every existing
-- stats row marked external.
SELECT 'internal still won'  AS check, count(*) AS n FROM public.matches      WHERE match_type='internal' AND result='won'
UNION ALL
SELECT 'orphan still there',        count(*) FROM public.matches              WHERE id='8a9de443-79ef-4388-9d93-5dae89ba0e3d'
UNION ALL
SELECT 'stats rows external',       count(*) FROM public.member_cricket_stats WHERE scope='external'
UNION ALL
SELECT 'stats rows internal',       count(*) FROM public.member_cricket_stats WHERE scope='internal';
