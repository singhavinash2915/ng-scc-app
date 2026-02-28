-- Sponsor Showcase: Store club sponsor information
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS with public access (same pattern as other tables)
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on sponsors"
  ON sponsors FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on sponsors"
  ON sponsors FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on sponsors"
  ON sponsors FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access on sponsors"
  ON sponsors FOR DELETE USING (true);

-- 3. Create storage bucket for sponsor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsors', 'sponsors', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for sponsor logos
CREATE POLICY "Public read access for sponsor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsors');

CREATE POLICY "Public upload access for sponsor logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sponsors');

CREATE POLICY "Public update access for sponsor logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sponsors');

CREATE POLICY "Public delete access for sponsor logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sponsors');
