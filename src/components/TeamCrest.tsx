import { useState } from 'react';
import { teamIdentity } from '../config/teamLogos';
import type { TeamKey } from '../hooks/useAuctionLive';

// ─── MahaSangram crest ─────────────────────────────────────────────────────────
// Shows the team's logo once it loads, and the emoji until then. Deliberately
// starts on the emoji rather than rendering an <img> that might 404 — a broken
// image icon on the Dashboard looks like a bug, an emoji looks like a choice.

export function TeamCrest({ team, size = 40 }: { team: TeamKey; size?: number }) {
  const id = teamIdentity(team);
  const [loaded, setLoaded] = useState(false);

  return (
    <span
      className="relative inline-flex items-center justify-center rounded-xl flex-shrink-0 overflow-hidden"
      style={{
        width: size, height: size,
        background: loaded ? 'transparent' : `${id.color}1f`,
        fontSize: size * 0.55, lineHeight: 1,
      }}
      aria-label={id.name}
    >
      {!loaded && <span aria-hidden>{id.emoji}</span>}
      <img
        src={id.logo} alt=""
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </span>
  );
}
