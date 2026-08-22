-- ─────────────────────────────────────────────────────────────────────────────
-- Squad numbers from the printed jerseys
-- Run in Supabase Dashboard → SQL Editor.
--
-- From the two team lists, not the jersey_number column that was already there:
-- that held 724 for Vaibhav and 21 for Dhawal where the shirts say 07 and 06.
-- What a member sees on their card has to match what they pull over their head.
--
-- Names are matched EXACTLY, one statement each, rather than by a fuzzy rule.
-- Three Shubhams, two Adityas, and a "Niraj Prakash" that contains "akash" are
-- exactly how an automated match prints the wrong number against the wrong
-- player — on the one field every member will check.
--
-- Nicknames resolved by the club: Cheeku = Rajat Srivastava, Adii = Aditya
-- Purohit, Shubham = Shubham Garethiya.
--
-- Aastha (#17) and Vishal (#06) are deliberately absent — extra shirts, not
-- squad members.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE members
  -- Which side they wear. Separate from any squad table: a jersey is printed
  -- once and doesn't change when a squad is re-picked.
  ADD COLUMN IF NOT EXISTS jersey_team TEXT
    CHECK (jersey_team IS NULL OR jersey_team IN ('brahmos', 'agni')),
  -- Kept because reprints and new joiners need it, and it lives nowhere else.
  ADD COLUMN IF NOT EXISTS jersey_size TEXT,
  ADD COLUMN IF NOT EXISTS jersey_sleeve TEXT
    CHECK (jersey_sleeve IS NULL OR jersey_sleeve IN ('half', 'full'));

COMMENT ON COLUMN members.jersey_team IS 'Printed jersey allegiance — set from the print run.';

-- ── SCC Agni ─────────────────────────────────────────────────────────────────
UPDATE members SET jersey_team='agni', jersey_number=7,   jersey_size='XL',  jersey_sleeve='half' WHERE name='Avinash Singh';
UPDATE members SET jersey_team='agni', jersey_number=7,   jersey_size='L',   jersey_sleeve='half' WHERE name='Honey Porwal';
UPDATE members SET jersey_team='agni', jersey_number=8,   jersey_size='XXL', jersey_sleeve='half' WHERE name='Piyush Pankaj';
UPDATE members SET jersey_team='agni', jersey_number=101, jersey_size='XL',  jersey_sleeve='half' WHERE name='Sumit Dutta';
UPDATE members SET jersey_team='agni', jersey_number=98,  jersey_size='XL',  jersey_sleeve='full' WHERE name='Sushil Yadav';
UPDATE members SET jersey_team='agni', jersey_number=27,  jersey_size='L',   jersey_sleeve='full' WHERE name='Shaan';
UPDATE members SET jersey_team='agni', jersey_number=9,   jersey_size='XL',  jersey_sleeve='half' WHERE name='Arpan Thakur';
UPDATE members SET jersey_team='agni', jersey_number=6,   jersey_size='L',   jersey_sleeve='full' WHERE name='Dhawal Jain';
UPDATE members SET jersey_team='agni', jersey_number=21,  jersey_size='XXL', jersey_sleeve='half' WHERE name='Saurabh Lele';
UPDATE members SET jersey_team='agni', jersey_number=11,  jersey_size='XL',  jersey_sleeve='full' WHERE name='Rohan Rao';
UPDATE members SET jersey_team='agni', jersey_number=18,  jersey_size='L',   jersey_sleeve='full' WHERE name='Rajat Srivastava';   -- Cheeku
UPDATE members SET jersey_team='agni', jersey_number=30,  jersey_size='XL',  jersey_sleeve='full' WHERE name='Abhishek Manhas';
UPDATE members SET jersey_team='agni', jersey_number=45,  jersey_size='L',   jersey_sleeve='half' WHERE name='Ajinkya Gharpure';
UPDATE members SET jersey_team='agni', jersey_number=67,  jersey_size='XL',  jersey_sleeve='full' WHERE name='Aditya Purohit';     -- Adii
UPDATE members SET jersey_team='agni', jersey_number=12,  jersey_size='L',   jersey_sleeve='full' WHERE name='Raushan Kumar';

-- ── SCC Brahmos ──────────────────────────────────────────────────────────────
-- Sizes here are chest measurements where the list gave them that way.
UPDATE members SET jersey_team='brahmos', jersey_number=18, jersey_size='42',      jersey_sleeve='half' WHERE name='AKASH JADHAV';
UPDATE members SET jersey_team='brahmos', jersey_number=12, jersey_size='44',      jersey_sleeve='full' WHERE name='Prateek Singh';
UPDATE members SET jersey_team='brahmos', jersey_number=24, jersey_size='42',      jersey_sleeve='full' WHERE name='Shubham Garethiya';
UPDATE members SET jersey_team='brahmos', jersey_number=3,  jersey_size='42',      jersey_sleeve='half' WHERE name='Anand';
UPDATE members SET jersey_team='brahmos', jersey_number=2,  jersey_size='44',      jersey_sleeve='full' WHERE name='Gourav Shrivastava';
UPDATE members SET jersey_team='brahmos', jersey_number=7,  jersey_size='44',      jersey_sleeve='full' WHERE name='Vaibhav Shrivastav';
UPDATE members SET jersey_team='brahmos', jersey_number=69, jersey_size='XL',      jersey_sleeve='full' WHERE name='Bharat Mishra';
UPDATE members SET jersey_team='brahmos', jersey_number=44, jersey_size='L',       jersey_sleeve='full' WHERE name='Mandar Markandeya';
UPDATE members SET jersey_team='brahmos', jersey_number=7,  jersey_size='XL (42)', jersey_sleeve='half' WHERE name='Adarsh Dwivedi';
UPDATE members SET jersey_team='brahmos', jersey_number=10, jersey_size='XL',      jersey_sleeve='full' WHERE name='Aprmay Kumar';
UPDATE members SET jersey_team='brahmos', jersey_number=18, jersey_size='L',       jersey_sleeve='full' WHERE name='Niraj Prakash Parmeshwar';
UPDATE members SET jersey_team='brahmos', jersey_number=2,  jersey_size='XL (42)', jersey_sleeve='full' WHERE name='Nikhil';
UPDATE members SET jersey_team='brahmos', jersey_number=21, jersey_size='XL (42)', jersey_sleeve='full' WHERE name='Soumyaranjan Mohapatra';
UPDATE members SET jersey_team='brahmos', jersey_number=14, jersey_size='XL (42)', jersey_sleeve='half' WHERE name='Ramendra Singh';
UPDATE members SET jersey_team='brahmos', jersey_number=11, jersey_size='L',       jersey_sleeve='half' WHERE name='Shakhil Srivastava';

-- ── Check it worked ──────────────────────────────────────────────────────────
-- Expect 15 and 15. Anything less means a name didn't match and that player
-- has no shirt on their card.
SELECT jersey_team, count(*) AS players FROM members
WHERE jersey_team IS NOT NULL GROUP BY jersey_team ORDER BY jersey_team;

-- Numbers worn by two players on the SAME side. Printed that way, listed here
-- so the club can decide whether it was intended — two 18s in one XI is a
-- problem for the scorer, not the app.
SELECT jersey_team, jersey_number, string_agg(name, ', ') AS players
FROM members WHERE jersey_team IS NOT NULL
GROUP BY jersey_team, jersey_number HAVING count(*) > 1
ORDER BY jersey_team, jersey_number;
