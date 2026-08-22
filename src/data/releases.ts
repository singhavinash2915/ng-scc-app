export interface ReleaseNote {
  emoji: string;
  title: string;
  desc: string;
  tag?: 'new' | 'improved' | 'fixed';
}

export interface Release {
  version: string;   // used as localStorage key — bump this to trigger the modal
  date: string;      // display date
  title: string;
  subtitle?: string;
  notes: ReleaseNote[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD A NEW ENTRY AT THE TOP to release a "What's New" popup to all members.
// Bump `version` (use YYYY.MM.DD or any unique string) — that's what triggers
// the modal to reappear for everyone.
// ─────────────────────────────────────────────────────────────────────────────
export const RELEASES: Release[] = [
  {
    version: '2026.08.22.2',
    date: '22 August 2026',
    title: 'Getting ready for the new season \u26a1',
    subtitle: 'A season-long challenge ladder \u00b7 match day takeover \u00b7 your squad number',
    notes: [
      { emoji: '\ud83c\udfc6', title: 'The season ladder', tag: 'new',
        desc: 'Challenges used to vanish the moment they settled \u2014 win five in a row and you were exactly where you started. Now every settled challenge counts towards a season-long table: wins, played, and a streak. Win two on the bounce and you get a flame next to your name.' },
      { emoji: '\ud83d\udd25', title: 'The app wakes up on match day', tag: 'new',
        desc: 'On the morning of a game the home screen becomes the match \u2014 the ground with one-tap directions, whether you\u2019re in the XI, the full squad, and every challenge riding on that day. You\u2019ll see it first on 1 October.' },
      { emoji: '\ud83d\udd22', title: 'Your number, in your team\u2019s colours', tag: 'new',
        desc: 'Your printed squad number now sits on your player card, in your side\u2019s own colours \u2014 so you see it every time the card shows up.' },
    ],
  },

  {
    version: '2026.08.21',
    date: '21 August 2026',
    title: 'Challenges — now about a specific Sunday ⚔️',
    subtitle: 'Pin it to a fixture · see everyone else\u2019s · notifications when you\u2019re called out',
    notes: [
      { emoji: '📅', title: 'Challenge someone for one match', tag: 'new', desc: '\u201cFirst to 4 sixes\u201d used to mean first to 4 sixes ever. Now you pick an upcoming fixture, so you both know exactly when it settles \u2014 and the club knows which game to watch.' },
      { emoji: '👀', title: 'Around the club', tag: 'new', desc: 'Every accepted challenge is now visible to everyone, with live standings. Once it\u2019s settled you can see who won and what they owe. A stake only bites when the club is watching.' },
      { emoji: '🔔', title: 'You\u2019ll know you\u2019ve been challenged', tag: 'new', desc: 'A notification on your phone, a WhatsApp message, an alert on your home screen and a count on the Challenges menu. Previously you\u2019d only have found out by chance.' },
      { emoji: '🔍', title: 'Search for who you want', tag: 'improved', desc: 'Type a name instead of swiping through 47 faces.' },
      { emoji: '✏️', title: 'Change your mind', tag: 'new', desc: 'Edit the target or the stake, or withdraw the challenge entirely \u2014 right up until they accept. After that the terms are fixed, because a contest you can cancel when you\u2019re losing isn\u2019t a contest.' },
    ],
  },
  {
    version: '2026.08.20',
    date: '20 August 2026',
    title: 'Challenges ⚔️',
    subtitle: 'Call out a teammate — the app already knows who you should be racing',
    notes: [
      { emoji: '⚔️', title: 'Challenges are here', tag: 'new', desc: 'Take on a teammate over runs, wickets, catches, sixes, strike rate or economy. Your match performances count towards it automatically — nothing to log.' },
      { emoji: '🎯', title: 'One tap, no forms', tag: 'new', desc: 'The app knows who you\u2019re close to. \u201cRohan is 12 runs ahead of you this season\u201d \u2014 tap once and it\u2019s on. Only genuinely close races are suggested.' },
      { emoji: '🔬', title: 'Contests nobody else can run', tag: 'new', desc: 'Because we score ball by ball, you can also challenge on death-over economy, dot-ball percentage, strike rate in a chase, or partnership runs. Those count on matches scored in this app.' },
      { emoji: '🃏', title: 'Fantasy Draft is paused', tag: 'improved', desc: 'Challenges takes its place in the menu for now. Nothing is lost \u2014 if the club wants Fantasy back for next season, it returns as it was.' },
    ],
  },
  {
    version: '2026.08.19',
    date: '19 August 2026',
    title: 'Season 3 — the app knows who you are 🏏',
    subtitle: 'Sign in with your number · your own player card · live scoring · a Dashboard that fits',
    notes: [
      { emoji: '📱', title: 'Sign in with your phone number', tag: 'new', desc: 'No password, no account to create. Type the number the club already has for you and the app becomes yours — your next match, whether you\u2019re picked, your balance, your card.' },
      { emoji: '🪪', title: 'Your player card', tag: 'new', desc: 'Legend, Elite, Pro or Squad — earned from match data, not handed out. Your tier, role and season figures, and it changes through the season because you do.' },
      { emoji: '⏱️', title: 'Your season, at the top', tag: 'new', desc: 'A live countdown to the next match, a \u201cyou\u2019re picked\u201d badge when you\u2019re in the squad, and the next milestone you\u2019re chasing.' },
      { emoji: '🏠', title: 'Me / The club', tag: 'improved', desc: 'The Dashboard was six screens of scrolling, so the sponsor and half the club stats were never seen. Now two tabs: what you need, and how we\u2019re doing.' },
      { emoji: '🔴', title: 'Scoring inside the app', tag: 'new', desc: 'When CricHeroes stalls we can score ball by ball here instead — with commentary, over-by-over and a win probability. Every match now has a \u201cScore in App\u201d option.' },
      { emoji: '📅', title: 'Matches grouped by month', tag: 'improved', desc: '210 matches in one scroll gave you nowhere to stand. Now grouped with a sticky month header, and each card is ringed by its result.' },
      { emoji: '🎁', title: 'Season Wrapped', tag: 'new', desc: 'Your season as a set of cards worth sending to the group — runs, wickets, who you played most alongside, and how it ended.' },
      { emoji: '🧹', title: 'Cleaner throughout', tag: 'fixed', desc: 'Six unused pages removed, the sidebar grouped into five sections, one type scale and one card across every screen, and the annual report no longer makes match fees look like a mistake.' },
    ],
  },
  {
    version: '2026.06.30',
    date: '30 June 2026',
    title: 'Premium UI Redesign ✨',
    subtitle: 'Full light & dark themes · pick your colour · a more beautiful app',
    notes: [
      { emoji: '🌗', title: 'Light & Dark themes', tag: 'new', desc: 'The whole app now has a polished light theme and a refined dark "Stadium Night" theme — switch any time from the header.' },
      { emoji: '🎨', title: 'Choose your colour', tag: 'new', desc: 'Pick the club accent palette — Emerald, Aurora, Sunset or Ocean — right from the Dashboard. The whole app re-skins instantly.' },
      { emoji: '🏠', title: 'Redesigned Dashboard', tag: 'improved', desc: 'A premium hero with your personal stats, win-rate ring, milestones, and a live scorecard pinned to the very top on match day.' },
      { emoji: '🏆', title: 'Leaderboard "Your Rank"', tag: 'new', desc: 'See exactly where you rank and how far to the next spot — "12 runs to overtake Saurabh".' },
      { emoji: '🧍', title: 'Player cards & Rankings', tag: 'improved', desc: 'Members now show FIFA-style cards (OVR, role, runs/wkts) and SCC Rankings got a premium makeover with tiers and rating bars.' },
      { emoji: '📊', title: 'Fixes', tag: 'fixed', desc: 'Live scorecard, Season Finale and chart colours now render correctly in light mode; "This Month" finance now uses the correct month boundary.' },
    ],
  },
  {
    version: '2026.06.27',
    date: '27 June 2026',
    title: 'Match Centre 🏟️',
    subtitle: 'Heroes of the Match · Match Insights · CricHeroes-style analysis',
    notes: [
      { emoji: '🏆', title: 'Heroes of the Match', tag: 'new', desc: 'Every played match now has a Match Centre with Player of the Match, Best Batter, Best Bowler and a top All-Rounder — with our own player photos and links to their profiles.' },
      { emoji: '📊', title: 'Match Insights', tag: 'new', desc: 'See how the game was won: runs, wickets, dots, boundary runs and run rate side-by-side, phases won, plus turning-point overs with ball-by-ball pills.' },
      { emoji: '🎯', title: 'Open from anywhere', tag: 'improved', desc: 'A new "📊 Match Centre" button on the Dashboard and on every match card opens the full analysis.' },
      { emoji: '🧤', title: 'Best Fielder fixed', tag: 'fixed', desc: 'Wicket-keepers no longer dominate the Best Fielder board — keepers are now excluded so it reflects true outfielding.' },
      { emoji: '📱', title: 'Mobile fixes', tag: 'fixed', desc: 'Season Finale & Scouting Report now appear in the mobile menu, and the match options (⋮) menu is now an easy-to-tap bottom sheet.' },
    ],
  },
  {
    version: '2026.06.24',
    date: '24 June 2026',
    title: 'Season Finale & Going Public 🌟',
    subtitle: 'Team of the Season · Club Wrapped · Live links & Scouting for rival clubs',
    notes: [
      // ── Season Finale ────────────────────────────────────────────────────
      { emoji: '🏆', title: 'Season Finale',             tag: 'new', desc: 'A brand-new /season page to close out the year: Team of the Season (Best XI), Season Awards Night, Player Report Cards (A+ to C), and a tap-through Club Wrapped story. Find it as "Season Finale" in the menu.' },

      // ── Public growth features ───────────────────────────────────────────
      { emoji: '📡', title: 'Public Live-Match Link',    tag: 'new', desc: 'Every match now has a shareable, no-login live page — drop the link in any WhatsApp group and anyone can follow our score ball-by-ball, no app needed.' },
      { emoji: '🆚', title: 'Scouting Report',           tag: 'new', desc: 'A public report for teams about to face us — our record, current form, players to watch, and a searchable head-to-head so any rival captain can look up their team\'s record vs SCC.' },
      { emoji: '🖼️', title: 'Result Posters — Shareable', tag: 'improved', desc: 'Match result posters now carry a subtle "Want this for your club?" footer — so every result we share doubles as a showcase of our app.' },
    ],
  },
  {
    version: '2026.06.12',
    date: '12 June 2026',
    title: 'Match Centre & Rankings Week 🏏',
    subtitle: 'Pre-match analytics · ICC-style Rankings · Internal Rivalry predictions',
    notes: [
      // ── Headline features ────────────────────────────────────────────────
      { emoji: '📊', title: 'Match Centre — Pre-Match Analytics', tag: 'new',      desc: 'A new card on the Dashboard for the next match: head-to-head record, our avg score vs theirs, a win-probability meter, recent form, venue record, key players to watch and a storyline. See exactly what we\'re up against!' },
      { emoji: '🏅', title: 'SCC Player Rankings',                tag: 'new',      desc: 'An ICC-style ratings page — every player gets a rating from batting, bowling & fielding, weighted by recent form and opposition. Switch between Overall (all-time) and any season. (Replaces the old Compare page.)' },
      { emoji: '🥊', title: 'Internal Rivalry Predictions',      tag: 'new',      desc: 'Dhurandars vs Bazigars matches now have their own prediction game — pick each team\'s top scorer & wicket-taker, plus rivalry bonuses (most sixes, winning margin, highest knock, anyone out for a duck). Up to 70 points — call out the other team!' },
      { emoji: '🖼️', title: 'Team Gallery',                      tag: 'new',      desc: 'An admin-curated photo gallery to show off our best team moments.' },

      // ── Improvements ─────────────────────────────────────────────────────
      { emoji: '📺', title: 'Live Scorecard — Cleaner Layout',    tag: 'improved', desc: 'The in-match scorecard now matches CricHeroes\' familiar table layout — easier to read batting & bowling at a glance.' },
      { emoji: '✅', title: 'Prediction Results Revealed',        tag: 'improved', desc: 'After a match settles, the Predictions page now shows the actual result alongside everyone\'s picks — including each team\'s top scorer/wicket-taker for internal games.' },
      { emoji: '🔄', title: 'Internal Results Auto-Update',       tag: 'improved', desc: 'Dhurandars vs Bazigars match results and scorecards now sync automatically from CricHeroes — no manual entry.' },
      { emoji: '👤', title: 'Smarter Player Profiles',           tag: 'improved', desc: 'A profile now falls back to all-time stats when the current season has no data yet, so it\'s never blank.' },

      // ── Fixes ────────────────────────────────────────────────────────────
      { emoji: '🎯', title: 'Stats Accuracy — Two Adityas Fixed', tag: 'fixed',    desc: 'Players who share a first name (our two Adityas) were being merged — inflating one and erasing the other. Stats are now matched by each player\'s unique CricHeroes ID across the Leaderboard, Rankings and Profiles, so everyone gets exactly their own numbers.' },
    ],
  },
  {
    version: '2026.06.06',
    date: '6 June 2026',
    title: 'Mega Weekend Drop 🚀',
    subtitle: 'Club Hub · Predictions 2.0 · Smarter AI · Live Scorecard Fix',
    notes: [
      // ── Club Hub — 8 new engagement features ─────────────────────────────
      { emoji: '⚡', title: 'Fantasy Points Leaderboard',     tag: 'new',      desc: 'Auto-calculated fantasy points from match performance — runs, wickets, catches, MOMs. Who\'s #1?' },
      { emoji: '📊', title: 'Power Rankings',                 tag: 'new',      desc: 'Weekly player ratings weighted by recent form (60%) + season stats (40%). See who\'s in top form!' },
      { emoji: '🌟', title: 'Career Milestones Wall',         tag: 'new',      desc: 'Auto-detects when players cross 500/1000+ runs, 25/50+ wickets, 5+ MOMs and more. Celebrate together!' },
      { emoji: '🔥', title: 'Match Highlights Reel',          tag: 'new',      desc: 'Auto-generated highlight cards for each match — scores, MOM, and key moments.' },
      { emoji: '💬', title: 'Match Day Live Chat',            tag: 'new',      desc: 'Real-time chat during matches — send messages and emoji reactions while watching. Go SCC! 🏏' },
      { emoji: '🃏', title: 'Player Trading Cards',           tag: 'new',      desc: 'FIFA-style cards for every player with ELITE/GOLD/SILVER tiers, OVR rating, and full stats.' },
      { emoji: '🗳️', title: 'Polls & Quizzes',               tag: 'new',      desc: 'Fun polls created by admin — vote on best batting stance, most improved player, and more.' },
      { emoji: '🏆', title: 'Season Awards Voting',           tag: 'new',      desc: 'Democratic voting for Best Batsman, Best Bowler, Most Improved, Spirit of Cricket and more.' },

      // ── Predictions 2.0 ─────────────────────────────────────────────────
      { emoji: '🎰', title: 'Prediction Bonus Questions',     tag: 'new',      desc: 'Earn +25 more points per match! Predict SCC total score, will anyone hit a 50, and who takes 3+ wickets. Max points now 55/match.' },
      { emoji: '🚫', title: 'No Self-Predictions',            tag: 'improved', desc: 'You can no longer pick yourself as Top Scorer, Top Wicket-Taker, or MOM — keeps the game fair and fun.' },

      // ── Smarter AI ──────────────────────────────────────────────────────
      { emoji: '🤖', title: 'AI Squad Analyst Mode',          tag: 'new',      desc: 'When admin has already picked a squad, AI now analyses THAT exact squad — rates strength, picks match-winners, flags imbalances. No squad set yet? It still recommends a Best XI.' },
      { emoji: '📋', title: 'AI Match Report — Accurate',     tag: 'fixed',    desc: 'AI no longer hallucinates the wrong reason for MOM. It now pulls the player\'s actual batting/bowling figures from CricHeroes — so a bowling MOM gets praised for bowling, not invented batting.' },

      // ── Live & Insights ──────────────────────────────────────────────────
      { emoji: '📺', title: 'Live Scorecard — Actually Live', tag: 'fixed',    desc: 'During in-progress matches the scorecard now shows the real ball-by-ball score, current batsmen, bowler & over balls — auto-refreshing every 15s.' },
      { emoji: '🗺️', title: 'Ground & Opponent Insights',     tag: 'new',      desc: 'Win rates per ground + Top 5 best/toughest opponents. Live on Dashboard + Analytics.' },
      { emoji: '🏃', title: 'Run Out Tracking',               tag: 'new',      desc: 'New "ROs" column in Leaderboard + "Most Run Outs" record card — who gets run out the most?' },

      // ── Book a Match (public) ───────────────────────────────────────────
      { emoji: '🤝', title: 'Book a Match vs SCC',            tag: 'new',      desc: 'External teams can now book a match against SCC — pick a date, share details, pay online. Visible to everyone in the sidebar.' },
      { emoji: '🛡️', title: 'AI Payment Screenshot Check',    tag: 'new',      desc: 'UPI payment screenshots are now auto-verified by AI in real-time — most bookings confirm in seconds, no admin wait.' },
      { emoji: '📸', title: 'Ground Photo Carousel',          tag: 'new',      desc: 'All uploaded ground photos now auto-rotate on the Book a Match page (was showing just the first).' },

      // ── Stats correctness ──────────────────────────────────────────────
      { emoji: '🎯', title: 'Stats: External Only',           tag: 'fixed',    desc: 'Dashboard, Analytics, AI Insights, Annual Report now exclude internal matches (Dhurandars vs Bazigars) from overall club stats — the Internal Rivalry card still tracks them separately.' },
      { emoji: '🔄', title: 'Daily Sync — No More Wipeouts',  tag: 'fixed',    desc: 'Morning auto-sync no longer overwrites season-specific leaderboard data.' },

      // ── Dashboard polish ──────────────────────────────────────────────
      { emoji: '📣', title: 'Share Booking Link',             tag: 'new',      desc: 'Subtle strip on Dashboard top — share the "Book a Match vs SCC" link with opposing teams you know.' },
    ],
  },
  {
    version: '2026.06.01',
    date: '1 June 2026',
    title: 'Big June Update 🎉',
    subtitle: 'Loads of new features for members',
    notes: [
      { emoji: '🗺️', title: 'Ground & Opponent Insights',    tag: 'new',      desc: 'See win rates per ground and best/toughest opponents — on Dashboard and Analytics.' },
      { emoji: '🎯', title: 'My Predictions Stats',          tag: 'new',      desc: 'Track your personal prediction accuracy, total points, hit rate, and last 5 results on the Predictions page.' },
      { emoji: '🏅', title: 'Achievements & Badges',         tag: 'new',      desc: '21 badges to unlock — Half-Century, Wicket Beast, Iron Man, Triple Threat and more. Check your profile!' },
      { emoji: '📢', title: 'Team Notice Board',             tag: 'new',      desc: 'Admin can post announcements — match updates, urgent notices, congrats — with auto-expiry and pin support.' },
      { emoji: '🎂', title: 'Birthday Banner',               tag: 'new',      desc: 'Dashboard shows a celebration banner on your birthday. Happy early birthday 🎂' },
      { emoji: '📊', title: 'Leaderboard Fixed',             tag: 'fixed',    desc: 'Season 2025-26 and Overall (All Seasons) now show correct isolated stats. Re-synced with proper date filters.' },
      { emoji: '🏏', title: '"No Result" instead of "Draw"', tag: 'improved', desc: 'Abandoned / rained-off matches are now correctly labelled "No Result" everywhere.' },
      { emoji: '📈', title: 'Win % formula fixed',           tag: 'fixed',    desc: 'Win rate now calculated as Won ÷ (Won + Lost) — No Result matches excluded from the denominator.' },
    ],
  },
  // — older releases below (never shown again, kept for record only) —
  {
    version: '2026.05.30',
    date: '30 May 2026',
    title: 'Analytics Update',
    notes: [
      { emoji: '📊', title: 'Won / Lost / No Result filters', tag: 'new',      desc: 'Matches page now has dedicated filter tabs for each result type.' },
      { emoji: '🗺️', title: 'Ground-wise win rate',           tag: 'new',      desc: 'Analytics page shows performance breakdown per cricket ground.' },
    ],
  },
];

// The version the user must have seen to suppress the modal.
export const CURRENT_VERSION = RELEASES[0].version;
export const STORAGE_KEY     = 'scc-whats-new-seen';
