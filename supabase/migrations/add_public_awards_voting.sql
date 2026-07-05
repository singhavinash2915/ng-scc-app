-- ─────────────────────────────────────────────────────────────────────────────
-- Public People's Awards voting + fresh categories for Awards Night 2025-26
-- Run once in Supabase Dashboard → SQL Editor.
--
-- What this does:
--   1. Squad-only voting: voter_id is the voting MEMBER's id (so UNIQUE
--      (category_id, voter_id) = one vote per member). device_id records which
--      phone cast it, so a member's identity is bound to one device (no cycling
--      through names to stuff votes).
--   2. Clears all existing (test) votes so the party starts from zero.
--   3. Replaces the award categories with a fresh funny + spicy set.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the old voter_id → members(id) FK (we manage identity in-app) and add
--    a device_id column used to bind a member's vote to a single device.
ALTER TABLE season_award_votes
  DROP CONSTRAINT IF EXISTS season_award_votes_voter_id_fkey;
ALTER TABLE season_award_votes
  ADD COLUMN IF NOT EXISTS device_id TEXT;

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
