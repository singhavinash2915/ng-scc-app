-- Add admin_reply column to feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;

-- Add update policy if not exists
CREATE POLICY "Allow public update access" ON feedback FOR UPDATE USING (true) WITH CHECK (true);
