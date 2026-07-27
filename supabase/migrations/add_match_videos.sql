-- ─────────────────────────────────────────────────────────────────────────────
-- Match videos: full replays + highlight clips (YouTube-backed)
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Everything is a YouTube video id. A "replay" is the whole match; a "clip" is
-- THE SAME video with a start timestamp — so highlights cost nothing to make:
-- no editing, no uploading, no storage. Just note the time a wicket happened.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  video_id      TEXT NOT NULL,                    -- YouTube video id
  kind          TEXT NOT NULL DEFAULT 'clip',     -- 'replay' | 'clip'
  title         TEXT,                             -- "Full match" / "Avinash bowls him middle stump"
  start_seconds INT,                              -- clip start (NULL for a full replay)
  member_id     UUID REFERENCES members(id) ON DELETE SET NULL,  -- who it features → shows on their profile
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_videos_match  ON match_videos(match_id);
CREATE INDEX IF NOT EXISTS idx_match_videos_member ON match_videos(member_id);

ALTER TABLE match_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_videos_select" ON match_videos FOR SELECT USING (true);
CREATE POLICY "match_videos_all"    ON match_videos FOR ALL    USING (true);
