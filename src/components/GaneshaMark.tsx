// ─── Ganesha, as line art ─────────────────────────────────────────────────────
// Drawn here in SVG rather than fetched: the club asked for Bappa on the poster
// and there is no artwork in the app to place. So this is deliberately a MARK —
// a symmetrical, ornamental figure in single-weight gold line, the way a
// festival invitation or a temple sign renders him — rather than an attempt at a
// portrait, which is what goes wrong when a deity is drawn from nothing.
//
// Read it as: crown (mukut) above a round face, large ears either side, the
// trunk curving to the left over a modak in the palm, and a lotus beneath.
//
// If the club would rather use real artwork, replace this one component: the
// poster gives it a fixed 300×300 box and asks nothing else of it.

export function GaneshaMark({ size = 300, color = '#fbbf24' }: { size?: number; color?: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const thin = { ...s, strokeWidth: 3 };
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-label="Ganesha">
      {/* Halo */}
      <circle cx="150" cy="138" r="118" {...thin} opacity="0.35" />

      {/* Mukut — crown, with its finial */}
      <path d="M112 78 C120 40 180 40 188 78" {...s} />
      <path d="M150 22 L150 46" {...s} />
      <circle cx="150" cy="16" r="7" fill={color} stroke="none" />
      <path d="M112 78 Q150 92 188 78" {...s} />

      {/* Face */}
      <path d="M108 96 Q150 84 192 96 Q206 130 192 164 Q150 182 108 164 Q94 130 108 96 Z" {...s} />

      {/* Ears, fanned wide as they are always drawn */}
      <path d="M108 100 Q54 96 46 134 Q40 172 92 170" {...s} />
      <path d="M192 100 Q246 96 254 134 Q260 172 208 170" {...s} />
      <path d="M100 116 Q72 118 68 138" {...thin} opacity="0.8" />
      <path d="M200 116 Q228 118 232 138" {...thin} opacity="0.8" />

      {/* Eyes and the tilak between them */}
      <path d="M126 126 Q136 118 146 126" {...thin} />
      <path d="M154 126 Q164 118 174 126" {...thin} />
      <path d="M150 104 L150 120" {...thin} />

      {/* Trunk — down from between the eyes and curling to the left */}
      <path d="M150 132 Q150 176 138 196 Q124 218 104 214 Q88 210 92 194" {...s} />

      {/* Tusks */}
      <path d="M132 160 Q126 172 130 182" {...thin} />
      <path d="M168 160 Q176 174 170 186" {...thin} opacity="0.55" />

      {/* Modak in the palm, under the trunk's curl */}
      <path d="M92 194 m -18 16 a 18 18 0 1 0 36 0 z" {...thin} />
      <path d="M74 210 Q92 196 110 210" {...thin} />

      {/* Shoulders */}
      <path d="M96 186 Q150 208 204 186" {...s} opacity="0.85" />

      {/* Lotus seat */}
      <path d="M78 236 Q150 216 222 236" {...s} />
      <path d="M78 236 Q104 266 150 268 Q196 266 222 236" {...s} />
      <path d="M110 240 Q128 264 150 266" {...thin} opacity="0.7" />
      <path d="M190 240 Q172 264 150 266" {...thin} opacity="0.7" />
    </svg>
  );
}

export default GaneshaMark;
