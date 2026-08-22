import { JERSEY, type JerseyTeam } from '../lib/playerCard';

// ─── The shirt ────────────────────────────────────────────────────────────────
// Drawn rather than photographed, so it can carry ANY member's name and number.
// A photo of the printed jersey shows one player's back; this shows yours,
// which is the whole reason a kit page is worth opening twice.
//
// Deliberately simple geometry — a polo silhouette with the club's diagonal
// streaks. It reads as the real shirt at a glance because the colours and the
// crest are the real ones, and a laboured illustration would only invite
// comparison with the photo it can't match.

export function JerseyShirt({ team, name, number, size = 200 }: {
  team: JerseyTeam;
  name?: string | null;
  number?: number | null;
  size?: number;
}) {
  const kit = JERSEY[team];
  const id = `${team}-${number ?? 'blank'}`;

  return (
    <svg viewBox="0 0 200 230" width={size} height={size * 1.15}
      role="img" aria-label={`${kit.name} shirt${number != null ? `, number ${number}` : ''}`}>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          {team === 'brahmos' ? (
            <>
              <stop offset="0%" stopColor="#120820" />
              <stop offset="55%" stopColor="#3b1578" />
              <stop offset="100%" stopColor="#0a0a12" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#16233f" />
              <stop offset="60%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0d1526" />
            </>
          )}
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <path d="M60 18 L38 30 L14 62 L34 80 L46 66 L46 218 L154 218 L154 66 L166 80 L186 62 L162 30 L140 18
                   L118 30 Q100 44 82 30 Z" />
        </clipPath>
      </defs>

      {/* body */}
      <path d="M60 18 L38 30 L14 62 L34 80 L46 66 L46 218 L154 218 L154 66 L166 80 L186 62 L162 30 L140 18
               L118 30 Q100 44 82 30 Z"
        fill={`url(#body-${id})`} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* streaks — the diagonal flashes both shirts carry */}
      <g clipPath={`url(#clip-${id})`} opacity="0.5">
        {[0, 1, 2, 3, 4].map(i => (
          <path key={i}
            d={`M${-30 + i * 44} 230 L${10 + i * 44} 90 L${26 + i * 44} 90 L${-14 + i * 44} 230 Z`}
            fill={kit.ink} opacity={0.16 + i * 0.05} />
        ))}
      </g>

      {/* collar */}
      <path d="M82 30 Q100 44 118 30 L112 22 Q100 32 88 22 Z" fill="#ffffff" opacity="0.9" />

      {/* club name across the shoulders, as printed */}
      <text x="100" y="76" textAnchor="middle" fill={kit.ink}
        fontSize="13" fontWeight="800" letterSpacing="1.5"
        fontFamily="Sora, system-ui, sans-serif">SANGRIA</text>
      <text x="100" y="88" textAnchor="middle" fill={kit.ink} opacity="0.75"
        fontSize="6.5" fontWeight="700" letterSpacing="3"
        fontFamily="Sora, system-ui, sans-serif">CRICKET CLUB</text>

      {name && (
        <text x="100" y="116" textAnchor="middle" fill="#ffffff"
          fontSize={name.length > 9 ? 15 : 19} fontWeight="800" letterSpacing="1"
          fontFamily="Sora, system-ui, sans-serif">{name.toUpperCase()}</text>
      )}

      {number != null && (
        <text x="100" y={name ? 178 : 165} textAnchor="middle" fill={kit.ink}
          fontSize="64" fontWeight="900" letterSpacing="-2"
          fontFamily="Sora, system-ui, sans-serif">{number}</text>
      )}

      <text x="100" y="200" textAnchor="middle" fill={kit.ink} opacity="0.8"
        fontSize="7" fontWeight="700" letterSpacing="0.5"
        fontFamily="Sora, system-ui, sans-serif">sangriacricket.club</text>
    </svg>
  );
}
