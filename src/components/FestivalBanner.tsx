import { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { festivalFor, festivalDay } from '../config/festivals';
import { todayIso } from '../config/season';
import { FestivalPosterModal } from './FestivalPosterModal';

// ─── Today's festival, on the dashboard ───────────────────────────────────────
// Appears only on the day (or through the ten of Ganesh Chaturthi) and retires
// itself at midnight — nobody has to remember to take it down, which is how
// these things end up wishing the club a happy Diwali in March.
//
// Tapping it opens the poster, ready to send to the group.

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
      <button onClick={() => setOpen(true)}
        className="w-full r-card relative overflow-hidden px-5 py-4 text-left shadow-lg group"
        style={{ background: `linear-gradient(110deg, ${deep}, ${warm} 60%, ${accent}cc)` }}>
        <span className="absolute -top-10 -right-6 text-[110px] leading-none opacity-[0.14] select-none">
          {f.motifs[0]}
        </span>

        <span className="relative flex items-center gap-3">
          <span className="w-11 h-11 r-card bg-white/25 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" style={{ color: ink }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-black text-base leading-tight truncate" style={{ color: ink }}>
              {f.greeting}
            </span>
            <span className="block t-meta font-semibold truncate" style={{ color: `${ink}cc` }}>
              {f.name}{dayLabel ? ` · ${dayLabel}` : ''} · tap to share wishes with the team
            </span>
          </span>
          <ChevronRight className="w-5 h-5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
            style={{ color: `${ink}e6` }} />
        </span>
      </button>

      <FestivalPosterModal festival={f} dayLabel={dayLabel}
        isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default FestivalBanner;
