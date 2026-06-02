-- Add batting_run_outs column to member_cricket_stats
-- Tracks how many times a player was dismissed by run-out while batting

ALTER TABLE member_cricket_stats
  ADD COLUMN IF NOT EXISTS batting_run_outs INT DEFAULT 0;
