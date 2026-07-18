// ─── Official Season 2025-26 Awards (handed out at Awards Night) ────────────────
// These are the real, ceremony-decided winners — a celebratory showcase, public.
// `match` resolves the member (for the avatar) by name; `display` overrides the
// shown name if it differs from the member record.

export const SEASON_AWARDS_YEAR = '2025-26';

export interface SeasonAwardWinner {
  key: string;
  title: string;
  emoji: string;
  match: string;      // member name to resolve avatar
  display?: string;   // optional display-name override
  stat: string;       // headline stat / blurb
  accent: string;     // gradient for the card
}

export const SEASON_AWARDS: SeasonAwardWinner[] = [
  { key: 'batsman',    title: 'Best Batsman',            emoji: '🏏', match: 'Soumyaranjan Mohapatra', stat: '1,330 runs · 6 fifties',              accent: 'linear-gradient(135deg,#2563eb,#38bdf8)' },
  { key: 'bowler',     title: 'Best Bowler',             emoji: '🎯', match: 'AKASH JADHAV',           stat: '93 wickets · best 4/13',             accent: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
  { key: 'allrounder', title: 'Best All-Rounder',        emoji: '👑', match: 'Avinash Singh',          stat: '785 runs + 73 wickets · 11 MOM',     accent: 'linear-gradient(135deg,#d97706,#fbbf24)' },
  { key: 'emerging',   title: 'Emerging Player',         emoji: '🌟', match: 'Prateek Singh',          stat: 'Breakout all-round debut season',    accent: 'linear-gradient(135deg,#059669,#34d399)' },
  { key: 'efforts',    title: 'Best Efforts & Intent',   emoji: '💪', match: 'Sushil Yadav',           stat: '70 wickets · the squad’s workhorse', accent: 'linear-gradient(135deg,#dc2626,#fb7185)' },
  { key: 'fielder',    title: 'Best Fielder',            emoji: '🧤', match: 'Nikhil', display: 'Nikhil Tandon', stat: 'Sharpest hands in the field', accent: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
];
