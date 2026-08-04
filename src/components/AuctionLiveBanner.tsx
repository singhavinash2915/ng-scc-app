import { useCallback, useMemo } from 'react';
import { Radio, Crown, Gavel, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMembers } from '../hooks/useMembers';
import { useSCCLeague, formatPrice } from '../hooks/useSCCLeague';
import { useAuctionLive, type TeamKey } from '../hooks/useAuctionLive';
import { SEASON_NEW } from '../config/season2';
import type { Member } from '../types';

// ─── Dashboard: the auction, live ──────────────────────────────────────────────
// Read-only window onto the auction for everyone who isn't running it. The
// control room stays admin-only; this is the broadcast. Appears by itself when
// the auction goes live and disappears again a while after it finishes.

const TEAM_COLOR: Record<TeamKey, string> = { team1: '#60a5fa', team2: '#fb923c' };
const TEAM_EMOJI: Record<TeamKey, string> = { team1: '🦁', team2: '🐅' };

export function AuctionLiveBanner() {
  const { members } = useMembers();
  const league = useSCCLeague(SEASON_NEW);
  // Base prices come from the league grades; the hook needs them to deduct
  // each captain's retention from their own purse.
  const baseOf = useCallback(
    (id: string) => league.registrations.find(r => r.member_id === id)?.base_price ?? 20,
    [league.registrations],
  );
  const A = useAuctionLive(SEASON_NEW, { basePriceOf: baseOf });

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  const a = A.auction;
  if (A.loading || A.tableMissing || !a) return null;
  if (a.status === 'setup') return null;

  const current = A.currentMemberId ? memberById[A.currentMemberId] : undefined;
  const reg = league.registrations.find(r => r.member_id === A.currentMemberId);
  const name = (t: TeamKey) => (t === 'team1' ? a.team1_name : a.team2_name) || 'Team';
  const captain = (t: TeamKey) => (t === 'team1' ? a.team1_captain_id : a.team2_captain_id);
  const done = a.status === 'done';

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-2xl text-white alb-root"
      style={{
        background: done
          ? 'radial-gradient(700px 300px at 50% -10%, rgba(34,197,94,.35), transparent 60%), linear-gradient(150deg,#064e3b,#020617)'
          : a.current_bidder
            ? `radial-gradient(700px 300px at 50% -10%, ${TEAM_COLOR[a.current_bidder]}88, transparent 60%), linear-gradient(150deg,#0f172a,#020617)`
            : 'radial-gradient(700px 300px at 50% -10%, rgba(251,191,36,.35), transparent 60%), linear-gradient(150deg,#1a1205,#020617)',
      }}>
      <style>{`
        @keyframes alb-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .alb-live { animation: alb-pulse 1.5s ease-in-out infinite; }
        @keyframes alb-pop { from{transform:scale(.94);opacity:0} to{transform:scale(1);opacity:1} }
        .alb-pop { animation: alb-pop .4s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce){ .alb-live,.alb-pop{animation:none} }
      `}</style>

      <div className="px-5 py-4">
        {/* header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[2px]">
            <Radio className={`w-3.5 h-3.5 text-rose-400 ${done ? '' : 'alb-live'}`} />
            {done ? 'Auction complete' : 'SCC League auction · live'}
          </span>
          <span className="text-[10px] font-bold text-white/50">
            {A.sold.length} sold{A.round > 1 && !done ? ` · unsold round ${A.round - 1}` : ''}
          </span>
        </div>

        {/* on the block */}
        {!done && current && (
          <div key={current.id} className="alb-pop flex items-center gap-4 mt-4">
            {current.avatar_url ? (
              <img src={current.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                style={{ border: '2px solid rgba(255,255,255,.35)' }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center
                              text-2xl font-black flex-shrink-0">
                {current.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[2px] text-amber-300/80">On the block</p>
              <p className="font-display text-xl font-extrabold leading-tight truncate">{current.name}</p>
              <p className="text-[10px] text-white/50">
                Base {formatPrice(reg?.base_price ?? 20)}{reg?.role ? ` · ${reg.role}` : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-extrabold leading-none"
                style={{ color: a.current_bidder ? TEAM_COLOR[a.current_bidder] : '#fde68a' }}>
                {formatPrice(a.current_bid)}
              </p>
              <p className="text-[10px] font-bold text-white/60 mt-0.5 h-4">
                {a.current_bidder ? `${TEAM_EMOJI[a.current_bidder]} ${name(a.current_bidder)}` : 'no bids yet'}
              </p>
            </div>
          </div>
        )}

        {done && (
          <p className="text-center font-display text-xl font-extrabold mt-3">
            🏆 Squads are set — {A.sold.length} players sold
          </p>
        )}

        {/* both teams */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {(['team1', 'team2'] as TeamKey[]).map(t => (
            <div key={t} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5">
              <p className="text-[11px] font-black truncate" style={{ color: TEAM_COLOR[t] }}>
                {TEAM_EMOJI[t]} {name(t)}
              </p>
              <p className="text-[10px] text-white/55 truncate inline-flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" fill="currentColor" />
                {memberById[captain(t) ?? '']?.name?.split(' ')[0] ?? '—'}
              </p>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-base font-extrabold">{formatPrice(A.budget(t))}</span>
                <span className="text-[10px] text-white/50">
                  {A.squad(t).length + 1}/{a.squad_size}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Link to="/auction-centre"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/15
                     border border-white/20 py-2 text-[11px] font-black">
          Open the Auction Centre <ChevronRight className="w-3.5 h-3.5" />
        </Link>

        {/* last few sales — the bit everyone talks about */}
        {A.sold.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
            {[...A.sold].slice(-3).reverse().map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[11px]">
                <Gavel className="w-3 h-3 text-white/35 flex-shrink-0" />
                <span className="truncate flex-1 text-white/80">
                  {memberById[p.member_id]?.name ?? '?'}
                </span>
                <span className="font-black" style={{ color: TEAM_COLOR[p.team as TeamKey] }}>
                  {formatPrice(p.price)} → {name(p.team as TeamKey)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
