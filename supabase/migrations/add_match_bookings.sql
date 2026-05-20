-- ============================================================
-- Inter-Club Match Booking System
-- Season: Oct 2026 – May 2027
-- Weekday slots (Tue/Thu): ₹3,000 | Saturday slots (Oct–Feb): ₹4,000
-- ============================================================

-- Table: match_slots (pre-generated available booking slots)
CREATE TABLE IF NOT EXISTS match_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'saturday')),
  price DECIMAL(10,2) NOT NULL DEFAULT 3000,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: match_bookings (booking requests from visiting clubs)
CREATE TABLE IF NOT EXISTS match_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES match_slots(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  cricheroes_team_id TEXT,
  payment_method TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'razorpay')),
  payment_screenshot_url TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'verified')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  amount DECIMAL(10,2) NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  admin_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_bookings_slot_id ON match_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_match_bookings_status ON match_bookings(status);
CREATE INDEX IF NOT EXISTS idx_match_bookings_phone ON match_bookings(contact_phone);
CREATE INDEX IF NOT EXISTS idx_match_slots_date ON match_slots(date);

-- RLS
ALTER TABLE match_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_bookings ENABLE ROW LEVEL SECURITY;

-- Public read slots
CREATE POLICY "Public can view match_slots"
  ON match_slots FOR SELECT USING (true);

-- Admin can modify slots
CREATE POLICY "Anyone can insert match_slots"
  ON match_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update match_slots"
  ON match_slots FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete match_slots"
  ON match_slots FOR DELETE USING (true);

-- Bookings: public can read and insert; admin can update/delete
CREATE POLICY "Public can view match_bookings"
  ON match_bookings FOR SELECT USING (true);
CREATE POLICY "Public can insert match_bookings"
  ON match_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update match_bookings"
  ON match_bookings FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete match_bookings"
  ON match_bookings FOR DELETE USING (true);

-- Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-payments', 'booking-payments', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public can upload booking payments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'booking-payments');

CREATE POLICY "Public can read booking payments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-payments');

CREATE POLICY "Anyone can delete booking payments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'booking-payments');

-- ============================================================
-- Pre-generate booking slots for Oct 2026 – May 2027
-- ============================================================

-- Weekday slots (Tuesday=2, Thursday=4): Oct 2026 – May 2027
DO $$
DECLARE
  d DATE := '2026-10-01';
  end_date DATE := '2027-05-31';
BEGIN
  WHILE d <= end_date LOOP
    IF EXTRACT(DOW FROM d) IN (2, 4) THEN
      INSERT INTO match_slots (date, day_type, price)
      VALUES (d, 'weekday', 3000)
      ON CONFLICT (date) DO NOTHING;
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;
END $$;

-- Saturday slots: Oct 2026 – Feb 2027 only
DO $$
DECLARE
  d DATE := '2026-10-01';
  end_date DATE := '2027-02-28';
BEGIN
  WHILE d <= end_date LOOP
    IF EXTRACT(DOW FROM d) = 6 THEN
      INSERT INTO match_slots (date, day_type, price)
      VALUES (d, 'saturday', 4000)
      ON CONFLICT (date) DO NOTHING;
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;
END $$;
