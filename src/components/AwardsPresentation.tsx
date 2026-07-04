import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Award } from '../hooks/useSeasonFinale';

interface Props {
  awards: Award[];
  season: string;
  onClose: () => void;
}

/**
 * Fullscreen "Awards Night" presentation — projector-friendly. Shows one award
 * at a time: first the category (suspense), then tap/→/Space to reveal the
 * winner with a confetti burst. Built for the end-of-season party.
 */
export function AwardsPresentation({ awards, season, onClose }: Props) {
  const list = awards.filter(a => a.member);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const award = list[idx];

  const next = useCallback(() => {
    if (!revealed) { setRevealed(true); return; }
    if (idx < list.length - 1) { setIdx(i => i + 1); setRevealed(false); }
  }, [revealed, idx, list.length]);

  const prev = useCallback(() => {
    if (revealed) { setRevealed(false); return; }
    if (idx > 0) { setIdx(i => i - 1); setRevealed(true); }
  }, [revealed, idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  if (!award) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-white" style={{ background: 'radial-gradient(1000px circle at 50% -10%, rgba(251,191,36,0.18), transparent 50%), #070b14' }}>
        <p className="text-2xl font-bold">No awards to present yet.</p>
        <button onClick={onClose} className="mt-4 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 font-bold">Close</button>
      </div>
    );
  }

  return (
    <div
      onClick={next}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-white select-none cursor-pointer overflow-hidden"
      style={{ background: 'radial-gradient(1100px circle at 50% -12%, rgba(251,191,36,0.20), transparent 48%), radial-gradient(900px circle at 100% 110%, rgba(124,58,237,0.25), transparent 50%), #06080f' }}
    >
      {/* Confetti on reveal */}
      {revealed && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="absolute text-2xl" style={{
              left: `${(i * 2.8) % 100}%`, top: '-8%',
              animation: `confFall ${2.2 + (i % 5) * 0.4}s linear ${(i % 7) * 0.12}s forwards`,
            }}>{['🎉', '🏏', '⭐', '🏆', '✨', '🎊'][i % 6]}</span>
          ))}
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-5 text-white/70" onClick={e => e.stopPropagation()}>
        <span className="text-xs font-black uppercase tracking-[3px]">🏆 SCC Awards Night · {season}</span>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-6 h-6" /></button>
      </div>

      {/* Category */}
      <p className="relative text-6xl sm:text-7xl mb-3 animate-[pop_.5s_ease]">{award.emoji}</p>
      <p className="relative text-xs sm:text-sm font-black uppercase tracking-[4px] text-amber-300">{award.title}</p>

      {!revealed ? (
        <>
          <p className="relative font-display text-3xl sm:text-5xl font-extrabold mt-6 text-white/90">And the winner is…</p>
          <p className="relative text-white/40 text-sm mt-8 animate-pulse">Tap anywhere / press → to reveal</p>
        </>
      ) : (
        <div className="relative flex flex-col items-center mt-6 animate-[pop_.5s_cubic-bezier(.34,1.56,.64,1)]">
          {award.member!.avatar_url ? (
            <img src={award.member!.avatar_url} alt="" className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-amber-400/60 shadow-[0_0_60px_-8px_rgba(251,191,36,0.6)]" />
          ) : (
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-6xl font-black shadow-2xl">{award.member!.name.charAt(0)}</div>
          )}
          <h2 className="font-display text-4xl sm:text-6xl font-extrabold mt-5 text-center bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">{award.member!.name}</h2>
          <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-2 tabular-nums">{award.value}</p>
          {award.blurb && <p className="text-white/50 text-sm mt-2 max-w-md text-center">{award.blurb}</p>}
        </div>
      )}

      {/* Progress + nav */}
      <div className="absolute bottom-0 inset-x-0 p-5 flex items-center justify-between" onClick={e => e.stopPropagation()}>
        <button onClick={prev} disabled={idx === 0 && !revealed} className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronLeft className="w-6 h-6" /></button>
        <div className="flex gap-1.5">
          {list.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-amber-400' : i < idx ? 'w-1.5 bg-white/50' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>
        <button onClick={next} className="p-3 rounded-full bg-white/10 hover:bg-white/20"><ChevronRight className="w-6 h-6" /></button>
      </div>

      <style>{`
        @keyframes confFall { to { transform: translateY(108vh) rotate(540deg); opacity: 0.9; } }
        @keyframes pop { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
