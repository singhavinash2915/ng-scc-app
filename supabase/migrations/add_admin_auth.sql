-- Server-side admin password validation
-- The password hash is stored in the database, never exposed to the client

-- Create app_settings table to store the hashed admin password
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (block direct reads of the settings table)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies = nobody can read the table directly via API
-- Only the RPC function (which runs with SECURITY DEFINER) can access it

-- Store the admin password hash using pgcrypto
-- Password: scc@2026
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO app_settings (key, value)
VALUES ('admin_password_hash', crypt('scc@2026', gen_salt('bf')))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Create the RPC function that validates the password
-- SECURITY DEFINER = runs with the function creator's permissions (bypasses RLS)
CREATE OR REPLACE FUNCTION verify_admin_password(input_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT value INTO stored_hash
  FROM app_settings
  WHERE key = 'admin_password_hash';

  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$;

-- Optional: Function to change the admin password (run manually in SQL Editor)
-- Usage: SELECT update_admin_password('new_password_here');
CREATE OR REPLACE FUNCTION update_admin_password(new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE app_settings
  SET value = crypt(new_password, gen_salt('bf')), updated_at = NOW()
  WHERE key = 'admin_password_hash';

  RETURN FOUND;
END;
$$;
