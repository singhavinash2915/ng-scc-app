-- ─────────────────────────────────────────────────────────────────────────────
-- Squad numbers from the printed jerseys
-- Run in Supabase Dashboard → SQL Editor.
--
-- The print sheets are the source of truth, not the jersey_number column that
-- was already there: it held 724 for Vaibhav and 21 for Dhawal where the shirt
-- says 7 and 6. What a member sees on their card has to match what they pull
-- over their head.
--
-- Names are matched EXACTLY, one statement each, rather than by a fuzzy rule.
-- Three Shubhams and a "Prakash" that contains "akash" are exactly how an
-- automated match puts the wrong number on the wrong player, and a squad
-- number is the one thing every member will check.
--
-- Aastha and Vishal are deliberately absent — extra shirts, not squad members.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE members
  -- Which side they wear. Separate from any auction/squad table: a jersey is
  -- printed once and doesn't change when a squad is re-picked.
  ADD COLUMN IF NOT EXISTS jersey_team TEXT
    CHECK (jersey_team IS NULL OR jersey_team IN ('brahmos', 'agni'));

COMMENT ON COLUMN members.jersey_team IS
  'Printed jersey allegiance — Brahmos or Agni. Set from the print run.';

-- ── SCC Brahmos ──────────────────────────────────────────────────────────────
UPDATE members SET jersey_team='brahmos', jersey_number=44 WHERE name='Mandar Markandeya';
UPDATE members SET jersey_team='brahmos', jersey_number=18 WHERE name='Niraj Prakash Parmeshwar';
UPDATE members SET jersey_team='brahmos', jersey_number=11 WHERE name='Shakhil Srivastava';
UPDATE members SET jersey_team='brahmos', jersey_number=18 WHERE name='AKASH JADHAV';
UPDATE members SET jersey_team='brahmos', jersey_number=3  WHERE name='Anand';
UPDATE members SET jersey_team='brahmos', jersey_number=69 WHERE name='Bharat Mishra';
UPDATE members SET jersey_team='brahmos', jersey_number=7  WHERE name='Adarsh Dwivedi';
UPDATE members SET jersey_team='brahmos', jersey_number=10 WHERE name='Aprmay Kumar';
UPDATE members SET jersey_team='brahmos', jersey_number=2  WHERE name='Nikhil';
UPDATE members SET jersey_team='brahmos', jersey_number=21 WHERE name='Soumyaranjan Mohapatra';
UPDATE members SET jersey_team='brahmos', jersey_number=14 WHERE name='Ramendra Singh';
UPDATE members SET jersey_team='brahmos', jersey_number=2  WHERE name='Gourav Shrivastava';
UPDATE members SET jersey_team='brahmos', jersey_number=7  WHERE name='Vaibhav Shrivastav';
UPDATE members SET jersey_team='brahmos', jersey_number=12 WHERE name='Prateek Singh';

-- ── SCC Agni ─────────────────────────────────────────────────────────────────
UPDATE members SET jersey_team='agni', jersey_number=7   WHERE name='Honey Porwal';
UPDATE members SET jersey_team='agni', jersey_number=27  WHERE name='Shaan';
UPDATE members SET jersey_team='agni', jersey_number=6   WHERE name='Dhawal Jain';
UPDATE members SET jersey_team='agni', jersey_number=45  WHERE name='Ajinkya Gharpure';
UPDATE members SET jersey_team='agni', jersey_number=12  WHERE name='Raushan Kumar';
UPDATE members SET jersey_team='agni', jersey_number=7   WHERE name='Avinash Singh';
UPDATE members SET jersey_team='agni', jersey_number=101 WHERE name='Sumit Dutta';
UPDATE members SET jersey_team='agni', jersey_number=98  WHERE name='Sushil Yadav';
UPDATE members SET jersey_team='agni', jersey_number=9   WHERE name='Arpan Thakur';
UPDATE members SET jersey_team='agni', jersey_number=11  WHERE name='Rohan Rao';
UPDATE members SET jersey_team='agni', jersey_number=30  WHERE name='Abhishek Manhas';
UPDATE members SET jersey_team='agni', jersey_number=8   WHERE name='Piyush Pankaj';
UPDATE members SET jersey_team='agni', jersey_number=21  WHERE name='Saurabh Lele';

-- ── Still to confirm ─────────────────────────────────────────────────────────
-- Three shirts have no unambiguous member, so they are NOT set here. Putting a
-- squad number on the wrong player is worse than leaving it blank:
--
--   Adii    · Agni    #67   nickname, no matching member
--   Cheeku  · Agni    #18   nickname, no matching member
--   Shubham · Brahmos #24   three Shubhams — Chavhan, Garethiya, Patil
--
-- Fill in with, e.g.:
--   UPDATE members SET jersey_team='agni', jersey_number=67 WHERE name='<full name>';

-- ── Check it worked ──────────────────────────────────────────────────────────
SELECT jersey_team, count(*) AS players, min(jersey_number) AS lowest, max(jersey_number) AS highest
FROM members WHERE jersey_team IS NOT NULL GROUP BY jersey_team;

-- Numbers worn by two players on the SAME side — printed that way, shown here
-- so the club can decide whether it was intended.
SELECT jersey_team, jersey_number, string_agg(name, ', ') AS players
FROM members WHERE jersey_team IS NOT NULL
GROUP BY jersey_team, jersey_number HAVING count(*) > 1;
