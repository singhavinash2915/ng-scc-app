-- Sangria Cricket Club Sample Data
-- Run this AFTER setup.sql in the Supabase SQL Editor

-- Insert sample members
INSERT INTO members (name, phone, email, status, balance, matches_played, join_date) VALUES
('Rahul Sharma', '9876543210', 'rahul.sharma@email.com', 'active', 2500, 15, '2024-01-15'),
('Amit Kumar', '9876543211', 'amit.kumar@email.com', 'active', 1800, 12, '2024-02-01'),
('Vijay Singh', '9876543212', 'vijay.singh@email.com', 'active', 3200, 18, '2023-11-20'),
('Pradeep Verma', '9876543213', 'pradeep.v@email.com', 'active', 500, 10, '2024-03-10'),
('Suresh Patel', '9876543214', 'suresh.patel@email.com', 'active', 4000, 20, '2023-06-15'),
('Rajesh Gupta', '9876543215', 'rajesh.g@email.com', 'active', 1200, 8, '2024-04-05'),
('Arun Nair', '9876543216', 'arun.nair@email.com', 'active', 2800, 14, '2023-09-22'),
('Deepak Yadav', '9876543217', 'deepak.y@email.com', 'active', 600, 6, '2024-05-12'),
('Sanjay Mehta', '9876543218', 'sanjay.m@email.com', 'active', 3500, 16, '2023-08-30'),
('Manoj Tiwari', '9876543219', 'manoj.t@email.com', 'active', 1500, 11, '2024-01-28'),
('Karan Malhotra', '9876543220', 'karan.m@email.com', 'active', 2200, 13, '2023-12-05'),
('Ravi Shankar', '9876543221', 'ravi.s@email.com', 'active', 900, 7, '2024-02-18'),
('Ashok Reddy', '9876543222', 'ashok.r@email.com', 'inactive', 0, 4, '2023-10-10'),
('Nitin Joshi', '9876543223', 'nitin.j@email.com', 'active', 1800, 9, '2024-03-25'),
('Vivek Chauhan', '9876543224', 'vivek.c@email.com', 'active', 2600, 15, '2023-07-14');

-- Insert sample matches
INSERT INTO matches (date, venue, opponent, result, our_score, opponent_score, match_fee, ground_cost, notes) VALUES
('2024-12-28', 'Central Park Ground', 'Royal Strikers', 'won', '186/4', '172/8', 200, 3000, 'Great batting performance'),
('2024-12-21', 'Sports Complex', 'Thunder Hawks', 'won', '156/6', '145/10', 250, 3500, 'Bowling dominated'),
('2024-12-14', 'City Stadium', 'Blue Warriors', 'lost', '134/10', '138/4', 200, 2800, 'Need to improve batting'),
('2024-12-07', 'Green Field', 'Star XI', 'won', '201/3', '189/7', 180, 2500, 'Century by Vijay'),
('2024-11-30', 'Central Park Ground', 'Cricket Kings', 'draw', '167/8', '167/9', 200, 3000, 'Thrilling finish'),
('2024-11-23', 'Sports Complex', 'Super Strikers', 'won', '178/5', '156/10', 250, 3500, 'All-round performance'),
('2024-11-16', 'Hill View Ground', 'Mountain Lions', 'lost', '142/10', '145/6', 220, 2800, 'Close match'),
('2024-11-09', 'Green Field', 'City Challengers', 'won', '195/4', '180/8', 180, 2500, 'Dominant win'),
('2025-01-04', 'Central Park Ground', 'Elite XI', 'upcoming', NULL, NULL, 200, 3000, 'New year opener'),
('2025-01-11', 'Sports Complex', 'Victory Club', 'upcoming', NULL, NULL, 250, 3500, NULL);

-- Insert sample transactions
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT
  NOW() - INTERVAL '10 days',
  'deposit',
  1000,
  id,
  'Monthly contribution'
FROM members WHERE name = 'Rahul Sharma';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT
  NOW() - INTERVAL '8 days',
  'deposit',
  1500,
  id,
  'Advance deposit'
FROM members WHERE name = 'Vijay Singh';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT
  NOW() - INTERVAL '5 days',
  'deposit',
  2000,
  id,
  'Quarterly payment'
FROM members WHERE name = 'Suresh Patel';

INSERT INTO transactions (date, type, amount, description) VALUES
(NOW() - INTERVAL '7 days', 'expense', -1500, 'Cricket balls - 6 pieces'),
(NOW() - INTERVAL '4 days', 'expense', -800, 'First aid kit supplies'),
(NOW() - INTERVAL '2 days', 'expense', -2000, 'New batting gloves - 2 pairs');

-- Insert sample member requests
INSERT INTO member_requests (name, phone, email, experience, message, status) VALUES
('Ankit Rawat', '9876543230', 'ankit.r@email.com', '3 years playing for college team', 'Looking to join a competitive club', 'pending'),
('Rohit Deshpande', '9876543231', 'rohit.d@email.com', '5 years experience, district level', 'Heard great things about Sangria CC', 'pending');
