import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ClubWrapped } from '../hooks/useSeasonFinale';

interface Props { data: ClubWrapped; onClose: () => void }

const SLIDE_MS = 6000;
const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-white/70 text-sm font-bold uppercase tracking-[3px]">{children}</p>
);
const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="font-display text-6xl sm:text-7xl font-extrabold text-white tabular-nums leading-none my-3">{children}</p>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="text-white/80 text-base font-medium mt-3 leading-snug max-w-xs mx-auto">{children}</p>
);

/** Club-level "Season Wrapped" — the whole team's year in review, as a story. */
export function ClubWrappedStory({ data, onClose }: Props) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const slides = useMemo(() => {
    const list: { bg: string; content: React.ReactNode }[] = [];
    list.push({ bg: 'linear-gradient(160deg,#7c3aed,#4338ca 60%,#0a0f1a)', content: (
      <><Kicker>Sangria CC · {data.season}</Kicker>
        <p className="font-display text-4xl sm:text-5xl font-extrabold text-white mt-6 leading-tight">Our season,</p>
        <p className="font-display text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-200 to-pink-200 bg-clip-text text-transparent mt-2">wrapped 🏏</p>
        <Sub>Tap to relive the club's {data.season} →</Sub></>
    )});
    list.push({ bg: 'linear-gradient(160deg,#0ea5e9,#0369a1 60%,#0a0f1a)', content: (
      <><Kicker>Matches played</Kicker><Big>{data.played}</Big>
        <Sub>{data.won}W · {data.lost}L{data.nr ? ` · ${data.nr} NR` : ''} — a {data.winPct}% win rate.</Sub></>
    )});
    if (data.biggestWin) list.push({ bg: 'linear-gradient(160deg,#059669,#065f46 60%,#0a0f1a)', content: (
      <><Kicker>Biggest win</Kicker>
        <p className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-5 leading-tight capitalize">{data.biggestWin}</p>
        <Sub>Our most emphatic result of the season. 💪</Sub></>
    )});
    if (data.highestTotal) list.push({ bg: 'linear-gradient(160deg,#d97706,#92400e 60%,#0a0f1a)', content: (
      <><Kicker>Highest total</Kicker>
        <p className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-5 leading-tight">{data.highestTotal}</p>
        <Sub>The biggest score we posted all year. 🔥</Sub></>
    )});
    if (data.topScorer) list.push({ bg: 'linear-gradient(160deg,#059669,#064e3b 60%,#0a0f1a)', content: (
      <><Kicker>Top run-scorer</Kicker>
        <p className="font-display text-4xl font-extrabold text-white mt-5">{data.topScorer.name}</p>
        <Big>{data.topScorer.runs}</Big><Sub>runs — leading the charge with the bat.</Sub></>
    )});
    if (data.topWicket) list.push({ bg: 'linear-gradient(160deg,#7c3aed,#4c1d95 60%,#0a0f1a)', content: (
      <><Kicker>Top wicket-taker</Kicker>
        <p className="font-display text-4xl font-extrabold text-white mt-5">{data.topWicket.name}</p>
        <Big>{data.topWicket.wkts}</Big><Sub>wickets — our strike weapon all season.</Sub></>
    )});
    if (data.mostMom) list.push({ bg: 'linear-gradient(160deg,#eab308,#a16207 60%,#0a0f1a)', content: (
      <><Kicker>Most Man-of-the-Match</Kicker>
        <p className="font-display text-4xl font-extrabold text-white mt-5">{data.mostMom.name}</p>
        <Big>{data.mostMom.count}🏅</Big><Sub>match-winning displays this season.</Sub></>
    )});
    if (data.elClasico) list.push({ bg: 'linear-gradient(160deg,#e11d48,#3b0764 60%,#0a0f1a)', content: (
      <><Kicker>El Clásico verdict</Kicker>
        <p className="font-display text-5xl font-extrabold text-white tabular-nums my-3">{data.elClasico.dhur}<span className="text-white/40 text-3xl"> – </span>{data.elClasico.baz}</p>
        <p className="text-white/80 text-sm font-semibold">Dhurandhars vs Baazigars</p>
        <Sub>{data.elClasico.verdict} 🔥</Sub></>
    )});
    list.push({ bg: 'linear-gradient(160deg,#7c3aed,#0f766e 55%,#0a0f1a)', content: (
      <><Kicker>{data.season} · Wrapped</Kicker>
        <p className="font-display text-2xl font-extrabold text-white mt-3 mb-2">Sangria Cricket Club</p>
        <div className="grid grid-cols-2 gap-3 mt-3 max-w-xs mx-auto w-full">
          {[
            { v: data.played, l: 'Matches' }, { v: `${data.winPct}%`, l: 'Win rate' },
            { v: data.topScorer?.runs ?? '—', l: 'Top runs' }, { v: data.topWicket?.wkts ?? '—', l: 'Top wkts' },
            { v: data.mvp?.name?.split(' ')[0] ?? '—', l: 'MVP' }, { v: data.elClasico ? `${data.elClasico.dhur}-${data.elClasico.baz}` : '—', l: 'Clásico' },
          ].map(s => (
            <div key={s.l} className="rounded-xl bg-white/10 border border-white/15 py-3">
              <p className="font-display text-xl font-extrabold text-white tabular-nums leading-none truncate px-1">{s.v}</p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mt-1">{s.l}</p>
            </div>
          ))}
        </div>
        <p className="text-white/50 text-xs mt-5">📸 Screenshot to share · sangria cricket club</p></>
    )});
    return list;
  }, [data]);

  useEffect(() => {
    if (paused) return;
    timer.current = window.setTimeout(() => setI(p => (p + 1 < slides.length ? p + 1 : p)), SLIDE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, paused, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI(p => Math.min(p + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setI(p => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, slides.length]);

  const share = async () => {
    const text = `Sangria CC ${data.season} 🏏\n${data.played} matches · ${data.winPct}% win rate · MVP ${data.mvp?.name ?? '-'}`;
    try { if (navigator.share) await navigator.share({ title: 'Club Season Wrapped', text }); else await navigator.clipboard.writeText(text); } catch { /* cancelled */ }
  };

  const atEnd = i === slides.length - 1;
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center" style={{ background: '#05070d' }}>
      <div className="relative w-full max-w-md flex flex-col" style={{ background: slides[i].bg, transition: 'background 0.5s' }}>
        <div className="flex gap-1 px-3 pt-3 relative z-20">
          {slides.map((_, n) => (
            <div key={n} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: n <= i ? '100%' : '0%', transition: n === i && !paused ? `width ${SLIDE_MS}ms linear` : 'none' }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-3 relative z-20">
          <span className="text-white/80 text-xs font-black uppercase tracking-[2px]">✨ Club Wrapped</span>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"><X className="w-4 h-4 text-white" /></button>
        </div>
        <button aria-label="Previous" className="absolute left-0 top-16 bottom-0 w-1/3 z-10" onClick={() => setI(p => Math.max(p - 1, 0))} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />
        <button aria-label="Next" className="absolute right-0 top-16 bottom-0 w-2/3 z-10" onClick={() => setI(p => Math.min(p + 1, slides.length - 1))} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />
        <div key={i} className="flex-1 flex flex-col items-center justify-center text-center px-8 relative z-0" style={{ animation: 'wrappedIn 0.4s ease-out' }}>
          {slides[i].content}
        </div>
        <div className="relative z-20 px-5 pb-6 pt-2 flex items-center justify-between">
          <button onClick={() => setI(p => Math.max(p - 1, 0))} disabled={i === 0} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-5 h-5 text-white" /></button>
          {atEnd ? (
            <button onClick={share} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-gray-900 font-black text-sm"><Share2 className="w-4 h-4" /> Share</button>
          ) : <span className="text-white/50 text-xs font-semibold">tap to continue</span>}
          <button onClick={() => setI(p => Math.min(p + 1, slides.length - 1))} disabled={atEnd} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-5 h-5 text-white" /></button>
        </div>
      </div>
      <style>{`@keyframes wrappedIn{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
