import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSeasonWrapped } from '../hooks/useSeasonWrapped';

interface Props {
  memberId: string;
  season?: string;
  onClose: () => void;
}

const SLIDE_MS = 6000;

interface Slide { bg: string; content: React.ReactNode }

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-6xl sm:text-7xl font-black text-white tabular-nums leading-none my-3">{children}</p>
);
const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-white/70 text-sm font-bold uppercase tracking-[3px]">{children}</p>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="text-white/80 text-base font-medium mt-3 leading-snug max-w-xs mx-auto">{children}</p>
);

export function SeasonWrappedStory({ memberId, season = '2025-26', onClose }: Props) {
  const data = useSeasonWrapped(memberId, season);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const slides: Slide[] = useMemo(() => {
    if (!data) return [];
    const first = data.member.name.split(' ')[0];
    const list: Slide[] = [];

    list.push({
      bg: 'linear-gradient(160deg,#7c3aed,#4338ca 60%,#0a0f1a)',
      content: (
        <>
          <Kicker>Sangria CC · {data.season}</Kicker>
          <p className="text-4xl sm:text-5xl font-black text-white mt-6 leading-tight">Hey {first},</p>
          <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-200 to-pink-200 bg-clip-text text-transparent mt-2">here's your season 🏏</p>
          <Sub>Tap to rewind your {data.season} in cricket →</Sub>
        </>
      ),
    });

    list.push({
      bg: 'linear-gradient(160deg,#0ea5e9,#0369a1 60%,#0a0f1a)',
      content: (
        <>
          <Kicker>You showed up</Kicker>
          <Big>{data.matches}</Big>
          <Sub>matches played this season. Every one of them counted. 🙌</Sub>
        </>
      ),
    });

    list.push({
      bg: 'linear-gradient(160deg,#059669,#065f46 60%,#0a0f1a)',
      content: (
        <>
          <Kicker>With the bat</Kicker>
          <Big>{data.runs.toLocaleString('en-IN')}</Big>
          <p className="text-white/90 font-bold">runs scored</p>
          <Sub>
            High score {data.highest} · strike rate {Math.round(data.strikeRate)}
            {data.runsDelta != null && data.runsDelta !== 0 && (
              <> · {data.runsDelta > 0 ? '📈 up' : '📉 down'} {Math.abs(data.runsDelta)} vs last season</>
            )}
          </Sub>
        </>
      ),
    });

    if (data.wickets > 0) {
      list.push({
        bg: 'linear-gradient(160deg,#db2777,#9d174d 60%,#0a0f1a)',
        content: (
          <>
            <Kicker>With the ball</Kicker>
            <Big>{data.wickets}</Big>
            <p className="text-white/90 font-bold">wickets taken</p>
            <Sub>Best figures {data.bestFigures} · economy {data.economy.toFixed(1)}
              {data.wicketsDelta != null && data.wicketsDelta !== 0 && (
                <> · {data.wicketsDelta > 0 ? '📈 up' : '📉 down'} {Math.abs(data.wicketsDelta)} vs last season</>
              )}
            </Sub>
          </>
        ),
      });
    }

    const moment = (() => {
      const k = data.bestKnock, sp = data.bestSpell;
      if (k && (!sp || k.runs >= sp.wickets * 20)) return `${k.runs} off ${k.balls} vs ${k.opponent}`;
      if (sp) return `${sp.wickets}/${sp.runs} vs ${sp.opponent}`;
      return null;
    })();
    if (moment) {
      list.push({
        bg: 'linear-gradient(160deg,#f59e0b,#b45309 60%,#0a0f1a)',
        content: (
          <>
            <Kicker>Your signature moment</Kicker>
            <p className="text-3xl sm:text-4xl font-black text-white mt-5 leading-tight">{moment}</p>
            <Sub>Your standout performance of the season. 🔥</Sub>
          </>
        ),
      });
    }

    if (data.moms > 0) {
      list.push({
        bg: 'linear-gradient(160deg,#eab308,#a16207 60%,#0a0f1a)',
        content: (
          <>
            <Kicker>Silverware</Kicker>
            <Big>{data.moms}</Big>
            <p className="text-white/90 font-bold">Man of the Match award{data.moms === 1 ? '' : 's'} 🏅</p>
            <Sub>When it mattered, you delivered.</Sub>
          </>
        ),
      });
    }

    if (data.overallRank) {
      list.push({
        bg: 'linear-gradient(160deg,#6366f1,#3730a3 60%,#0a0f1a)',
        content: (
          <>
            <Kicker>Where you rank</Kicker>
            <Big>#{data.overallRank}</Big>
            <p className="text-white/90 font-bold">of {data.totalRanked} in the club</p>
            <Sub>
              {data.battingRank && <>Batting #{data.battingRank}</>}
              {data.battingRank && data.bowlingRank && ' · '}
              {data.bowlingRank && <>Bowling #{data.bowlingRank}</>}
            </Sub>
          </>
        ),
      });
    }

    if (data.badgeCount > 0) {
      list.push({
        bg: 'linear-gradient(160deg,#0d9488,#115e59 60%,#0a0f1a)',
        content: (
          <>
            <Kicker>Badges unlocked</Kicker>
            <Big>{data.badgeCount}</Big>
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-xs mx-auto">
              {data.badges.slice(0, 8).map((b, n) => (
                <span key={n} className="text-2xl" title={b.title}>{b.emoji}</span>
              ))}
            </div>
          </>
        ),
      });
    }

    list.push({
      bg: 'linear-gradient(160deg,#7c3aed,#0f766e 55%,#0a0f1a)',
      content: (
        <>
          <Kicker>{data.season} · Wrapped</Kicker>
          <p className="text-2xl font-black text-white mt-4">{data.member.name}</p>
          <div className="grid grid-cols-2 gap-3 mt-5 max-w-xs mx-auto w-full">
            {[
              { v: data.matches, l: 'Matches' },
              { v: data.runs.toLocaleString('en-IN'), l: 'Runs' },
              { v: data.wickets, l: 'Wickets' },
              { v: data.moms, l: 'MOMs' },
              { v: data.overallRank ? `#${data.overallRank}` : '—', l: 'Club rank' },
              { v: Math.round(data.fantasyTotal).toLocaleString('en-IN'), l: 'Fantasy pts' },
            ].map(s => (
              <div key={s.l} className="rounded-xl bg-white/10 border border-white/15 py-3">
                <p className="text-2xl font-black text-white tabular-nums leading-none">{s.v}</p>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs mt-5">📸 Screenshot to share · sangria cricket club</p>
        </>
      ),
    });

    return list;
  }, [data]);

  // Auto-advance
  useEffect(() => {
    if (paused || slides.length === 0) return;
    timerRef.current = window.setTimeout(() => {
      setI(prev => (prev + 1 < slides.length ? prev + 1 : prev));
    }, SLIDE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [i, paused, slides.length]);

  // Close on Escape
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
    if (!data) return;
    const text = `My ${data.season} Sangria Cricket Wrapped 🏏\n${data.matches} matches · ${data.runs} runs · ${data.wickets} wickets · ${data.moms} MOMs · #${data.overallRank ?? '-'} in the club`;
    try {
      if (navigator.share) await navigator.share({ title: 'My Season Wrapped', text });
      else { await navigator.clipboard.writeText(text); }
    } catch { /* user cancelled */ }
  };

  if (!data || slides.length === 0) return null;
  const atEnd = i === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center" style={{ background: '#05070d' }}>
      <div className="relative w-full max-w-md flex flex-col" style={{ background: slides[i].bg, transition: 'background 0.5s' }}>
        {/* Progress bars */}
        <div className="flex gap-1 px-3 pt-3 relative z-20">
          {slides.map((_, n) => (
            <div key={n} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{
                width: n < i ? '100%' : n === i ? '100%' : '0%',
                transition: n === i && !paused ? `width ${SLIDE_MS}ms linear` : 'none',
                animation: n === i && !paused ? 'wrappedFill 0s' : 'none',
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 relative z-20">
          <span className="text-white/80 text-xs font-black uppercase tracking-[2px]">✨ Wrapped</span>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tap zones */}
        <button aria-label="Previous" className="absolute left-0 top-16 bottom-0 w-1/3 z-10" onClick={() => setI(p => Math.max(p - 1, 0))}
          onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />
        <button aria-label="Next" className="absolute right-0 top-16 bottom-0 w-2/3 z-10" onClick={() => setI(p => Math.min(p + 1, slides.length - 1))}
          onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />

        {/* Slide content */}
        <div key={i} className="flex-1 flex flex-col items-center justify-center text-center px-8 relative z-0"
          style={{ animation: 'wrappedIn 0.4s ease-out' }}>
          {slides[i].content}
        </div>

        {/* Footer nav / share */}
        <div className="relative z-20 px-5 pb-6 pt-2 flex items-center justify-between">
          <button onClick={() => setI(p => Math.max(p - 1, 0))} disabled={i === 0}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-30">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          {atEnd ? (
            <button onClick={share} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-gray-900 font-black text-sm">
              <Share2 className="w-4 h-4" /> Share my Wrapped
            </button>
          ) : (
            <span className="text-white/50 text-xs font-semibold">tap to continue</span>
          )}
          <button onClick={() => setI(p => Math.min(p + 1, slides.length - 1))} disabled={atEnd}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-30">
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      <style>{`@keyframes wrappedIn{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
