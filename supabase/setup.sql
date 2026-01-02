-- Sangria Cricket Club Database Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  join_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  balance DECIMAL(10,2) DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  venue TEXT NOT NULL,
  opponent TEXT,
  result TEXT DEFAULT 'upcoming' CHECK (result IN ('won', 'lost', 'draw', 'upcoming', 'cancelled')),
  our_score TEXT,
  opponent_score TEXT,
  match_fee DECIMAL(10,2) DEFAULT 0,
  ground_cost DECIMAL(10,2) DEFAULT 0,
  other_expenses DECIMAL(10,2) DEFAULT 0,
  deduct_from_balance BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match Players (junction table)
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  fee_paid BOOLEAN DEFAULT FALSE,
  UNIQUE(match_id, member_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'match_fee', 'expense', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member Requests table
CREATE TABLE IF NOT EXISTS member_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  experience TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  venue TEXT NOT NULL,
  format TEXT DEFAULT 'T20' CHECK (format IN ('T20', 'ODI', 'T10', 'Tennis Ball', 'Other')),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  total_teams INTEGER,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  prize_money DECIMAL(10,2),
  our_position TEXT,
  result TEXT CHECK (result IN ('winner', 'runner_up', 'semi_finalist', 'quarter_finalist', 'group_stage', 'participated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Matches (junction table linking tournaments to matches)
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  stage TEXT DEFAULT 'group' CHECK (stage IN ('group', 'quarter_final', 'semi_final', 'final', 'league')),
  UNIQUE(tournament_id, match_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're using client-side auth)
-- Members policies
CREATE POLICY "Allow public read access to members" ON members FOR SELECT USING (true);
CREATE POLICY "Allow public insert to members" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to members" ON members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from members" ON members FOR DELETE USING (true);

-- Matches policies
CREATE POLICY "Allow public read access to matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Allow public insert to matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to matches" ON matches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from matches" ON matches FOR DELETE USING (true);

-- Match Players policies
CREATE POLICY "Allow public read access to match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "Allow public insert to match_players" ON match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to match_players" ON match_players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from match_players" ON match_players FOR DELETE USING (true);

-- Transactions policies
CREATE POLICY "Allow public read access to transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert to transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to transactions" ON transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from transactions" ON transactions FOR DELETE USING (true);

-- Member Requests policies
CREATE POLICY "Allow public read access to member_requests" ON member_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert to member_requests" ON member_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to member_requests" ON member_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from member_requests" ON member_requests FOR DELETE USING (true);

-- Tournaments policies
CREATE POLICY "Allow public read access to tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tournaments" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tournaments" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from tournaments" ON tournaments FOR DELETE USING (true);

-- Tournament Matches policies
CREATE POLICY "Allow public read access to tournament_matches" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tournament_matches" ON tournament_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tournament_matches" ON tournament_matches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from tournament_matches" ON tournament_matches FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_result ON matches(result);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_member_requests_status ON member_requests(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON tournaments(start_date);
