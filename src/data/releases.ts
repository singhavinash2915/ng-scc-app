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
