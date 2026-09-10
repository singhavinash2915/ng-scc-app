-- ─── Where the database size actually is (read-only) ─────────────────────────
-- Changes nothing. Run it in the SQL Editor on the SCC project and it reports
-- what is using disk, so the "0.532 / 0.5 GB" figure can be attributed instead
-- of guessed at.
--
-- The reason this matters: every table in this app adds up to roughly 6 MB of
-- JSON. If SCC's own database really is ~532 MB, the difference is not data —
-- it is dead rows and index bloat left behind by months of updates, and a
-- VACUUM FULL reclaims it. If SCC turns out to be small, then the org figure is
-- mostly the other project and pausing it will not help, because a paused
-- project keeps its disk.

-- 1. The whole database, one number. Compare this against the dashboard.
SELECT pg_size_pretty(pg_database_size(current_database())) AS total_database_size;

-- 2. The twenty largest tables, with their indexes and TOAST counted, plus how
--    many dead rows are sitting in each. A table whose dead count rivals its
--    live count is bloat waiting to be reclaimed.
SELECT c.relname                                            AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid))        AS total,
       pg_size_pretty(pg_relation_size(c.oid))              AS heap,
       pg_size_pretty(pg_indexes_size(c.oid))               AS indexes,
       s.n_live_tup                                         AS live_rows,
       s.n_dead_tup                                         AS dead_rows,
       s.last_autovacuum
FROM   pg_class c
JOIN   pg_namespace n  ON n.oid = c.relnamespace
LEFT   JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE  c.relkind = 'r'
  AND  n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER  BY pg_total_relation_size(c.oid) DESC
LIMIT  20;

-- 3. Size by schema. Supabase's own schemas (auth, storage, realtime) and the
--    extensions carry real weight on a small project, and they are not
--    something to go deleting from — worth seeing before blaming app data.
SELECT n.nspname                                              AS schema,
       pg_size_pretty(sum(pg_total_relation_size(c.oid)))     AS total
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  c.relkind IN ('r', 'm')
GROUP  BY n.nspname
ORDER  BY sum(pg_total_relation_size(c.oid)) DESC
LIMIT  15;
