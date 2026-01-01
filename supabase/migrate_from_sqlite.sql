-- Migration Script: SQLite to Supabase
-- Run this in your Supabase SQL Editor
-- First, clear existing sample data, then insert real data

-- ================================================
-- STEP 1: Clear existing sample/test data
-- ================================================
DELETE FROM match_players;
DELETE FROM transactions;
DELETE FROM matches;
DELETE FROM members;
DELETE FROM member_requests;

-- ================================================
-- STEP 2: Insert Members (from team_players + player_balances)
-- ================================================
INSERT INTO members (name, phone, email, status, balance, matches_played, join_date) VALUES
('Avinash', '8888546860', NULL, 'active', 1620, 0, '2025-09-20'),
('Sushil Yadav', '7985592469', NULL, 'active', 160, 0, '2025-09-22'),
('Sudhakar Dama', '8151005656', NULL, 'active', -1470, 0, '2025-09-22'),
('Honey Porwal', '8209965014', NULL, 'active', 2170, 0, '2025-09-22'),
('Niraj Prakash Parmeshwar', '8975575381', NULL, 'active', -2450, 0, '2025-09-22'),
('Vaibhav Shrivastav', '9981385050', NULL, 'active', -200, 0, '2025-09-29'),
('Tarang Kumar', '9690700826', NULL, 'active', -210, 0, '2025-09-29'),
('Ajinkya Gharpure', '9860519796', NULL, 'active', 1970, 0, '2025-09-29'),
('Rohan Rao', '9011661694', NULL, 'active', 1950, 0, '2025-09-29'),
('Soumyaranjan Mohapatra', '9886348524', NULL, 'active', 1170, 0, '2025-09-29'),
('Saurabh Lele', '8007619300', NULL, 'active', 140, 0, '2025-09-29'),
('Harshit Upadhyay', '9412168825', NULL, 'active', 115, 0, '2025-09-29'),
('Rajat Srivastava', '8999157008', NULL, 'active', 0, 0, '2025-09-29'),
('Raushan Kumar', '6287871538', NULL, 'active', 955, 0, '2025-09-29'),
('Anand', '8593988691', NULL, 'active', -990, 0, '2025-09-29'),
('Shubham Garethiya', '7290899013', NULL, 'active', -1605, 0, '2025-09-29'),
('Animesh Saxena', '7030624455', NULL, 'active', -210, 0, '2025-09-30'),
('Nikhil', '8840142181', NULL, 'active', 150, 0, '2025-09-30'),
('Adarsh Dwivedi', '9479864570', NULL, 'active', -2465, 0, '2025-09-30'),
('Shakhil Srivastava', '8601608555', NULL, 'active', -200, 0, '2025-10-04'),
('Aprmay Kumar', '6299377808', NULL, 'active', 1195, 0, '2025-10-04'),
('Aaditya Jaiswal', '9414645414', NULL, 'active', 730, 0, '2025-10-04'),
('Arpan Thakur', '7504141694', NULL, 'active', 2405, 0, '2025-10-04'),
('Piyush Pankaj', '8888723497', NULL, 'active', -420, 0, '2025-10-11'),
('Aditya Purohit', '9930486368', NULL, 'active', -1035, 0, '2025-10-11'),
('Shaan', NULL, NULL, 'active', 580, 0, '2025-09-20');

-- ================================================
-- STEP 3: Insert Matches
-- ================================================
INSERT INTO matches (date, venue, opponent, result, our_score, opponent_score, match_fee, ground_cost, notes) VALUES
('2025-10-03', 'A2Z Lavale', 'All Whites', 'won', NULL, NULL, 210, 0, 'M1'),
('2025-10-02', 'A2Z Lavale', 'Yashwin Stars', 'lost', NULL, NULL, 210, 0, 'M2'),
('2025-10-05', 'MCG', 'MetroJazz Warriors', 'won', NULL, NULL, 290, 0, 'M3'),
('2025-10-09', 'A2Z Lavale', 'All Whites', 'won', NULL, NULL, 210, 0, 'M4'),
('2025-10-11', 'Sparx A1', 'Ella RockStars', 'won', NULL, NULL, 320, 0, 'M5'),
('2025-10-14', 'A2Z Lavale', 'Mystic', 'lost', NULL, NULL, 210, 0, 'M6'),
('2025-10-16', 'A2Z Lavale', 'All Whites', 'lost', NULL, NULL, 210, 0, 'M7'),
('2025-10-24', 'Four Star', 'Yashwin Hinjewadi', 'won', NULL, NULL, 220, 0, 'M8'),
('2025-10-23', 'A2Z Lavale', 'Game Changers', 'won', NULL, NULL, 210, 0, 'M9'),
('2025-11-04', 'A2Z Lavale', 'All Whites', 'lost', NULL, NULL, 175, 0, 'M10'),
('2025-11-09', 'Sparx A1', 'Vikings XI', 'won', NULL, NULL, 270, 0, 'M11'),
('2025-11-11', 'A2Z Lavale', 'Riviera Game Changers', 'won', NULL, NULL, 220, 0, 'M12'),
('2025-11-13', 'A2Z Lavale', 'No Mercy X1', 'won', NULL, NULL, 220, 0, 'M13'),
('2025-11-15', 'Four Star', 'Deadly Boyz', 'lost', NULL, NULL, 275, 0, 'M14'),
('2025-11-16', 'Infinity', 'Tinsel County', 'lost', NULL, NULL, 210, 0, 'M15'),
('2025-11-18', 'A2Z Lavale', 'The Legenders', 'lost', NULL, NULL, 185, 0, 'M16'),
('2025-11-20', 'Infinity', 'TopGuns', 'lost', NULL, NULL, 200, 0, 'M17'),
('2025-11-22', 'Chandkhed', 'Park Connect Chalengers', 'won', NULL, NULL, 300, 0, 'M18'),
('2025-11-23', 'Four Star', 'Deadly Boyz', 'lost', NULL, NULL, 280, 0, 'M19'),
('2025-11-25', 'A2Z Lavale', 'The Legenders', 'lost', NULL, NULL, 200, 0, 'M20'),
('2025-11-29', 'Infinity', 'Tinsel County', 'lost', NULL, NULL, 210, 0, 'M21'),
('2025-11-30', 'Four Star', 'Yashwin Hinjewadi', 'won', NULL, NULL, 290, 0, 'M22'),
('2025-12-02', 'A2Z Lavale', 'Abhidante XI', 'won', NULL, NULL, 220, 0, 'M23'),
('2025-12-04', 'A2Z Lavale', 'All Whites', 'lost', NULL, NULL, 200, 0, 'M24'),
('2025-12-06', 'Cricathon', 'Bharat Blaze', 'lost', NULL, NULL, 290, 0, 'M25'),
('2025-12-09', 'A2Z Lavale', 'Riviera Game Changers', 'lost', NULL, NULL, 220, 0, 'M26'),
('2025-12-10', 'Infinity', 'KS Avengers', 'lost', NULL, NULL, 170, 0, 'M27'),
('2025-12-11', 'A2Z Lavale', 'No Mercy XI', 'won', NULL, NULL, 200, 0, 'M28'),
('2025-12-13', 'Infinity', 'Yashwin Stars', 'lost', NULL, NULL, 235, 0, 'M29'),
('2025-12-14', 'A2Z Lavale', 'Boundary Blunders', 'lost', NULL, NULL, 275, 0, 'M30'),
('2025-12-16', 'A2Z Lavale', 'No Mercy XI', 'won', NULL, NULL, 190, 0, 'M31'),
('2025-12-18', 'A2Z Lavale', 'Overtime Hitters', 'lost', NULL, NULL, 200, 0, 'M32'),
('2025-12-20', 'A2Z Lavale', 'CricBot XI', 'won', NULL, NULL, 275, 0, 'M33'),
('2025-12-21', 'A2Z Lavale', 'Township Heroes', 'won', NULL, NULL, 300, 0, 'M34'),
('2025-12-23', 'A2Z Lavale', 'No Mercy XI', 'won', NULL, NULL, 200, 0, 'M35'),
('2025-12-24', 'Infinity', 'YNR', 'won', NULL, NULL, 210, 0, 'M36'),
('2025-12-26', 'Infinity', 'YUCC', 'lost', NULL, NULL, 280, 0, 'M37'),
('2025-12-27', 'Infinity', 'Classic XI', 'lost', NULL, NULL, 250, 0, 'M38'),
('2025-12-28', 'A2Z Lavale', 'Titan Warriors', 'won', NULL, NULL, 275, 0, 'M39'),
('2025-12-30', 'A2Z Lavale', 'Riviera Game Changers', 'won', NULL, NULL, 200, 0, 'M40'),
('2025-12-31', 'A2Z Lavale', 'Deadly Boyz', 'won', NULL, NULL, 210, 0, 'M41');

-- ================================================
-- STEP 4: Insert Transactions (Contributions - Deposits)
-- ================================================
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Avinash';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Soumyaranjan Mohapatra';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Aaditya Jaiswal';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Aprmay Kumar';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Ajinkya Gharpure';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Sushil Yadav';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Shaan';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Rohan Rao';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Honey Porwal';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Harshit Upadhyay';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Saurabh Lele';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Nikhil';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-10-03', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Arpan Thakur';

INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-11-08', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Raushan Kumar';

-- ================================================
-- STEP 5: Insert Transactions (Team Spending - Expenses)
-- ================================================
INSERT INTO transactions (date, type, amount, description) VALUES
('2025-09-20', 'expense', -3550, 'Laser Guru Ball - 60 Balls for season'),
('2025-09-01', 'expense', -20000, 'Ground Advance - A2Z Sept to Oct 2025'),
('2026-02-01', 'expense', -9000, 'Ground Advance - MCG 3 Saturday FEB and MAR 2026'),
('2025-11-01', 'expense', -5500, 'Ground Advance - A2Z Two weekends Nov and Dec 2025'),
('2025-11-01', 'expense', -6500, 'Ground Advance - Sparx A1 2 Saturday Nov and Dec 2025'),
('2025-09-20', 'expense', -8250, 'Ground Advance - A2Z Two Jan Weekends'),
('2025-10-05', 'expense', -400, 'Balls plus keeper inner gloves'),
('2025-10-11', 'expense', -3500, '3rd Jan 2025 Saturday - Cricathon Weekend Match'),
('2025-10-11', 'expense', -3500, '6th Dec weekend match');

-- ================================================
-- VERIFICATION QUERIES (Run separately to check)
-- ================================================
-- SELECT COUNT(*) as member_count FROM members;
-- SELECT COUNT(*) as match_count FROM matches;
-- SELECT COUNT(*) as transaction_count FROM transactions;
-- SELECT name, balance FROM members ORDER BY balance DESC;
