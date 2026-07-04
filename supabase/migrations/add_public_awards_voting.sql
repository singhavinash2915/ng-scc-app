-- ─────────────────────────────────────────────────────────────────────────────
-- Public People's Awards voting + fresh categories for Awards Night 2025-26
-- Run once in Supabase Dashboard → SQL Editor.
--
-- What this does:
--   1. Lets ANYONE vote (guests included) — voter_id is now a device id, not a
--      member FK. Tallies are by nominee (still a member), so results are safe.
--   2. Clears all existing (test) votes so the party starts from zero.
--   3. Replaces the award categories with a fresh funny + spicy set.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow guest voters: drop the voter_id → members(id) foreign key.
--    voter_id stays a UUID column (the client sends a random per-device UUID),
--    the UNIQUE(category_id, voter_id) still enforces one vote per device.
ALTER TABLE season_award_votes
  DROP CONSTRAINT IF EXISTS season_award_votes_voter_id_fkey;

-- 2. Wipe existing votes (fresh start for the party).
DELETE FROM season_award_votes;

-- 3. Replace categories for the 2025-26 season.
DELETE FROM season_award_categories WHERE season = '2025-26';

INSERT INTO season_award_categories (name, emoji, season, is_active) VALUES
  -- 👑 Headline
  ('People''s Champion (Fan MVP)',                     '👑', '2025-26', true),
  -- 😂 Funny
  ('Funniest Player in the Squad',                     '😂', '2025-26', true),
  ('Loudest Appealer',                                 '🎤', '2025-26', true),
  ('Best Celebration / Victory Dance',                 '🕺', '2025-26', true),
  ('Best Sledger (Friendly Trash Talk)',               '🦴', '2025-26', true),
  ('Golden Duck Award (Best Sport About Getting Out)', '🦆', '2025-26', true),
  ('Most Fashionably Late',                            '⏰', '2025-26', true),
  ('Biggest WhatsApp Group Spammer',                   '📱', '2025-26', true),
  ('Most Likely to Blame the Pitch',                   '🧱', '2025-26', true),
  ('Main Character of the Season',                     '🎬', '2025-26', true),
  -- 🔥 Tense / debate-starters
  ('Best Under Pressure (Ice in the Veins)',           '❄️', '2025-26', true),
  ('Biggest Match-Winner',                             '🏆', '2025-26', true),
  ('Most Underrated Player',                           '💎', '2025-26', true),
  ('Batting for Your Life — Who Do You Pick?',         '🛡️', '2025-26', true),
  ('Captain Material for Next Season',                 '🧢', '2025-26', true);
