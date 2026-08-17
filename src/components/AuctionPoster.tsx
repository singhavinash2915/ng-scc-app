import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Video, ChevronRight, Crown } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import { AUCTION_NIGHT, LEAGUE_CAPTAIN_IDS, LEAGUE_TEAM_NAMES, SEASON_NEW } from '../config/season2';
import { PURSE_LAKH, formatPrice } from '../hooks/useSCCLeague';
import { useAuctionLive } from '../hooks/useAuctionLive';

// ─── Dashboard: auction night poster ───────────────────────────────────────────
// The pre-event hype card. Shows a live countdown to the auction, the two named
// squads and their captains, and the Meet link. It stands down on its own once
// the AuctionLiveBanner takes over (that renders whenever the auction row
// exists), so this is only ever seen in the run-up.

const two = (n: number) => String(n).padStart(2, '0');

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, target.getTime() - now);
  const s = Math.floor(ms / 1000);
  return {
    now,
    over: ms === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

export function AuctionPoster() {
  const { members } = useMembers();
  const c = useCountdown(AUCTION_NIGHT.startsAt);
  const { auction } = useAuctionLive(SEASON_NEW);
  const cap = (i: number) => members.find(m => m.id === LEAGUE_CAPTAIN_IDS[i]);

  // Hand off cleanly: the moment the auctioneer starts (a row exists), the live
  // banner takes over, so the poster steps aside. Also stand down a few hours
  // past kickoff in case the night never actually ran.
  if (auction) return null;
  if (c.now - AUCTION_NIGHT.startsAt.getTime() > 3 * 3600 * 1000) return null;

  const CELLS: Array<[number, string]> = [
    [c.days, 'days'], [c.hours, 'hrs'], [c.mins, 'min'], [c.secs, 'sec'],
  ];

  return (
    <div className="relative overflow-hidden r-card shadow-2xl text-white ap-root"
      style={{ background: 'radial-gradient(800px 360px at 15% -10%, #7c3aed 0%, transparent 55%), radial-gradient(700px 320px at 100% 110%, #db2777 0%, transparent 55%), linear-gradient(150deg,#0b1020,#020617)' }}>
      <style>{`
        .ap-root { --a1:#60a5fa; --a2:#fb923c; }
        .ap-blob { animation: ap-float 7s ease-in-out infinite; }
        @keyframes ap-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes ap-glow { 0%,100%{opacity:.6} 50%{opacity:1} }
        .ap-live { animation: ap-glow 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .ap-blob,.ap-live{animation:none} }
      `}</style>
      <div className="ap-blob absolute -top-16 -right-10 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: '#a855f7', filter: 'blur(70px)', opacity: .4 }} />

      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 backdrop-blur
                           rounded-full px-3 py-1 t-micro font-black uppercase tracking-[3px]">
            <Gavel className="w-3.5 h-3.5" /> Auction Night
          </span>
          <span className="ap-live inline-flex items-center gap-1 t-micro font-black text-rose-300">
            ● {AUCTION_NIGHT.label}
          </span>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-3 leading-[1.05]">
          {/* "Draft" is a different format entirely — captains taking turns
              picking. This is an auction: names go under the hammer and the
              higher bid wins. Calling it a draft only confuses the squad. */}
          The SCC League <span style={{ background: 'linear-gradient(90deg,#fde68a,#fbbf24 45%,#f472b6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Auction</span>
        </h2>
        <p className="text-white/70 text-sm mt-1.5">
          {formatPrice(PURSE_LAKH)} a side · 15 a squad · live on Google Meet 🎥
        </p>

        {/* countdown */}
        <div className="grid grid-cols-4 gap-2 mt-4 max-w-sm">
          {CELLS.map(([v, l]) => (
            <div key={l} className="bg-white/10 border border-white/15 r-card py-2.5 text-center">
              <p className="t-num text-2xl sm:text-3xl leading-none">{two(v)}</p>
              <p className="t-micro font-bold uppercase tracking-widest text-white/55 mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* the clásico */}
        <div className="flex items-center gap-3 mt-5">
          {[0, 1].map(i => {
            const m = cap(i);
            const colour = i === 0 ? 'var(--a1)' : 'var(--a2)';
            const teamName = i === 0 ? LEAGUE_TEAM_NAMES.team1 : LEAGUE_TEAM_NAMES.team2;
            return (
              <div key={i} className="flex-1 min-w-0 flex items-center gap-2.5">
                {i === 1 && <span className="font-black text-white/40 text-sm">vs</span>}
                {m?.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-10 h-10 r-card object-cover flex-shrink-0"
                      style={{ border: `2px solid ${colour}` }} />
                  : <div className="w-10 h-10 r-card bg-white/15 flex items-center justify-center
                        font-black flex-shrink-0" style={{ border: `2px solid ${colour}` }}>
                      {m?.name?.charAt(0) ?? '?'}
                    </div>}
                <div className="min-w-0">
                  <p className="font-black text-sm truncate" style={{ color: colour }}>{teamName}</p>
                  <p className="t-micro text-white/55 truncate inline-flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" fill="currentColor" />
                    {m?.name?.split(' ')[0] ?? '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* actions */}
        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <a href={AUCTION_NIGHT.meetUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 r-card bg-white text-slate-900
                       font-black py-3 text-sm">
            <Video className="w-4 h-4" /> Join the Meet
          </a>
          <Link to="/auction"
            className="inline-flex items-center justify-center gap-1.5 r-card bg-white/15
                       border border-white/25 font-black py-3 text-sm">
            Auction Centre <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
