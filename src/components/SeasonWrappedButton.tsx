import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SeasonWrappedStory } from './SeasonWrappedStory';

interface Props {
  memberId: string;
  season?: string;
  /** 'pill' = compact button (profile), 'banner' = full-width dashboard card */
  variant?: 'pill' | 'banner';
  label?: string;
}

export function SeasonWrappedButton({ memberId, season = '2025-26', variant = 'pill', label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'banner' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-3 text-left shadow-lg"
          style={{ background: 'linear-gradient(110deg,#7c3aed,#db2777 55%,#f59e0b)' }}
        >
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">{label || `Your ${season} Wrapped`} ✨</p>
            <p className="text-white/80 text-xs font-medium">Your personal season story — tap to rewind</p>
          </div>
          <span className="text-white/90 text-xl">→</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow"
          style={{ background: 'linear-gradient(110deg,#7c3aed,#db2777)' }}
        >
          <Sparkles className="w-3.5 h-3.5" /> {label || 'Wrapped'}
        </button>
      )}
      {open && <SeasonWrappedStory memberId={memberId} season={season} onClose={() => setOpen(false)} />}
    </>
  );
}
