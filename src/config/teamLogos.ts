import { LEAGUE_TEAM_NAMES } from './season2';
import type { TeamKey } from '../hooks/useAuctionLive';

// ─── MahaSangram team identity ─────────────────────────────────────────────────
// Logo files live in public/team-logos/ and are referenced by URL rather than
// imported, so a new crest can be dropped in without touching a line of code.
//
// Everything degrades to the emoji if a file isn't there yet: <TeamCrest/> only
// swaps in the image once the browser has actually loaded it, so a missing or
// broken file shows the emoji instead of a broken-image icon.

export interface TeamIdentity {
  key: TeamKey;
  name: string;
  /** Fallback mark, used until a logo file loads. */
  emoji: string;
  /** Accent colour — validated for contrast in both themes. */
  color: string;
  /** Public path; drop the file here and it appears. */
  logo: string;
}

export const TEAM_IDENTITY: Record<TeamKey, TeamIdentity> = {
  team1: {
    key: 'team1',
    name: LEAGUE_TEAM_NAMES.team1,          // SCC Brahmos
    emoji: '🦁',
    color: '#2a78d6',
    logo: `${import.meta.env.BASE_URL}team-logos/brahmos.png`,
  },
  team2: {
    key: 'team2',
    name: LEAGUE_TEAM_NAMES.team2,          // SCC Agni
    emoji: '🐅',
    color: '#eb6834',
    logo: `${import.meta.env.BASE_URL}team-logos/agni.png`,
  },
};

export const teamIdentity = (t: TeamKey) => TEAM_IDENTITY[t];
