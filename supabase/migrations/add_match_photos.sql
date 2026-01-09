-- Create match_photos table for storing team photos from matches
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Create match_photos table
CREATE TABLE IF NOT EXISTS match_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE match_photos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to match_photos" ON match_photos FOR SELECT USING (true);
CREATE POLICY "Allow public insert to match_photos" ON match_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to match_photos" ON match_photos FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from match_photos" ON match_photos FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_match_photos_match_id ON match_photos(match_id);
CREATE INDEX IF NOT EXISTS idx_match_photos_created_at ON match_photos(created_at DESC);

-- Create storage bucket for match photos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-photos', 'match-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for match photos
CREATE POLICY "Public read access for match-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'match-photos');

CREATE POLICY "Public upload access for match-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'match-photos');

CREATE POLICY "Public update access for match-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'match-photos');

CREATE POLICY "Public delete access for match-photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'match-photos');
