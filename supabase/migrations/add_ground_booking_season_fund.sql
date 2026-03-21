-- Season Fund & Ground Booking System
-- Tracks ground bookings, member advance payments, and seasonal fund management

-- 1. Seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget DECIMAL DEFAULT 0,
  status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to seasons" ON seasons FOR ALL USING (true) WITH CHECK (true);

-- 2. Ground Bookings table
CREATE TABLE IF NOT EXISTS ground_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  venue TEXT NOT NULL,
  time_slot TEXT,
  cost DECIMAL NOT NULL DEFAULT 0,
  opponent_collection DECIMAL DEFAULT 0,
  status TEXT CHECK (status IN ('booked', 'completed', 'cancelled')) DEFAULT 'booked',
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ground_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to ground_bookings" ON ground_bookings FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_ground_bookings_season ON ground_bookings(season_id);
CREATE INDEX idx_ground_bookings_date ON ground_bookings(date);
CREATE INDEX idx_ground_bookings_match ON ground_bookings(match_id);

-- 3. Season Fund Targets (per-member tiered targets)
CREATE TABLE IF NOT EXISTS season_fund_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  target_amount DECIMAL NOT NULL DEFAULT 0,
  tier TEXT CHECK (tier IN ('regular', 'occasional', 'other')) DEFAULT 'regular',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, member_id)
);

ALTER TABLE season_fund_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to season_fund_targets" ON season_fund_targets FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_season_fund_targets_season ON season_fund_targets(season_id);
CREATE INDEX idx_season_fund_targets_member ON season_fund_targets(member_id);

-- 4. Season Fund Payments (member contributions)
CREATE TABLE IF NOT EXISTS season_fund_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'online', 'bank_transfer', 'other')) DEFAULT 'cash',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE season_fund_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to season_fund_payments" ON season_fund_payments FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_season_fund_payments_season ON season_fund_payments(season_id);
CREATE INDEX idx_season_fund_payments_member ON season_fund_payments(member_id);
CREATE INDEX idx_season_fund_payments_date ON season_fund_payments(date);
