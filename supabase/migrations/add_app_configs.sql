-- app_configs: general-purpose key → JSONB store for client-readable configuration.
-- Kept separate from app_settings (which has no public policies, used only for the
-- server-side admin password hash accessed via SECURITY DEFINER RPC).

CREATE TABLE IF NOT EXISTS app_configs (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read app_configs"
  ON app_configs FOR SELECT TO public USING (true);

-- Public insert (upsert creates a row on first save)
CREATE POLICY "Public insert app_configs"
  ON app_configs FOR INSERT TO public WITH CHECK (true);

-- Public update
CREATE POLICY "Public update app_configs"
  ON app_configs FOR UPDATE TO public USING (true) WITH CHECK (true);
