import { forwardRef } from 'react';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import { GaneshaMark } from './GaneshaMark';
import type { Festival } from '../config/festivals';

// ─── The festival poster ──────────────────────────────────────────────────────
// A 1080×1350 card, rendered as DOM and rasterised by html-to-image on the way
// out — the same path the match posters take, so what you see is what shares.
//
// On the artwork: Bappa is drawn as a MARK — symmetrical gold line art, the way
// a festival invitation renders him — not as a portrait. See GaneshaMark. The ॐ
// medallion it replaced is still there for festivals that have no figure.
//
// To use real artwork instead, replace GaneshaMark: the layout gives it a fixed
// box and asks nothing else of it.
//
// Every dimension is absolute px rather than rem: the export renders this off
// screen at a fixed size, where anything relative to a root font-size drifts.

interface Props {
  festival: Festival;
  /** e.g. "Sangria Cricket Club" — who the wishes are from. */
  clubName?: string;
  /** Shown small at the foot: "Day 3 of 10" on a multi-day festival. */
  dayLabel?: string | null;
}

/** Which festivals get the figure rather than the ॐ medallion. */
const FIGURE: Record<string, 'ganesha'> = { 'Ganesh Chaturthi': 'ganesha' };

export const FestivalPoster = forwardRef<HTMLDivElement, Props>(function FestivalPoster(
  { festival: f, clubName = 'Sangria Cricket Club', dayLabel = null }, ref,
) {
  const { deep, warm, accent, ink } = f.colors;

  return (
    <div ref={ref}
      style={{
        width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
        background: `radial-gradient(900px circle at 50% 8%, ${warm} 0%, transparent 58%),
                     radial-gradient(700px circle at 50% 96%, ${warm}55 0%, transparent 60%),
                     linear-gradient(170deg, ${deep} 0%, #1a0600 55%, #120400 100%)`,
        fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
        color: ink,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

      {/* A lamp's glow behind the type, and a gold frame just inside the edge. */}
      <div style={{
        position: 'absolute', top: 250, left: '50%', transform: 'translateX(-50%)',
        width: 720, height: 720, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}33 0%, transparent 62%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 28, border: `2px solid ${accent}55`, borderRadius: 28,
      }} />
      <div style={{
        position: 'absolute', inset: 40, border: `1px solid ${accent}22`, borderRadius: 20,
      }} />

      {/* ── Garland of marigolds across the top ─────────────────────────── */}
      <div style={{
        position: 'absolute', top: 58, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 14, fontSize: 34, opacity: 0.92,
      }}>
        {Array.from({ length: 13 }).map((_, i) => (
          <span key={i} style={{ transform: `translateY(${i % 2 ? 12 : 0}px)` }}>
            {i % 2 ? '🌼' : '🌺'}
          </span>
        ))}
      </div>

      {/* ── Bappa, or the ॐ where there is no figure ────────────────────── */}
      {FIGURE[f.name] === 'ganesha' ? (
        <div style={{ marginTop: 104, position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: -40, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}26 0%, transparent 66%)`,
          }} />
          <div style={{ position: 'relative' }}>
            <GaneshaMark size={300} color={accent} />
          </div>
        </div>
      ) : (
        <div style={{
          marginTop: 150, width: 168, height: 168, borderRadius: '50%',
          background: `linear-gradient(160deg, ${accent}, #f59e0b)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 90px ${accent}66`, position: 'relative',
        }}>
          <span style={{
            fontFamily: "'Tiro Devanagari Hindi', 'Noto Sans Devanagari', serif",
            fontSize: 96, lineHeight: 1, color: '#4a1103', marginTop: -8,
          }}>ॐ</span>
        </div>
      )}

      {/* ── The greeting ────────────────────────────────────────────────── */}
      <div style={{
        marginTop: FIGURE[f.name] ? 24 : 52,
        textAlign: 'center', position: 'relative', padding: '0 70px',
      }}>
        <div style={{
          fontFamily: "'Tiro Devanagari Hindi', 'Noto Sans Devanagari', serif",
          fontSize: 92, lineHeight: 1.25, color: accent,
          textShadow: `0 4px 40px ${accent}55`,
        }}>
          {f.greeting}
        </div>
        <div style={{
          fontSize: 40, fontWeight: 800, letterSpacing: 2, marginTop: 18, color: ink,
        }}>
          {f.greetingLatin}
        </div>
        <div style={{
          marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <span style={{ height: 1, width: 90, background: `${accent}66` }} />
          <span style={{
            fontSize: 26, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase',
            color: `${ink}cc`,
          }}>
            {f.name}
          </span>
          <span style={{ height: 1, width: 90, background: `${accent}66` }} />
        </div>
      </div>

      {/* ── The club's wish for the season ──────────────────────────────── */}
      <div style={{
        marginTop: 'auto', marginBottom: 40, padding: '0 110px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 46, marginBottom: 22, letterSpacing: 10 }}>
          {f.motifs.join('  ')}
        </div>
        <p style={{
          fontSize: 34, lineHeight: 1.5, fontWeight: 600, color: `${ink}e0`, margin: 0,
        }}>
          {f.wish}
        </p>
      </div>

      {/* ── Who it is from ──────────────────────────────────────────────── */}
      <div style={{
        width: '100%', padding: '34px 70px 56px',
        borderTop: `1px solid ${accent}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <img src={SCC_LOGO_DATA_URL} alt=""
          style={{ width: 74, height: 74, borderRadius: 16, objectFit: 'cover' }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 0.5 }}>{clubName}</div>
          <div style={{ fontSize: 22, color: `${ink}99`, marginTop: 4 }}>
            {new Date(f.date + 'T00:00:00').toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {dayLabel ? ` · ${dayLabel}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
});

export default FestivalPoster;
