-- ─── Guest players ───────────────────────────────────────────────────────────
-- Some external matches are short a player or two, so a friend fills in. They
-- are not members: they have no wallet, no season fund, no place on the
-- leaderboard, and their runs should never enter the club's books.
--
-- Deliberately NOT modelled as members with a 'guest' status. Thirty-six places
-- filter members by status === 'active', which would exclude guests from those —
-- but the Members list, club funds, leaderboards, MOM race and the auction pool
-- do not filter, and would quietly include them. A separate table keeps guests
-- out of every club statistic by construction rather than by remembering.
--
-- Their CricHeroes scorecard names already fall into the sync's "unmatched
-- names" list, where they can be ignored once, so no stats work is needed.
--
-- Safe to run more than once.


-- ── The person ───────────────────────────────────────────────────────────────
-- Kept between matches: the same friend fills in several times a season, and
-- retyping the name each time invites two spellings of one person.
CREATE TABLE IF NOT EXISTS public.guests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guests_name_uniq ON public.guests (lower(name));

-- ── The appearance ───────────────────────────────────────────────────────────
-- One row per guest per match. fee_amount is stored rather than read from the
-- match, because a fee set months later must not silently rewrite what somebody
-- actually handed over on the day.
CREATE TABLE IF NOT EXISTS public.match_guests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  guest_id    uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  fee_amount  numeric NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  fee_paid    boolean NOT NULL DEFAULT false,
  invited_by  uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- A guest plays a given match once.
  CONSTRAINT match_guests_once UNIQUE (match_id, guest_id)
);
CREATE INDEX IF NOT EXISTS match_guests_match_idx ON public.match_guests (match_id);
CREATE INDEX IF NOT EXISTS match_guests_guest_idx ON public.match_guests (guest_id);

ALTER TABLE public.guests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public guests"       ON public.guests;
DROP POLICY IF EXISTS "public match_guests" ON public.match_guests;
CREATE POLICY "public guests"       ON public.guests       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public match_guests" ON public.match_guests FOR ALL USING (true) WITH CHECK (true);


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect both tables present and empty.
SELECT 'guests' AS table, count(*) AS rows FROM public.guests
UNION ALL
SELECT 'match_guests', count(*) FROM public.match_guests;
