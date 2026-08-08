-- ─────────────────────────────────────────────────────────────────────────────
-- Internal teams: allow Brahmos and Agni alongside Dhurandars and Bazigars
-- Run once in Supabase Dashboard → SQL Editor.
--
-- The club now runs two internal competitions and intends to keep both:
--   · Dhurandars vs Bazigars — the original rivalry, still to be played again
--   · SCC MahaSangram        — Brahmos vs Agni, from the 2026-27 auction
--
-- Both are stored as match_type='internal'. Two columns were locked to the old
-- pair, so a Brahmos vs Agni result could not be saved at all:
--
--   matches.winning_team    — who won an internal match
--   match_players.team      — which side a player turned out for
--
-- This WIDENS both. Nothing is removed: every existing Dhurandars/Bazigars row
-- stays valid, and their fixtures keep working exactly as before.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop the old CHECK constraints ────────────────────────────────────────
-- They were created inline, so Postgres named them itself and the name can
-- differ between environments. Find them by the column they guard rather than
-- guessing, which also makes this safe to run twice.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class     rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'c'
      AND (   (rel.relname = 'matches'       AND att.attname = 'winning_team')
           OR (rel.relname = 'match_players' AND att.attname = 'team'))
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', c.relname, c.conname);
    RAISE NOTICE 'dropped % on %', c.conname, c.relname;
  END LOOP;
END $$;

-- ── 2. Re-add them with both rivalries allowed ───────────────────────────────
ALTER TABLE matches
  ADD CONSTRAINT matches_winning_team_check
  CHECK (winning_team IS NULL OR winning_team IN
    ('dhurandars', 'bazigars', 'brahmos', 'agni'));

ALTER TABLE match_players
  ADD CONSTRAINT match_players_team_check
  CHECK (team IS NULL OR team IN
    ('dhurandars', 'bazigars', 'brahmos', 'agni'));

COMMENT ON COLUMN matches.winning_team IS
  'Winner of an internal match. dhurandars/bazigars = the original rivalry; '
  'brahmos/agni = SCC MahaSangram. Null for external matches and for anything undecided.';
COMMENT ON COLUMN match_players.team IS
  'Which internal side the player turned out for. Same four values as matches.winning_team.';

-- ── 3. Check it worked ───────────────────────────────────────────────────────
-- Expect two rows, each listing all four team names.
SELECT rel.relname AS table_name,
       con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE con.conname IN ('matches_winning_team_check', 'match_players_team_check')
ORDER BY rel.relname;

-- Nothing existing should have been invalidated — expect 0 rows.
SELECT id, date, winning_team
FROM matches
WHERE winning_team IS NOT NULL
  AND winning_team NOT IN ('dhurandars', 'bazigars', 'brahmos', 'agni');
