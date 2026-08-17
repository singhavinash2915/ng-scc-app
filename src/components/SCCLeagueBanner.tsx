import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSCCLeague, SQUAD_TARGET, VOTE_UNLOCK_AT } from '../hooks/useSCCLeague';
import { SEASON_NEW } from '../config/season2';

// ─── SCC League registration drive ─────────────────────────────────────────────
// Sits at the top of the Dashboard while the squad is being built. The live
// numbers are the whole point — "12 of 26" pulls people in far harder than a
// generic "register now" ever did.

export function SCCLeagueBanner() {
  const { going, sittingOut, tableMissing, loading } = useSCCLeague(SEASON_NEW);

  if (loading || tableMissing) return null;

  const inCount = going.length;
  const outCount = sittingOut.length;
  const remaining = Math.max(0, SQUAD_TARGET - inCount);
  const pct = Math.min(100, (inCount / SQUAD_TARGET) * 100);
  const full = inCount >= SQUAD_TARGET;
  const votesOpen = inCount >= VOTE_UNLOCK_AT;

  return (
    <Link
      to="/scc-league"
      className="block relative overflow-hidden r-card px-5 py-4 shadow-lg group"
      style={{ background: 'linear-gradient(110deg,#4c1d95,#7c3aed 55%,#db2777)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 r-card bg-white/25 flex items-center justify-center flex-shrink-0 text-xl">
          🔨
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-tight truncate">
            {full ? 'SCC League — squad locked 🔒' : 'SCC League — register for the auction! 🔨'}
          </p>

          {/* The count, big enough to actually register at a glance */}
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-2xl font-extrabold text-white tabular-nums leading-none">
              {inCount}
            </span>
            <span className="text-white/70 text-xs font-bold">of {SQUAD_TARGET} in</span>
            {outCount > 0 && (
              <span className="text-white/50 t-meta font-bold">· {outCount} out</span>
            )}
          </div>

          <div className="mt-1.5 h-1.5 rounded-full bg-white/20 overflow-hidden max-w-[220px]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-white/90 t-meta font-medium mt-1.5">
            {full
              ? 'Captains elected · auction night is next 🔨 Tap to see the pool'
              : votesOpen
                ? `Voting is OPEN · ${remaining} more to fill the squad`
                : `${remaining} more to go · voting unlocks at ${VOTE_UNLOCK_AT}`}
          </p>
        </div>

        <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
