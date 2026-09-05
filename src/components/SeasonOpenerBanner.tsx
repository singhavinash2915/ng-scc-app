import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { JERSEY } from '../lib/playerCard';
import { prettyTime } from '../lib/matchTime';
import { seasonLabel, seasonWindow, CURRENT_SEASON } from '../config/season';
import type { Match } from '../types';

// ─── Season opener ────────────────────────────────────────────────────────────
// The one fixture in the year that deserves a billboard rather than a row: the
// season's first ball, and it happens to be the club against itself.
//
// The two sides own half the banner each, in their real jersey colours, split
// on the diagonal so neither reads as the home team. It shows only until the
// match is played, then disappears on its own — a "coming soon" that outlives
// the event is worse than never having run it.

interface Props { matches: Match[] }

const pad = (n: number) => String(n).padStart(2, '0');

export function SeasonOpenerBanner({ matches }: Props) {
  const opener = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return matches
      .filter(m => m.result === 'upcoming' && m.date >= today
        && /brahmos/i.test(m.opponent ?? '') && /agni/i.test(m.opponent ?? ''))
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [matches]);

  // Is this actually the season's first ball? It stops being true the moment
  // the fixture moves — a postponed or rained-off opener means some other match
  // now starts the season, and the banner simply slides to the next internal
  // fixture without noticing. Calling a match three weeks in "first ball" is the
  // kind of thing everyone spots immediately.
  const isSeasonFirst = useMemo(() => {
    if (!opener) return false;
    const { start } = seasonWindow(CURRENT_SEASON);
    return !matches.some(m =>
      m.date >= start && m.date < opener.date && m.result !== 'cancelled');
  }, [matches, opener]);

  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!opener) return;
    const target = new Date(`${opener.date}T${opener.start_time || '07:00'}:00`).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) return setLeft({ d: 0, h: 0, m: 0, s: 0 });
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opener]);

  if (!opener) return null;

  const when = new Date(opener.date + 'T00:00:00')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = prettyTime(opener.start_time);

  return (
    <Link to="/scc-mahasangram" className="block relative overflow-hidden r-card shadow-2xl m-enter">
      {/* Two halves, split on the diagonal — neither side is the host. */}
      <div className="absolute inset-0" style={{ background: JERSEY.agni.bg }} />
      <div className="absolute inset-0"
        style={{ background: JERSEY.brahmos.bg, clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)' }} />
      {/* A seam of gold where they meet, and a warm bloom so the flat gradients
          read as light rather than paint. */}
      <div className="absolute inset-y-0 pointer-events-none"
        style={{ left: '46%', width: 2, background: 'linear-gradient(180deg,transparent,#f0b429,transparent)',
                 transform: 'skewX(-9deg)' }} />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full
                      bg-amber-300/15 blur-3xl pointer-events-none" />

      <div className="relative px-5 py-6 text-white">
        <p className="t-micro font-black uppercase tracking-[3px] text-center"
          style={{ color: '#f0b429' }}>
          {isSeasonFirst
            ? `${seasonLabel(CURRENT_SEASON)} · first ball`
            : 'SCC MahaSangram · next clash'}
        </p>

        <div className="flex items-center justify-center gap-3 sm:gap-5 mt-4">
          <div className="flex-1 text-right min-w-0">
            <img src={JERSEY.brahmos.crest} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain ml-auto" />
            <p className="font-display font-extrabold text-base sm:text-xl leading-tight mt-1.5 truncate">
              Brahmos
            </p>
          </div>

          <div className="shrink-0 text-center px-1">
            <p className="font-display text-2xl sm:text-3xl font-black italic"
              style={{ color: '#f0b429' }}>VS</p>
          </div>

          <div className="flex-1 text-left min-w-0">
            <img src={JERSEY.agni.crest} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
            <p className="font-display font-extrabold text-base sm:text-xl leading-tight mt-1.5 truncate">
              Agni
            </p>
          </div>
        </div>

        <p className="text-center font-display text-lg sm:text-xl font-extrabold mt-4">
          {when}{time ? ` · ${time}` : ''}
        </p>
        {opener.venue && (
          <p className="text-center t-meta text-white/70 mt-0.5 inline-flex items-center gap-1
                        justify-center w-full">
            <MapPin className="w-3.5 h-3.5" /> {opener.venue}
          </p>
        )}

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-5 max-w-sm mx-auto">
          {([['DAYS', left.d], ['HRS', left.h], ['MIN', left.m], ['SEC', left.s]] as const).map(([l, v]) => (
            <div key={l} className="r-control bg-white/12 border border-white/15 py-2 text-center">
              <p className="t-num text-xl sm:text-2xl leading-none">{pad(v)}</p>
              <p className="t-micro text-white/55 mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        <p className="text-center t-meta font-bold text-white/70 mt-4 inline-flex items-center
                      gap-1.5 justify-center w-full">
          The rivalry, from ball one <ArrowRight className="w-3.5 h-3.5" />
        </p>
      </div>
    </Link>
  );
}
