-- Add feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow public access (client-side auth via admin password)
CREATE POLICY "Allow public read access" ON feedback FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON feedback FOR DELETE USING (true);
