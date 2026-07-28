-- ─────────────────────────────────────────────────────────────────────────────
-- Live streaming add-ons: crowd-sourced clip marks + "watching now" presence
-- Run once in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- "Clip that!" — any member watching the stream can mark a moment. After the
-- match an admin turns the marked moments into real clips in one tap, so the
-- members effectively become the highlights team.
CREATE TABLE IF NOT EXISTS live_clip_marks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    TEXT NOT NULL,                    -- the YouTube video being watched
  match_id    UUID REFERENCES matches(id) ON DELETE CASCADE,
  seconds     INT NOT NULL,                     -- seconds since the stream started
  label       TEXT,                             -- optional note ("what a catch!")
  marked_by   TEXT,                             -- member name or device id
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  converted   BOOLEAN DEFAULT false,            -- already turned into a clip?
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clip_marks_video ON live_clip_marks(video_id);

ALTER TABLE live_clip_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clip_marks_select" ON live_clip_marks FOR SELECT USING (true);
CREATE POLICY "clip_marks_all"    ON live_clip_marks FOR ALL    USING (true);

-- "Watching now" — a heartbeat row per device, refreshed every ~30s while the
-- watch page is open. Anyone seen in the last 2 minutes counts as watching.
CREATE TABLE IF NOT EXISTS live_viewers (
  device_id  TEXT PRIMARY KEY,
  name       TEXT,
  video_id   TEXT,
  last_seen  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_viewers_seen ON live_viewers(last_seen);

ALTER TABLE live_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_viewers_select" ON live_viewers FOR SELECT USING (true);
CREATE POLICY "live_viewers_all"    ON live_viewers FOR ALL    USING (true);
