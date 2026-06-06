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
