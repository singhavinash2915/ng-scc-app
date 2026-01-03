-- Create storage bucket for member avatars
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies using the correct Supabase syntax

-- Allow public to read/download avatar images
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow public to upload avatar images
CREATE POLICY "Public upload access for avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Allow public to update avatar images
CREATE POLICY "Public update access for avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

-- Allow public to delete avatar images
CREATE POLICY "Public delete access for avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');
