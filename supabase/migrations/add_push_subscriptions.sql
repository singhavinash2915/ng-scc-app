-- ─────────────────────────────────────────────────────────────────────────────
-- Web push subscriptions
-- Run once in Supabase Dashboard → SQL Editor.
--
-- One row per device that has opted in. The send-push Edge Function reads these
-- and delivers notifications ("🔴 SCC is LIVE", match reminders, etc.).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT NOT NULL UNIQUE,          -- the browser's push endpoint
  p256dh      TEXT NOT NULL,                 -- client public key
  auth        TEXT NOT NULL,                 -- client auth secret
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  name        TEXT,                          -- convenience label for admin
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_seen   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_member ON push_subscriptions(member_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subs_select" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_subs_all"    ON push_subscriptions FOR ALL    USING (true);
