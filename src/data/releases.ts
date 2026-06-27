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
