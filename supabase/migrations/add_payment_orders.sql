-- Add payment orders table for Razorpay integration
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Allow public access (consistent with existing RLS pattern)
CREATE POLICY "Allow public read access" ON payment_orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON payment_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON payment_orders FOR UPDATE USING (true);
