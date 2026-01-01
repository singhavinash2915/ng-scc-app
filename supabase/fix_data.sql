-- Fix Data Script
-- Run this in Supabase SQL Editor

-- ================================================
-- STEP 1: Add missing contributions (₹3000 each)
-- ================================================

-- Sudhakar Dama contribution
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Sudhakar Dama';

-- Update Sudhakar balance (was -1470, now -1470 + 3000 = 1530)
UPDATE members SET balance = balance + 3000 WHERE name = 'Sudhakar Dama';

-- Adarsh Dwivedi contribution
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Adarsh Dwivedi';

-- Update Adarsh balance (was -2465, now -2465 + 3000 = 535)
UPDATE members SET balance = balance + 3000 WHERE name = 'Adarsh Dwivedi';

-- Shaan contribution
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Shaan';

-- Shaan balance already includes contribution, no update needed

-- Shubham Garethiya contribution
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Shubham Garethiya';

-- Update Shubham balance (was -1605, now -1605 + 3000 = 1395)
UPDATE members SET balance = balance + 3000 WHERE name = 'Shubham Garethiya';

-- Piyush Pankaj contribution
INSERT INTO transactions (date, type, amount, member_id, description)
SELECT '2025-09-20', 'deposit', 3000, m.id, 'Season 2025-26 Contribution'
FROM members m WHERE m.name = 'Piyush Pankaj';

-- Update Piyush balance (was -420, now -420 + 3000 = 2580)
UPDATE members SET balance = balance + 3000 WHERE name = 'Piyush Pankaj';

-- ================================================
-- STEP 2: Update matches_played count for each member
-- Based on match attendance data from SQLite
-- ================================================

UPDATE members SET matches_played = 27 WHERE name = 'Sushil Yadav';
UPDATE members SET matches_played = 18 WHERE name = 'Sudhakar Dama';
UPDATE members SET matches_played = 10 WHERE name = 'Honey Porwal';
UPDATE members SET matches_played = 28 WHERE name = 'Niraj Prakash Parmeshwar';
UPDATE members SET matches_played = 1 WHERE name = 'Vaibhav Shrivastav';
UPDATE members SET matches_played = 1 WHERE name = 'Tarang Kumar';
UPDATE members SET matches_played = 14 WHERE name = 'Ajinkya Gharpure';
UPDATE members SET matches_played = 7 WHERE name = 'Rohan Rao';
UPDATE members SET matches_played = 25 WHERE name = 'Soumyaranjan Mohapatra';
UPDATE members SET matches_played = 16 WHERE name = 'Saurabh Lele';
UPDATE members SET matches_played = 30 WHERE name = 'Harshit Upadhyay';
UPDATE members SET matches_played = 2 WHERE name = 'Rajat Srivastava';
UPDATE members SET matches_played = 25 WHERE name = 'Raushan Kumar';
UPDATE members SET matches_played = 11 WHERE name = 'Anand';
UPDATE members SET matches_played = 17 WHERE name = 'Shubham Garethiya';
UPDATE members SET matches_played = 6 WHERE name = 'Animesh Saxena';
UPDATE members SET matches_played = 26 WHERE name = 'Nikhil';
UPDATE members SET matches_played = 21 WHERE name = 'Adarsh Dwivedi';
UPDATE members SET matches_played = 1 WHERE name = 'Shakhil Srivastava';
UPDATE members SET matches_played = 18 WHERE name = 'Aprmay Kumar';
UPDATE members SET matches_played = 21 WHERE name = 'Aaditya Jaiswal';
UPDATE members SET matches_played = 5 WHERE name = 'Arpan Thakur';
UPDATE members SET matches_played = 2 WHERE name = 'Piyush Pankaj';
UPDATE members SET matches_played = 5 WHERE name = 'Aditya Purohit';
UPDATE members SET matches_played = 22 WHERE name = 'Shaan';
UPDATE members SET matches_played = 15 WHERE name = 'Avinash';

-- ================================================
-- VERIFICATION
-- ================================================
-- SELECT name, balance, matches_played FROM members ORDER BY matches_played DESC;
