import { useMemo, useState, useEffect } from 'react';
import { Trophy, Crown, X, Sparkles } from 'lucide-react';
import type { Match } from '../types';

interface Props {
  matches: Match[];
}

const SHOW_WINDOW_MS = 36 * 60 * 60 * 1000;   // ~a day-and-a-half from match date
const TEAMS = {
  dhurandars: { name: 'Dhurandhars', accent: '#f43f5e', soft: 'rgba(244,63,94,0.25)' },
  bazigars:   { name: 'Baazigars',   accent: '#38bdf8', soft: 'rgba(56,189,248,0.25)' },
} as const;

function parseRuns(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Heroic 24-hour victory showcase for the latest internal "El Clasico" final/
 * match. Auto-shows for ~a day after the game, then disappears. Dismissable.
 */
export function ElClasicoChampionBanner({ matches }: Props) {
  const data = useMemo(() => {
    const internal = matches
      .filter(m => m.match_type === 'internal' && ['won', 'draw'].includes(m.result) && m.winning_team)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = internal[0];
    if (!latest) return null;

    const sinceMs = Date.now() - new Date(latest.date + 'T00:00:00').getTime();
    if (sinceMs < 0 || sinceMs > SHOW_WINDOW_MS) return null;   // outside the 24h-ish window

    const winnerKey = latest.winning_team as 'dhurandars' | 'bazigars';
    const loserKey = winnerKey === 'dhurandars' ? 'bazigars' : 'dhurandars';
    // our_score is always Dhurandhars, opponent_score Baazigars (sync convention)
    const winnerScore = winnerKey === 'dhurandars' ? latest.our_score : latest.opponent_score;
    const loserScore  = winnerKey === 'dhurandars' ? latest.opponent_score : latest.our_score;

    const wr = parseRuns(winnerScore), lr = parseRuns(loserScore);
    const margin = wr != null && lr != null && wr > lr ? `by ${wr - lr} runs` : null;

    // Rivalry tally (all decided internal matches)
    const decided = matches.filter(m => m.match_type === 'internal' && m.winning_team);
    const dhur = decided.filter(m => m.winning_team === 'dhurandars').length;
    const baz = decided.filter(m => m.winning_team === 'bazigars').length;

    return {
      id: latest.id, winnerKey, loserKey, winnerScore, loserScore, margin,
      mom: latest.man_of_match?.name ?? null,
      dhur, baz,
    };
  }, [matches]);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (data) setDismissed(localStorage.getItem(`scc-elclasico-seen-${data.id}`) === '1');
  }, [data]);

  if (!data || dismissed) return null;

  const win = TEAMS[data.winnerKey as keyof typeof TEAMS];
  const lose = TEAMS[data.loserKey as keyof typeof TEAMS];

  const dismiss = () => {
    localStorage.setItem(`scc-elclasico-seen-${data.id}`, '1');
    setDismissed(true);
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: `radial-gradient(700px circle at 50% -20%, ${win.soft}, transparent 60%), linear-gradient(135deg, #2a1c05 0%, #120d02 55%, #0a0a0a 100%)` }}
    >
      {/* gold frame + glows */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: '1px solid rgba(251,191,36,0.4)' }} />
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(251,191,36,0.18)' }} />
      {/* confetti dots */}
      {[...Array(14)].map((_, i) => (
        <span key={i} aria-hidden className="absolute rounded-sm" style={{
          top: `${(i * 37) % 90 + 4}%`, left: `${(i * 53) % 94 + 3}%`,
          width: 6, height: 6,
          background: [win.accent, '#fbbf24', lose.accent, '#fff'][i % 4],
          opacity: 0.5,
          transform: `rotate(${i * 33}deg)`,
          animation: `clasicoFloat ${2.4 + (i % 5) * 0.4}s ease-in-out ${i * 0.12}s infinite`,
        }} />
      ))}

      <button onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
        <X className="w-3.5 h-3.5 text-white/70" />
      </button>

      <div className="relative px-5 py-5 lg:px-7 lg:py-6 text-center">
        {/* kicker */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/40 mb-3">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="text-amber-200 text-[10px] font-black uppercase tracking-[2.5px]">El Clásico · Champions</span>
        </div>

        {/* trophy + winner */}
        <div className="flex flex-col items-center" style={{ animation: 'clasicoPop 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <Trophy className="w-12 h-12 lg:w-14 lg:h-14 text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)]" fill="currentColor" />
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold tracking-tight mt-2 leading-none"
              style={{ color: win.accent, textShadow: `0 0 28px ${win.soft}` }}>
            {win.name}
          </h2>
          <p className="text-amber-100/90 text-sm font-bold uppercase tracking-[3px] mt-1">are champions 🏆</p>
        </div>

        {/* scoreline */}
        <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-black/30 border border-white/10">
          <span className="text-white font-black tabular-nums" style={{ color: win.accent }}>{data.winnerScore}</span>
          <span className="text-white/40 text-xs font-bold uppercase">def.</span>
          <span className="text-white/70 font-bold tabular-nums">{data.loserScore}</span>
        </div>
        {data.margin && (
          <p className="text-amber-200/80 text-xs font-semibold mt-1.5">{win.name} won {data.margin}</p>
        )}

        {/* MOM + rivalry */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {data.mom && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-100 text-xs font-bold">
              <Crown className="w-3.5 h-3.5 text-amber-300" fill="currentColor" /> {data.mom} · MOM
            </span>
          )}
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-xs font-black">
            <span style={{ color: TEAMS.dhurandars.accent }}>Dhurandhars {data.dhur}</span>
            <span className="text-white/40">–</span>
            <span style={{ color: TEAMS.bazigars.accent }}>{data.baz} Baazigars</span>
          </span>
        </div>
        <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mt-3">Rivalry updated · celebrating for 24 hours</p>
      </div>

      <style>{`
        @keyframes clasicoFloat { 0%,100%{ transform: translateY(0) rotate(0deg); } 50%{ transform: translateY(-7px) rotate(25deg); } }
        @keyframes clasicoPop { 0%{ transform: scale(0.7); opacity: 0; } 100%{ transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
