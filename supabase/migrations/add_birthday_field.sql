-- Add birthday field to members table
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

ALTER TABLE members ADD COLUMN IF NOT EXISTS birthday DATE;
