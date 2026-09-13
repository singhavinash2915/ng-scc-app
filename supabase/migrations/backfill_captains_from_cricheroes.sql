-- ─── Backfill captains from CricHeroes ───────────────────────────────────────
-- The club only started naming a captain on the fixture in April 2026, so the
-- captaincy page had 24 matches to work with out of 191 — and four captains,
-- three of them unbeaten over a handful of games, which is not a record so much
-- as a rounding error.
--
-- CricHeroes has had the answer all along. Whoever scores a match there marks
-- the captain in the batting card — "Avinash Singh  (c)" — and that marker is
-- already sitting in the scorecards this app has synced. Reading it back gives
-- 110 more matches with a captain on file, going back to June 2025.
--
-- Names were resolved with the app's own strict matcher (src/lib/nameMatch.ts),
-- the one that refuses to guess between two members who share a first name.
-- Every one of the 110 resolved cleanly — no "close enough" in this file.
--
-- Only matches with NO captain recorded are touched. Three where the app and
-- CricHeroes disagree are left alone, listed at the bottom for a human to call.
--
-- Not covered: 58 matches whose scorecard carries no (c) at all (nothing to
-- read), and 9 internal matches, where both sides are SCC and the club-level
-- captain column cannot express two captains.
--
-- Safe to run more than once — each statement only fills a blank.

BEGIN;

-- What this is about to change.
SELECT count(*) AS matches_without_a_captain
FROM   matches
WHERE  captain_id IS NULL AND result IN ('won','lost','draw') AND match_type <> 'internal';

UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '3aac18c4-7a14-4865-95c2-900e005f06cf' AND captain_id IS NULL;  -- 2025-09-10 v The Sledgers → Adarsh Dwivedi
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '5052dc79-4dbe-4386-8793-61a4958ca279' AND captain_id IS NULL;  -- 2025-06-11 v Megapolis A2Z → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '20f0255f-642d-4c53-851e-5aaaf5cea75b' AND captain_id IS NULL;  -- 2026-04-08 v Overtime Hitters → Avinash Singh
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '4cb84ee3-2ec3-446b-aada-3b1013f898d2' AND captain_id IS NULL;  -- 2026-04-02 v Yashwin Star → Adarsh Dwivedi
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'fae4f1c1-6af8-4c85-965f-8b72557161f7' AND captain_id IS NULL;  -- 2026-04-01 v AgniVox → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '774c047b-6245-4f25-855d-547cd357a481' AND captain_id IS NULL;  -- 2026-03-28 v The Head n Tail → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '9b891dd7-de03-4051-a9bd-3a91f177a708' AND captain_id IS NULL;  -- 2026-03-21 v Tinsel County → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '75d3f733-363c-4f8b-92ac-7980938b7000' AND captain_id IS NULL;  -- 2026-03-17 v Yashwin Stars → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'c7057bc1-51b1-46cc-a8f0-035c72ad43f5' AND captain_id IS NULL;  -- 2026-03-15 v High Monk → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'ad13dd45-68d6-444c-92c9-ea05190967d8' AND captain_id IS NULL;  -- 2025-03-21 v KS Avengers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '859d9b45-829d-4a00-95f0-2e77ff416d9b' AND captain_id IS NULL;  -- 2025-12-24 v YNR → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'fddcd59b-bea9-458f-807a-f8ae6afa02f6' AND captain_id IS NULL;  -- 2025-03-01 v Weekend Warriors → Avinash Singh
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '9d4af8fa-4272-4825-a1e1-ccf33e0d55b8' AND captain_id IS NULL;  -- 2026-03-08 v Eon Yoddhas → Adarsh Dwivedi
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '4871d5cb-55a1-46c1-a60b-ca4ba57a993f' AND captain_id IS NULL;  -- 2026-03-05 v Fierce falcons → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '2bb925bf-e360-4940-bb48-8ed944f07dea' AND captain_id IS NULL;  -- 2026-02-21 v Deadly Boys → Avinash Singh
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '5d7ef0f7-58b4-4f81-a396-9dd34233246c' AND captain_id IS NULL;  -- 2026-02-11 v Bujurg XI  → Adarsh Dwivedi
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '2b8a19e8-c486-4bb0-b930-be68a38ddd58' AND captain_id IS NULL;  -- 2026-01-30 v Yashwin Hinjewadi → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '47393fee-3d3b-4914-ba32-3b87302d3546' AND captain_id IS NULL;  -- 2026-03-01 v Out of Office XI → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'd193a9cd-80dc-40c8-9e4e-a8510f040b34' AND captain_id IS NULL;  -- 2026-02-27 v Yashwin Hinjewadi → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '24f36c4c-fd3d-4101-a2dc-c60257274493' AND captain_id IS NULL;  -- 2026-02-25 v All Whites → Avinash Singh
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = 'bc46388c-9a32-4d4f-85d6-fad24aaf9276' AND captain_id IS NULL;  -- 2026-02-02 v Power Panthers → Adarsh Dwivedi
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = 'efa71243-6481-416c-b000-696b55409968' AND captain_id IS NULL;  -- 2026-01-22 v TopGuns → Adarsh Dwivedi
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'adbeca13-09f7-4e63-b3d0-e1956717f917' AND captain_id IS NULL;  -- 2026-01-13 v Abhidante Strikers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '98339d29-d187-4be3-9daf-67f9ab62693b' AND captain_id IS NULL;  -- 2025-12-30 v Riviera Game Changers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '12f5f283-3a9d-40b4-b3ff-38592d47b8c6' AND captain_id IS NULL;  -- 2026-01-11 v Tinsel County → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '0dc8dd52-07fc-4c2f-a612-8f69cddbc8be' AND captain_id IS NULL;  -- 2026-01-10 v Puri Sloggers → Adarsh Dwivedi
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4a9f0d56-e126-4278-8bb7-6881c9dbbe70' AND captain_id IS NULL;  -- 2026-01-03 v Bharat Blaze → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '701c4dfe-8c94-40e9-81c4-2add76f3c091' AND captain_id IS NULL;  -- 2025-12-27 v Classic XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'fd0a87cc-f4aa-4925-b3d1-dac6f38f2b30' AND captain_id IS NULL;  -- 2025-12-26 v YUCC → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '6df24be0-ae97-4b83-878f-0ab671e96a84' AND captain_id IS NULL;  -- 2025-12-21 v Township Heroes → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = '6b6f6f24-fe28-4a7b-a339-c8ec6539eda7' AND captain_id IS NULL;  -- 2025-12-18 v Overtime Hitters → Adarsh Dwivedi
UPDATE matches SET captain_id = '329137e8-ea3d-4a68-94a3-718e24e610cb' WHERE id = 'c0e3dea5-f4cc-46ec-a10b-b7c26d6cc1fb' AND captain_id IS NULL;  -- 2025-12-02 v Abhidante XI → Adarsh Dwivedi
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '008161b0-d85f-4ed0-9322-fd46e1aec1b9' AND captain_id IS NULL;  -- 2025-02-11 v KS Avengers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '996c3482-8c81-41f7-9f73-e293f334f896' AND captain_id IS NULL;  -- 2025-12-13 v Yashwin Stars → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'f433e609-5565-447a-b300-1af074257dd6' AND captain_id IS NULL;  -- 2025-12-06 v Bharat Blaze → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '141bbbb5-6546-44d5-a209-8660235edd1b' AND captain_id IS NULL;  -- 2025-11-20 v TopGuns → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'f18c1119-bc04-4e28-8f9d-df904e04e4c1' AND captain_id IS NULL;  -- 2025-12-11 v No Mercy XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'e4bb5b76-e195-4c93-9129-17b3744dcf33' AND captain_id IS NULL;  -- 2025-11-18 v The Legenders → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '84fa1914-bdd1-469a-b089-7f6aec69eb41' AND captain_id IS NULL;  -- 2025-11-23 v Deadly Boyz → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '1883bd14-8f85-431a-9ff3-786dcafc45a9' AND captain_id IS NULL;  -- 2025-11-16 v Tinsel County → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4101b7c4-37eb-4d6b-8e00-6a91fcd89d40' AND captain_id IS NULL;  -- 2025-11-15 v Deadly Boyz → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4a3a6a79-4065-4dcd-ba6a-cf8c66e487cd' AND captain_id IS NULL;  -- 2025-10-14 v Megapolis A2Z → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'dbbbe8ae-5a7d-4d81-b8c3-97e3759d04bc' AND captain_id IS NULL;  -- 2025-10-23 v Game Changers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '09a4ec82-55fa-4ffd-915e-a2bfe71e8768' WHERE id = '538df06e-7e14-4d49-8214-288cfdc5b036' AND captain_id IS NULL;  -- 2025-10-02 v Yashwin Stars → Sudhakar Dama
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '472b672c-c99e-44ef-88bb-9c75f802c49a' AND captain_id IS NULL;  -- 2025-10-17 v Yashwin Hinjawadi → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '09a4ec82-55fa-4ffd-915e-a2bfe71e8768' WHERE id = '7b975a80-f3bf-4bf3-8546-2595b9805e8c' AND captain_id IS NULL;  -- 2025-10-16 v All Whites → Sudhakar Dama
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4e4ae8a0-f91d-47ba-884d-df228868f484' AND captain_id IS NULL;  -- 2025-10-05 v MetroJazz Warriors → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '9a491d0a-d60a-42f9-9ebf-a5b5e93c3270' AND captain_id IS NULL;  -- 2025-11-15 v Deadly Boyz → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '613a211f-71a4-4637-af36-3e314d882a11' AND captain_id IS NULL;  -- 2026-03-06 v Yashwin Hinjewadi → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '2cd7950e-3809-41d6-a9f4-6bdef6654d5e' AND captain_id IS NULL;  -- 2025-09-25 v Elite Warriors → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '06672794-0d17-4da0-8732-1d8e95ec7c94' AND captain_id IS NULL;  -- 2026-04-18 v RA Challengers → Avinash Singh
UPDATE matches SET captain_id = '09a4ec82-55fa-4ffd-915e-a2bfe71e8768' WHERE id = 'ad31cb90-cb17-4118-b20d-01fd416563d2' AND captain_id IS NULL;  -- 2026-01-27 v Bharat Blaze → Sudhakar Dama
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4ffb05f9-c44f-4a4f-a28a-1953f3bf27e8' AND captain_id IS NULL;  -- 2025-09-24 v Bujurg 11 → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'b3c505b2-54b8-4482-b434-eba3abf88112' AND captain_id IS NULL;  -- 2026-01-18 v High Monks → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'd5739b05-5692-4f1b-84be-c25cc79dcc31' AND captain_id IS NULL;  -- 2025-09-20 v Incredible XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'c957fbd2-d2b0-4a24-bb90-d59db8f22e1c' AND captain_id IS NULL;  -- 2025-09-07 v Master Blasters → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'd86438d7-1c27-4757-9bbe-6b81d82067d7' AND captain_id IS NULL;  -- 2026-01-15 v CHS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '30531257-8a6e-475d-ae86-5541b52c2081' AND captain_id IS NULL;  -- 2025-12-20 v CricBot XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'aff9b118-0a62-4ab1-9856-c9a0d6b4b9e0' AND captain_id IS NULL;  -- 2025-12-14 v Boundary Blunders → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'e4c9c1ce-05e8-4238-a37e-e242115f9e70' AND captain_id IS NULL;  -- 2025-09-03 v SHRINATH 11 → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '3eb18d1d-95b2-4034-a048-4e999037465b' AND captain_id IS NULL;  -- 2025-06-07 v TACTICAL TITANS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'c59775ca-8f8c-4c22-9814-1893d5e6ffef' AND captain_id IS NULL;  -- 2025-05-07 v Wolfpack → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'f900803a-8972-44c1-837b-e190c715fbf7' AND captain_id IS NULL;  -- 2025-04-11 v ROYAL GLADIATORS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'b4862a45-e219-4355-b5a3-ed5d674a31ea' AND captain_id IS NULL;  -- 2025-03-24 v StellarStorm → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'd72ff2e1-b0a8-4c9d-8dd5-94f826b61413' AND captain_id IS NULL;  -- 2025-06-03 v Megapolis A2Z → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '550b3152-5ba3-401b-a154-8fd24da8c83c' AND captain_id IS NULL;  -- 2025-05-03 v TACTICAL TITANS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'c90b301e-9ecc-418d-921f-df9e41344d44' AND captain_id IS NULL;  -- 2025-04-11 v Kul Legacy Warriors → Avinash Singh
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = '1f84a992-624c-429d-a69d-a7967a65755b' AND captain_id IS NULL;  -- 2025-03-23 v Wolfpack → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = '3522c331-f917-4042-b8a6-1bcb51ea45e9' AND captain_id IS NULL;  -- 2025-05-18 v United Legends → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '1e60828d-4616-43bd-8117-268a9b3c91ed' AND captain_id IS NULL;  -- 2025-05-01 v Kul Legacy Warriors → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = 'b8bc7777-82f0-44d0-853c-cbc388ad99c8' AND captain_id IS NULL;  -- 2025-04-08 v Rising Titans → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = '8eb269d6-1a4b-43b2-a1f2-3954a07d0377' AND captain_id IS NULL;  -- 2025-03-23 v Wolfpack → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = '0af9b3d9-c031-4b96-a57e-58a62dc21845' AND captain_id IS NULL;  -- 2025-05-17 v Tinsel County → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '6571e062-9ac5-414f-b0d6-12e53b680327' WHERE id = '81288b1b-d27d-4fb5-a8e0-eec77da30e06' AND captain_id IS NULL;  -- 2025-04-30 v Out of Office XI → Niraj Prakash Parmeshwar
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '4cf08037-7a2d-4c20-9a1b-b0b1fa22c890' AND captain_id IS NULL;  -- 2025-04-06 v CLASSIC CRICKET CLUB(C-CUBE) → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'b7163564-7b55-4e76-ad8c-87790fab61ec' AND captain_id IS NULL;  -- 2025-03-22 v Tinsel County → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '5ab0b604-2b6a-4ca1-879e-f453c3896b6d' AND captain_id IS NULL;  -- 2025-04-29 v TopGuns → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '207a99ae-4367-4e86-986f-0d80c93edfbc' AND captain_id IS NULL;  -- 2025-04-06 v Rising Champions → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '53cb2215-f700-4d3b-b082-ce718b31c689' AND captain_id IS NULL;  -- 2025-05-12 v Classic XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'be28d549-f2dc-4467-ae51-ded737dee7f1' AND captain_id IS NULL;  -- 2025-04-27 v Yashwin Night Riders(YNR) → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '5c619364-bb72-4969-bc24-0c957351606a' AND captain_id IS NULL;  -- 2025-04-18 v All Whites → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '2551455c-a638-4eb1-bbbb-4486c9571c1b' AND captain_id IS NULL;  -- 2025-03-31 v Challengers_11 → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '8e858bde-4ee4-4365-8bf1-d1558e2f5cdb' AND captain_id IS NULL;  -- 2025-05-09 v ROYAL GLADIATORS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '73e24431-93fc-428a-85b8-3506327638f2' AND captain_id IS NULL;  -- 2025-04-25 v ROYAL GLADIATORS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '01101bdb-6966-4173-bf0e-28126c62db1c' AND captain_id IS NULL;  -- 2025-04-12 v Tinsel County → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '37489caa-3147-4439-b909-f6b2d443c2fb' AND captain_id IS NULL;  -- 2025-03-29 v TACTICAL TITANS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '2c5711b9-0f11-4b6b-a084-e73db585fd36' AND captain_id IS NULL;  -- 2025-03-18 v TopGuns → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '6fb8f861-e64b-4073-bfe6-b09a559301d5' AND captain_id IS NULL;  -- 2025-03-15 v Radiant Rovers → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '3fa7c9a3-af7b-4d9f-9592-9c6b1bccc00c' AND captain_id IS NULL;  -- 2025-03-12 v All Whites → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '0d970d0b-b00e-452b-80dd-06c80aeaa314' AND captain_id IS NULL;  -- 2025-03-08 v Wolfpack → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '304bd9e3-5777-4bbe-8953-846138e87a8c' AND captain_id IS NULL;  -- 2025-02-22 v EON Yoddhas → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '25e8f4fd-758d-4891-a173-bd616e342465' AND captain_id IS NULL;  -- 2025-02-16 v Weekend Warriors → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '7421b174-cc39-4225-9133-33c8f8f7fe47' AND captain_id IS NULL;  -- 2025-02-09 v MEGAJOINTS → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '55428205-6f49-4bbb-b39f-165994da9023' AND captain_id IS NULL;  -- 2025-02-03 v Weekdays Cricket Club → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '50b3709b-b214-44f5-b982-bc9d7ce5ff46' AND captain_id IS NULL;  -- 2025-02-01 v Cricblasters → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '70672135-6511-4af2-972b-4636f19a4c3c' AND captain_id IS NULL;  -- 2025-01-04 v Wolfpack → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'ad231523-f4c0-4445-8b6b-9351dece3dd0' AND captain_id IS NULL;  -- 2025-01-04 v Wolfpack → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = '3f53938b-161a-4b98-a799-14a3ce6bb7f1' AND captain_id IS NULL;  -- 2025-01-28 v Maverickxs → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'b4a5877b-e211-4758-a846-9d8d0a204f97' AND captain_id IS NULL;  -- 2024-12-28 v Out of Office XI → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '26678e67-0ddd-4f9a-9f40-f15f2e781bf0' AND captain_id IS NULL;  -- 2024-12-25 v Out of Office XI → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'bed93928-5121-4160-a165-d68de2384e59' AND captain_id IS NULL;  -- 2025-01-19 v Cricblasters → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'e521c9e2-7eb4-479c-8bd3-cb5933977353' AND captain_id IS NULL;  -- 2024-12-28 v Out of Office XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = 'fd1766fb-ea00-4d76-86f0-2fb65e82a0fe' AND captain_id IS NULL;  -- 2024-12-25 v Out of Office XI → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '9e061114-9514-49e0-9ec7-7d986a91fe36' AND captain_id IS NULL;  -- 2024-12-25 v Out of Office XI → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '0c21d191-4725-4820-9eb3-289e33fb0334' AND captain_id IS NULL;  -- 2025-01-18 v Wolfpack → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '1999436a-5b9a-40d4-aa88-428df8514ba0' AND captain_id IS NULL;  -- 2024-11-16 v Wolfpack → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '46dd87ae-2ceb-462c-9dd4-3af86313e062' AND captain_id IS NULL;  -- 2025-01-18 v Wolfpack → Avinash Singh
UPDATE matches SET captain_id = '04e8130d-78c4-44b7-a54e-e50c206941c6' WHERE id = 'f9a875cc-f5bf-46f3-8100-8276c45ef60d' AND captain_id IS NULL;  -- 2024-12-28 v Out of Office XI → Soumyaranjan Mohapatra
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '73071cac-cefd-4431-bc7f-eb2094743e22' AND captain_id IS NULL;  -- 2024-11-16 v Wolfpack → Avinash Singh
UPDATE matches SET captain_id = '7545cb6b-41fe-4102-b392-f560ae44805f' WHERE id = '723a5d60-4e3c-42e4-b02e-c35a1d11fe80' AND captain_id IS NULL;  -- 2024-11-16 v Wolfpack → Avinash Singh

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect ~120 external matches with a captain, and 5+ distinct captains.
SELECT count(*) FILTER (WHERE captain_id IS NOT NULL) AS with_captain,
       count(*)                                        AS played_external,
       count(DISTINCT captain_id)                      AS distinct_captains
FROM   matches
WHERE  result IN ('won','lost','draw') AND match_type <> 'internal';

-- ── Left for you to decide ───────────────────────────────────────────────────
-- Three matches where the app already names a captain and CricHeroes names
-- someone else. CricHeroes is what the scorer recorded on the day; the app's
-- entry was typed in later from memory. Uncomment to take CricHeroes' version.
--
--   2026-06-04  v Yashwin Stars     app: Soumyaranjan Mohapatra  CricHeroes: Avinash Singh
--   2026-06-09  v Decepticons       app: Adarsh Dwivedi          CricHeroes: Soumyaranjan Mohapatra
--   2026-04-27  v Radiant Rovers    app: Avinash Singh           CricHeroes: Soumyaranjan Mohapatra
--
-- UPDATE matches SET captain_id = (SELECT id FROM members WHERE name = 'Avinash Singh')
--   WHERE date = '2026-06-04' AND opponent = 'Yashwin Stars';
-- UPDATE matches SET captain_id = (SELECT id FROM members WHERE name = 'Soumyaranjan Mohapatra')
--   WHERE date = '2026-06-09' AND opponent = 'Decepticons';
-- UPDATE matches SET captain_id = (SELECT id FROM members WHERE name = 'Soumyaranjan Mohapatra')
--   WHERE date = '2026-04-27' AND opponent = 'Radiant Rovers';
