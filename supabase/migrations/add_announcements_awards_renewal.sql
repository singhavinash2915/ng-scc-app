-- ─────────────────────────────────────────────────────────────────────────────
-- Announcements + Custom Awards + Membership Renewal
-- Run manually in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Announcements / Team wall ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'general',          -- 'general' | 'match' | 'congrats' | 'urgent'
  pinned BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by TEXT,                       -- admin display name
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned_created
  ON announcements(pinned DESC, created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "announcements_all"    ON announcements;
CREATE POLICY "announcements_all"    ON announcements FOR ALL    USING (true);


-- ── 2. Custom awards (Best Improved, Spirit of Cricket, etc.) ─────────────────
CREATE TABLE IF NOT EXISTS custom_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  award_name TEXT NOT NULL,              -- 'Best Improved Player', 'Spirit of Cricket', etc.
  description TEXT,
  season TEXT,                           -- '2025-26'
  icon TEXT,                             -- optional emoji like '🌟', '🏅'
  awarded_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_awards_member  ON custom_awards(member_id);
CREATE INDEX IF NOT EXISTS idx_custom_awards_season  ON custom_awards(season);

ALTER TABLE custom_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_awards_select" ON custom_awards;
CREATE POLICY "custom_awards_select" ON custom_awards FOR SELECT USING (true);
DROP POLICY IF EXISTS "custom_awards_all"    ON custom_awards;
CREATE POLICY "custom_awards_all"    ON custom_awards FOR ALL    USING (true);


-- ── 3. Membership renewal date on members ─────────────────────────────────────
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS membership_expires_at DATE,
  ADD COLUMN IF NOT EXISTS membership_tier       TEXT;  -- 'full' | 'associate' | 'youth' | null
