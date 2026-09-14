import { useState } from 'react';
import { Share2, Sparkles } from 'lucide-react';
import { festivalFor, festivalDay } from '../config/festivals';
import { todayIso } from '../config/season';
import { FestivalPosterModal } from './FestivalPosterModal';
import { GaneshaMark } from './GaneshaMark';

// ─── Today's festival, on the dashboard ───────────────────────────────────────
// A hero, not a strip. This is the first thing the club sees on the morning of a
// festival, and a one-line notification bar does not carry a greeting — it reads
// like an alert about a greeting.
//
// Appears only on the day (through the ten of Ganesh Chaturthi) and retires
// itself at midnight, so nobody has to remember to take it down — which is how
// these things end up wishing the club a happy Diwali in March.

/** Festivals with a figure to draw; everything else gets the ॐ. */
const FIGURE: Record<string, 'ganesha'> = { 'Ganesh Chaturthi': 'ganesha' };

export function FestivalBanner() {
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const f = festivalFor(today);
  if (!f) return null;

  const day = festivalDay(f, today);
  const dayLabel = f.days > 1 ? `Day ${day} of ${f.days}` : null;
  const { deep, warm, accent, ink } = f.colors;

  return (
    <>
      <div className="r-card relative overflow-hidden shadow-xl"
        style={{
          background: `radial-gradient(620px circle at 50% -10%, ${warm} 0%, transparent 62%),
                       linear-gradient(165deg, ${deep} 0%, #1a0600 70%, #120400 100%)`,
          color: ink,
        }}>

        {/* Gold frame, and the lamp glow the poster uses. */}
        <div className="absolute pointer-events-none" style={{ inset: 10, border: `1px solid ${accent}44`, borderRadius: 14 }} />
        <div className="absolute pointer-events-none" style={{
          top: -60, left: '50%', transform: 'translateX(-50%)', width: 420, height: 420,
          borderRadius: '50%', background: `radial-gradient(circle, ${accent}22 0%, transparent 64%)`,
        }} />

        {/* Marigolds along the top, as on the poster. */}
        <div className="absolute inset-x-0 flex justify-center gap-2 text-lg pointer-events-none"
          style={{ top: 14, opacity: 0.85 }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} style={{ transform: `translateY(${i % 2 ? 6 : 0}px)` }}>{i % 2 ? '🌼' : '🌺'}</span>
          ))}
        </div>

        <div className="relative px-5 pt-12 pb-6 flex flex-col items-center text-center
                        sm:flex-row sm:text-left sm:gap-7 sm:px-8 sm:pt-14 sm:pb-8">

          {/* Bappa */}
          <div className="flex-shrink-0">
            {FIGURE[f.name] === 'ganesha'
              ? <GaneshaMark size={132} color={accent} />
              : (
                <span className="w-[110px] h-[110px] rounded-full flex items-center justify-center"
                  style={{ background: `linear-gradient(160deg, ${accent}, #f59e0b)` }}>
                  <span style={{ fontFamily: "'Tiro Devanagari Hindi', serif", fontSize: 64, color: deep }}>ॐ</span>
                </span>
              )}
          </div>

          <div className="min-w-0 flex-1 mt-3 sm:mt-0">
            <p style={{
              fontFamily: "'Tiro Devanagari Hindi', 'Noto Sans Devanagari', serif",
              color: accent, fontSize: 34, lineHeight: 1.3,
            }}>
              {f.greeting}
            </p>
            <p className="font-black text-lg sm:text-xl mt-1" style={{ color: ink }}>
              {f.greetingLatin}
            </p>

            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
              <span className="h-px w-8" style={{ background: `${accent}66` }} />
              <span className="t-micro font-black uppercase tracking-[3px]" style={{ color: `${ink}bb` }}>
                {f.name}{dayLabel ? ` · ${dayLabel}` : ''}
              </span>
              <span className="h-px w-8" style={{ background: `${accent}66` }} />
            </div>

            <p className="t-body font-semibold mt-3 leading-relaxed" style={{ color: `${ink}dd` }}>
              {f.wish}
            </p>

            <button onClick={() => setOpen(true)}
              className="mt-4 r-control px-4 py-2.5 font-black text-sm inline-flex items-center gap-2"
              style={{ background: accent, color: deep }}>
              <Share2 className="w-4 h-4" />
              Share wishes with the team
            </button>
          </div>

          <Sparkles className="hidden sm:block w-5 h-5 flex-shrink-0 self-start"
            style={{ color: `${accent}99` }} />
        </div>
      </div>

      <FestivalPosterModal festival={f} dayLabel={dayLabel}
        isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default FestivalBanner;
