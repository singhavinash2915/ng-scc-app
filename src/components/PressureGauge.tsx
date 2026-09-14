import { bandOf, BAND_COLOR, type BallReading, type PressureReading } from '../lib/pressure';

// ─── The pressure gauge ───────────────────────────────────────────────────────
// One number for "how tight is this", the way CricHeroes' MVP 2.0 shows it, on
// the dark live surfaces. The arc is the index now; the strip beneath is how it
// has moved over the innings, so a viewer can see a collapse or a recovery
// rather than only where it has landed.
//
// Always the BATTING side's pressure. The engine is in lib/pressure.ts.

interface Props {
  reading: PressureReading;
  /** Pressure before every ball so far, for the trace. */
  curve?: BallReading[];
  battingTeam: string;
  /** Just the number and band, for the scorer's scoreboard. */
  compact?: boolean;
}

export function PressureGauge({ reading, curve = [], battingTeam, compact }: Props) {
  const color = BAND_COLOR[reading.band];

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 t-micro font-black uppercase tracking-wider">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        Pressure <span className="t-num" style={{ color }}>{reading.index}</span>
        <span className="text-white/50">{reading.band}</span>
      </span>
    );
  }

  // Semicircle from 180° to 0°; the fill length follows the index.
  const R = 70, cx = 90, cy = 84;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100), a1 = Math.PI * (1 - to / 100);
    const x0 = cx + R * Math.cos(a0), y0 = cy - R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy - R * Math.sin(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };

  const trace = curve.slice(-36);
  const W = 180, H = 34;

  return (
    <div className="r-card bg-white/5 border border-white/10 p-4">
      <div className="flex items-center gap-4">
        <svg width={180} height={96} viewBox="0 0 180 96" className="flex-shrink-0" aria-hidden>
          <path d={arc(0, 100)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={12} strokeLinecap="round" />
          {reading.index > 0 && (
            <path d={arc(0, Math.max(1, reading.index))} fill="none" stroke={color} strokeWidth={12}
              strokeLinecap="round" style={{ transition: 'all 700ms ease' }} />
          )}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="white"
            style={{ font: '800 34px Sora, Inter, system-ui, sans-serif' }}>{reading.index}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={color}
            style={{ font: '800 11px Inter, system-ui, sans-serif', letterSpacing: 2, textTransform: 'uppercase' }}>
            {reading.band.toUpperCase()}
          </text>
        </svg>
        <div className="min-w-0 text-left">
          <p className="t-micro font-black uppercase tracking-[2px] text-white/50">Pressure index</p>
          <p className="t-body font-bold text-white mt-0.5 leading-snug">
            {describe(reading, battingTeam)}
          </p>
        </div>
      </div>

      {trace.length > 2 && (
        <div className="mt-3">
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            {trace.map((r, i) => {
              const w = W / trace.length;
              const h = Math.max(2, (r.index / 100) * H);
              return <rect key={r.seq} x={i * w + 0.5} y={H - h} width={Math.max(1, w - 1)} height={h}
                rx={1} fill={BAND_COLOR[bandOf(r.index)]} opacity={0.85} />;
            })}
          </svg>
          <p className="t-micro text-white/40 mt-1">Last {trace.length} balls</p>
        </div>
      )}
    </div>
  );
}

function describe(r: PressureReading, team: string): string {
  const wp = Math.round(r.winProb * 100);
  switch (r.band) {
    case 'Extreme':  return `Every ball matters now — ${team} at ${wp}%.`;
    case 'High':     return `${team} are being squeezed.`;
    case 'Moderate': return `Game in the balance for ${team}.`;
    case 'Light':    return `${team} have it under control, for now.`;
    default:         return wp >= 50 ? `${team} are cruising.` : `Little left riding on each ball.`;
  }
}

export default PressureGauge;
