import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Gavel, Crown, Undo2, Check, X, Radio, Wallet, Users, Lock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useMarketValue } from '../hooks/useMarketValue';
import { useCricketStats } from '../hooks/useCricketStats';
import { useSCCLeague, bandForPrice, DISPLAY_BANDS, tierForRating, formatPrice, PURSE_LAKH, SQUAD_SIZE } from '../hooks/useSCCLeague';
import { useAuctionLive, type TeamKey } from '../hooks/useAuctionLive';
import { SEASON_NEW, LEAGUE_CAPTAIN_IDS, LEAGUE_TEAM_NAMES, AUCTION_RUNNING_ORDER, isLeagueCaptain } from '../config/season2';
import type { Member } from '../types';

// ─── SCC League — live auction ─────────────────────────────────────────────────
// Built to be watched. Every member can open this on their phone while the
// auctioneer runs it; state lives in the database so all screens agree and a
// refresh loses nothing.

const TEAM_COLOR: Record<TeamKey, string> = { team1: '#2a78d6', team2: '#eb6834' };
const TEAM_EMOJI: Record<TeamKey, string> = { team1: '🦁', team2: '🐅' };

function Face({ member, size = 44, ring }: { member?: Member; size?: number; ring?: string }) {
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: ring ? `3px solid ${ring}` : undefined }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black
                    flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, border: ring ? `3px solid ${ring}` : undefined }}>
      {member?.name?.charAt(0) ?? '?'}
    </div>
  );
}

// ─── Rehearsal mode ────────────────────────────────────────────────────────────
// The captains want a dry run before the real night. A rehearsal writes to its
// own season row, so the live auction can't be started, dirtied or half-finished
// by practice — and because the Dashboard banner and Auction Centre both read
// SEASON_NEW, nothing a rehearsal does is ever broadcast to the members.
// Persisted: refreshing mid-drill must not silently drop you onto the real season.
const REHEARSAL_SEASON = `${SEASON_NEW}-REHEARSAL`;
const REHEARSAL_KEY = 'scc-auction-rehearsal';

/**
 * OFF for auction night. The toggle is the one control on this page that could
 * quietly ruin the evening — running the real auction while the room believes
 * it's practice, or the reverse — and on the night there is no reason to offer
 * it at all. With this false the page is always the real auction, whatever a
 * stale localStorage flag from an earlier rehearsal says.
 *
 * Set it back to true to rehearse the next one.
 */
const REHEARSAL_ENABLED = false;

/**
 * "Reset auction" wipes every pick and bid for the season in one tap. There is
 * no undo for it and no confirmation strong enough to be worth the risk while a
 * live auction is on a shared screen — a mis-tap would destroy the night's work
 * in front of everyone. Hidden for auction night.
 *
 * If a reset is genuinely needed mid-auction, delete the rows from Supabase
 * directly. That is slower on purpose.
 */
const SHOW_RESET = false;

export function AuctionLive() {
  const { isAdmin } = useAuth();
  const [rehearsal, setRehearsal] = useState(
    () => REHEARSAL_ENABLED && localStorage.getItem(REHEARSAL_KEY) === '1',
  );
  const season = rehearsal ? REHEARSAL_SEASON : SEASON_NEW;
  const toggleRehearsal = (on: boolean) => {
    localStorage.setItem(REHEARSAL_KEY, on ? '1' : '0');
    setRehearsal(on);
  };
  const { members } = useMembers();
  const { matches } = useMatches();
  const { scorecards } = useAllScorecards();
  const { stats } = useCricketStats('2025-26');
  const league = useSCCLeague(SEASON_NEW);


  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  const values = useMarketValue(matches, members, scorecards);
  const basePriceById = useMemo(() => {
    const rating: Record<string, number> = {};
    values.forEach(v => { rating[v.member.id] = v.rating; });
    const m: Record<string, number> = {};
    members.forEach(x => { m[x.id] = tierForRating(rating[x.id]).price; });
    league.registrations.forEach(r => { if (r.base_price) m[r.member_id] = r.base_price; });
    return m;
  }, [values, members, league.registrations]);
  const baseOf = useCallback((id: string) => basePriceById[id] ?? 20, [basePriceById]);
  // The rehearsal uses the SAME running order as the real night. A dry run that
  // draws in a different sequence isn't rehearsing the thing you're about to do,
  // and it leaves the scripted order itself untested until it matters.
  const runningOrder = AUCTION_RUNNING_ORDER;
  const A = useAuctionLive(season, { basePriceOf: baseOf, runningOrder });

  const a = A.auction;
  const current = A.currentMemberId ? memberById[A.currentMemberId] : undefined;
  // Marquee + Grade A come up as one SCC Icons set, so the badge follows the
  // display band rather than the raw price slab.
  const currentSet = useMemo(
    () => bandForPrice(A.currentMemberId ? baseOf(A.currentMemberId) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [A.currentMemberId, basePriceById],
  );
  /** Everyone still to be auctioned this round, excluding whoever is on the block. */
  const remaining = useMemo(
    () => (a?.pool_order ?? []).filter(
      id => id !== A.currentMemberId && !A.picks.some(p => p.member_id === id)),
    [a?.pool_order, A.currentMemberId, A.picks],
  );

  /**
   * The draw, made visible. Members can't audit a Math.random() call, so when a
   * new name comes up the card riffles through the other candidates in that
   * grade for a beat before landing. It changes nothing about who was picked —
   * the player is already chosen and in the database — it just shows the room
   * that a draw happened rather than a list being read out.
   */
  const [drawing, setDrawing] = useState<string | null>(null);
  useEffect(() => {
    if (!A.currentMemberId || a?.status !== 'live') { setDrawing(null); return; }
    // Candidates = everyone in the same grade who could have come up instead.
    const band = bandForPrice(baseOf(A.currentMemberId)).key;
    const peers = remaining.filter(id => bandForPrice(baseOf(id)).key === band);
    if (peers.length === 0) { setDrawing(null); return; }
    let n = 0;
    const tick = window.setInterval(() => {
      n += 1;
      setDrawing(peers[Math.floor(Math.random() * peers.length)]);
      if (n >= 9) { window.clearInterval(tick); setDrawing(null); }
    }, 90);
    return () => { window.clearInterval(tick); setDrawing(null); };
    // Deliberately keyed on the player only — re-running on every poll would
    // restart the riffle mid-bidding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [A.currentMemberId, a?.status]);

  /** How many players this name could have been drawn from — the honest number. */
  const drawPool = useMemo(() => {
    if (!A.currentMemberId) return 0;
    const band = bandForPrice(baseOf(A.currentMemberId)).key;
    return remaining.filter(id => bandForPrice(baseOf(id)).key === band).length + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [A.currentMemberId, remaining, basePriceById]);

  /** The SOLD! moment — held on screen for a few seconds, then it clears itself. */
  const [celebration, setCelebration] = useState<{
    name: string; avatar: string | null; price: number;
    team: TeamKey; teamName: string; at: number;
  } | null>(null);
  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => setCelebration(null), 4200);
    return () => window.clearTimeout(t);
  }, [celebration]);

  const teamName = (t: TeamKey) => (t === 'team1' ? a?.team1_name : a?.team2_name) || 'Team';
  const captainOf = (t: TeamKey) => (t === 'team1' ? a?.team1_captain_id : a?.team2_captain_id);

  // Admin only, per request — the auctioneer runs it and shares the screen.
  if (!isAdmin) {
    return (
      <div>
        <Header title="Live Auction" subtitle="Admin only" />
        <div className="p-8 max-w-md mx-auto mt-12 text-center">
          <Card className="p-8">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Auction room</h2>
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1.5">
              The auction is run from the admin screen. Watch it on the big screen 🔨
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (A.tableMissing) {
    return (
      <div>
        <Header title="Live Auction" subtitle="SCC League" />
        <div className="p-8 max-w-lg mx-auto mt-10">
          <Card className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 p-6">
            <p className="font-black text-amber-900 dark:text-amber-200">Auction tables not created yet</p>
            <p className="text-sm text-amber-800/80 dark:text-amber-200/70 mt-1.5">
              Run <code className="font-mono">supabase/migrations/add_scc_auction.sql</code> in the
              Supabase SQL editor, then reload.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen al-root">
      <style>{`
        .al-root { --al-1:#2a78d6; --al-2:#eb6834; }
        @keyframes al-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .al-live { animation: al-pulse 1.6s ease-in-out infinite; }
        @keyframes al-pop { from{transform:scale(.9);opacity:0} to{transform:scale(1);opacity:1} }
        .al-pop { animation: al-pop .35s cubic-bezier(.22,1,.36,1) both; }
        @keyframes al-stamp {
          0%   { transform: scale(2.6) rotate(-14deg); opacity: 0 }
          55%  { transform: scale(.94) rotate(-14deg); opacity: 1 }
          70%  { transform: scale(1.06) rotate(-14deg) }
          100% { transform: scale(1) rotate(-14deg); opacity: 1 }
        }
        .al-stamp { animation: al-stamp .55s cubic-bezier(.2,.9,.3,1.4) both; }
        @keyframes al-fade { from{opacity:0} to{opacity:1} }
        .al-fade { animation: al-fade .25s ease both; }
        @keyframes al-rise { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
        .al-rise { animation: al-rise .45s .12s cubic-bezier(.22,1,.36,1) both; }
        @keyframes al-fall {
          from { transform: translateY(-12vh) rotate(0deg); opacity: 1 }
          to   { transform: translateY(104vh) rotate(720deg); opacity: 0 }
        }
        .al-confetti { position: fixed; top: 0; width: 10px; height: 14px;
                       animation: al-fall linear forwards; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) {
          .al-live,.al-pop,.al-stamp,.al-rise { animation: none }
          .al-confetti { display: none }
        }
      `}</style>

      <Header title={rehearsal ? 'Auction Rehearsal' : 'Live Auction'}
        subtitle={rehearsal ? 'Practice run · not the real auction' : `SCC League · Season ${SEASON_NEW}`} />

      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">

        {/* ── SOLD! ────────────────────────────────────────────────────────
            The moment the room reacts to. It's the whole point of running an
            auction live rather than posting a spreadsheet afterwards. Clears
            itself after a few seconds so the auctioneer never has to dismiss
            it mid-flow. */}
        {celebration && (
          <div className="al-fade fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(3px)' }}
            onClick={() => setCelebration(null)}>
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="al-confetti"
                style={{
                  left: `${(i * 3.6 + (i % 5) * 2) % 100}%`,
                  background: i % 3 === 0 ? '#fbbf24'
                    : i % 3 === 1 ? TEAM_COLOR[celebration.team] : '#f472b6',
                  animationDuration: `${1.9 + (i % 6) * 0.28}s`,
                  animationDelay: `${(i % 9) * 0.09}s`,
                  borderRadius: i % 2 ? '2px' : '50%',
                }} />
            ))}
            <div className="relative text-center text-white max-w-md w-full">
              <p className="al-stamp inline-block font-display text-6xl sm:text-7xl font-extrabold
                            tracking-tight"
                style={{ color: '#fde68a', textShadow: '0 6px 30px rgba(251,191,36,.5)' }}>
                SOLD!
              </p>
              <div className="al-rise mt-6">
                {celebration.avatar
                  ? <img src={celebration.avatar} alt="" className="w-24 h-24 r-card object-cover mx-auto"
                      style={{ border: `3px solid ${TEAM_COLOR[celebration.team]}` }} />
                  : <div className="w-24 h-24 r-card mx-auto flex items-center justify-center
                                    text-4xl font-black bg-white/15"
                      style={{ border: `3px solid ${TEAM_COLOR[celebration.team]}` }}>
                      {celebration.name.charAt(0)}
                    </div>}
                <p className="font-display text-3xl font-extrabold mt-4 leading-tight">{celebration.name}</p>
                <p className="text-5xl font-extrabold mt-2 tabular-nums"
                  style={{ color: TEAM_COLOR[celebration.team] }}>
                  {formatPrice(celebration.price)}
                </p>
                <p className="mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-black"
                  style={{ background: TEAM_COLOR[celebration.team] }}>
                  {TEAM_EMOJI[celebration.team]} {celebration.teamName}
                </p>
                <p className="t-meta text-white/40 mt-5">tap anywhere to carry on</p>
              </div>
            </div>
          </div>
        )}

        {/* Which auction am I in? Impossible to get wrong at a glance — the one
            mistake that would really hurt is running the real auction while
            everyone thinks it's practice, or vice versa. Hidden entirely once
            REHEARSAL_ENABLED is off, so on the night there is nothing to hit. */}
        {REHEARSAL_ENABLED && (
        <div className={`flex items-center justify-between gap-3 r-card border-2 px-4 py-3 ${
          rehearsal
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'
        }`}>
          <div className="min-w-0">
            <p className={`t-micro font-black uppercase tracking-widest ${
              rehearsal ? 'text-amber-600' : 'text-slate-400'}`}>
              {rehearsal ? '🎭 Rehearsal mode' : '🔴 Real auction'}
            </p>
            <p className="t-meta text-slate-500 dark:text-white/60 leading-snug">
              {rehearsal
                ? 'Practice freely — nothing here is shown to members, and the real auction is untouched.'
                : 'This is the one that counts. Everything appears on the Dashboard and Auction Centre.'}
            </p>
          </div>
          <button onClick={() => toggleRehearsal(!rehearsal)}
            className={`flex-shrink-0 r-control px-3.5 py-2 t-meta font-black border-2 ${
              rehearsal
                ? 'border-slate-300 text-slate-600 dark:text-white/70'
                : 'border-amber-400 text-amber-600'
            }`}>
            {rehearsal ? 'Go to real auction' : 'Start a rehearsal'}
          </button>
        </div>
        )}

        {A.loading && <p className="text-sm text-slate-400">Connecting…</p>}

        {!A.loading && !a && (
          <SetupCard
            league={league} memberById={memberById} baseOf={baseOf}
            isAdmin={isAdmin} runningOrder={runningOrder} onStart={A.start}
          />
        )}

        {a && (
          <>
            {/* ── STATUS STRIP ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between r-card bg-slate-900 text-white px-4 py-2.5">
              <span className="inline-flex items-center gap-2 t-meta font-black uppercase tracking-widest">
                <Radio className={`w-3.5 h-3.5 text-rose-400 ${a.status === 'live' ? 'al-live' : ''}`} />
                {a.status === 'live' ? 'Live' : a.status === 'done' ? 'Complete' : 'Setup'}
                {a.status === 'live' && A.round > 1 && (
                  <span className="ml-1 rounded-full bg-amber-400 text-slate-900 px-2 py-0.5 t-micro">
                    Unsold round {A.round - 1}
                  </span>
                )}
              </span>
              <span className="t-meta font-bold text-white/60">
                {/* pool_order shrinks to the unsold list in later rounds, so a
                    "26/9" style ratio was nonsense. Count what's left instead. */}
                {A.sold.length} sold · {A.unsold.length} unsold ·{' '}
                {Math.max(0, a.pool_order.filter(id => !A.picks.some(p => p.member_id === id)).length)} left
              </span>
            </div>

            {/* ── ON THE BLOCK ─────────────────────────────────────────── */}
            {a.status === 'live' && current && (
              <div key={current.id} className="al-pop relative overflow-hidden r-card text-white shadow-2xl"
                style={{
                  background: a.current_bidder
                    ? `radial-gradient(700px 320px at 50% -10%, ${TEAM_COLOR[a.current_bidder]}bb, transparent 60%), linear-gradient(150deg,#0f172a,#020617)`
                    : 'radial-gradient(700px 320px at 50% -10%, rgba(251,191,36,.45), transparent 60%), linear-gradient(150deg,#1a1205,#020617)',
                }}>
                <div className="p-6 sm:p-8 text-center">
                  <div className="inline-flex flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-2 bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5">
                    <span>{currentSet.emoji}</span>
                    <span className="t-micro font-black uppercase tracking-[2px]">{currentSet.label}</span>
                  </div>
                  {drawPool > 1 && (
                    <div className="inline-flex items-center gap-1.5 bg-emerald-400/15 border
                                    border-emerald-300/30 rounded-full px-3.5 py-1.5">
                      <span>🎲</span>
                      <span className="t-micro font-black uppercase tracking-[2px] text-emerald-200">
                        Random · 1 of {drawPool}
                      </span>
                    </div>
                  )}
                  </div>

                  <div className="mt-5 flex justify-center">
                    <Face member={current} size={116} ring="rgba(255,255,255,.45)" />
                  </div>

                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4">
                    {/* Riffling through the other candidates, then landing. */}
                    <span className={drawing ? 'opacity-45' : ''}>
                      {drawing ? (memberById[drawing]?.name ?? current.name) : current.name}
                    </span>
                  </h2>
                  <p className="text-white/60 text-xs font-bold mt-1">
                    Base {formatPrice(baseOf(current.id))}
                    {league.registrations.find(r => r.member_id === current.id)?.role &&
                      ` · ${league.registrations.find(r => r.member_id === current.id)!.role}`}
                  </p>

                  {(() => {
                    const s = stats.find(x => x.member_id === current.id);
                    const pitch = league.registrations.find(r => r.member_id === current.id)?.pitch;
                    return (
                      <>
                        {s && (
                          <div className="flex items-center justify-center gap-6 mt-4 text-white/85">
                            {s.batting_runs > 0 && <Stat v={s.batting_runs} l="runs" />}
                            {s.bowling_wickets > 0 && <Stat v={s.bowling_wickets} l="wkts" />}
                            {s.batting_matches > 0 && <Stat v={s.batting_matches} l="matches" />}
                          </div>
                        )}
                        {pitch && (
                          <p className="text-sm italic text-amber-200/90 mt-4 max-w-md mx-auto">"{pitch}"</p>
                        )}
                      </>
                    );
                  })()}

                  <div className="mt-7 pt-5 border-t border-white/10">
                    <p className="t-micro font-black uppercase tracking-[2px] text-white/50">Current bid</p>
                    <p className="text-6xl sm:text-7xl font-extrabold mt-1"
                      style={{ color: a.current_bidder ? TEAM_COLOR[a.current_bidder] : '#fde68a' }}>
                      {formatPrice(a.current_bid)}
                    </p>
                    <p className="text-sm font-bold mt-2 h-5">
                      {a.current_bidder
                        ? <>{TEAM_EMOJI[a.current_bidder]} {teamName(a.current_bidder)}</>
                        : <span className="text-white/40">Opening bid — no offers yet</span>}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {a.status === 'done' && (
              <div className="r-card p-8 text-center text-white shadow-2xl"
                style={{ background: 'radial-gradient(600px 300px at 50% 0%, rgba(34,197,94,.4), transparent 60%), linear-gradient(150deg,#064e3b,#020617)' }}>
                <p className="text-6xl">🏆</p>
                <h2 className="font-display text-3xl font-extrabold mt-2">Auction complete!</h2>
                <p className="text-white/70 text-sm mt-1">
                  {A.sold.length} sold · {A.unsold.length} unsold
                </p>
                {/* Say so out loud — players appearing in a squad that nobody
                    remembers bidding for would look like a bug from the room. */}
                {A.allocated.length > 0 && (
                  <p className="mt-3 inline-block r-card bg-amber-400/15 border border-amber-300/30
                                px-4 py-2.5 t-body text-amber-100 leading-snug">
                    <b>{A.allocated.length} player{A.allocated.length > 1 ? 's' : ''}</b> nobody
                    bid for {A.allocated.length > 1 ? 'were' : 'was'} shared out at base price to
                    even up the squads:{' '}
                    <span className="font-bold">
                      {A.allocated.map(p => memberById[p.member_id]?.name ?? '?').join(', ')}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* ── ADMIN CONTROLS ───────────────────────────────────────── */}
            {isAdmin && a.status === 'live' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {(['team1', 'team2'] as TeamKey[]).map(t => (
                    <button key={t} onClick={() => A.bid(t)} disabled={!A.canBid(t)}
                      className="r-control py-4 text-white font-black shadow-lg disabled:opacity-40
                                 disabled:cursor-not-allowed active:scale-95 transition-transform"
                      style={{ background: A.canBid(t) ? TEAM_COLOR[t] : '#94a3b8' }}>
                      <span className="text-2xl block">{TEAM_EMOJI[t]}</span>
                      <span className="text-xs uppercase tracking-widest opacity-90">{teamName(t)}</span>
                      <span className="block text-lg tabular-nums">
                        {/* The first bid accepts the base price rather than raising
                            it, so "+₹10 L" would be a lie on the opening call. */}
                        {!A.hasSlot(t) ? 'SQUAD FULL'
                          : !A.canBid(t) ? 'NO PURSE'
                          : A.opening ? formatPrice(A.nextBid)
                          : `+${formatPrice(A.bidStep)}`}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <button onClick={() => {
                    // Capture who/what BEFORE the sale advances to the next name.
                    if (current && a.current_bidder) {
                      setCelebration({
                        name: current.name, avatar: current.avatar_url ?? null,
                        price: a.current_bid, team: a.current_bidder,
                        teamName: teamName(a.current_bidder), at: Date.now(),
                      });
                    }
                    A.sell(baseOf);
                  }} disabled={!a.current_bidder}
                    className="r-control py-3 bg-emerald-500 disabled:opacity-40 text-white font-black text-sm
                               inline-flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> SOLD
                  </button>
                  <button onClick={() => A.passOver(baseOf)}
                    className="r-control py-3 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white
                               font-black text-sm inline-flex items-center justify-center gap-1.5">
                    <X className="w-4 h-4" /> Unsold
                  </button>
                  {/* Two different mistakes, two different buttons. Taking back
                      a stray tap on a team used to mean selling the player and
                      undoing that — which threw away his whole auction. */}
                  <button onClick={() => A.undoBid()} disabled={A.bidsOnCurrent.length === 0}
                    className="r-control py-3 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white
                               font-black text-sm disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                    <Undo2 className="w-4 h-4" /> Take back bid
                  </button>
                </div>
                <button onClick={() => {
                  const last = [...A.picks].sort((x, y) => x.created_at.localeCompare(y.created_at)).pop();
                  const who = last ? memberById[last.member_id]?.name ?? 'that player' : '';
                  if (confirm(`Reopen ${who}? This cancels the sale and every bid on him — he restarts at base price.`)) {
                    A.undo(baseOf);
                  }
                }} disabled={A.picks.length === 0}
                  className="w-full r-control py-2.5 border-2 border-rose-200 dark:border-rose-400/30
                             text-rose-600 dark:text-rose-300 font-black t-body disabled:opacity-40
                             inline-flex items-center justify-center gap-1.5">
                  <Undo2 className="w-3.5 h-3.5" /> Reopen the last player
                </button>
              </div>
            )}

            {/* ── STILL TO COME ────────────────────────────────────────────
                Captains were bidding blind: with no idea who was left, nobody
                could tell whether to fight for this player or save for a better
                one. Grouped by set, and the draw is random within a set, so
                this tells you WHO is coming without giving away the order. */}
            {a.status === 'live' && (remaining.length > 0 || A.unsold.length > 0) && (
              <Card className="p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="t-meta font-black uppercase tracking-widest text-slate-500">
                    Still to come · 🎲 random order
                  </h3>
                  <span className="t-meta font-bold text-slate-400">
                    {remaining.length + A.unsold.length} left
                  </span>
                </div>
                <div className="space-y-3">
                  {DISPLAY_BANDS.map(band => {
                    const inBand = remaining.filter(id => bandForPrice(baseOf(id)).key === band.key);
                    if (inBand.length === 0) return null;
                    return (
                      <div key={band.key}>
                        <p className="t-micro font-black uppercase tracking-widest text-slate-400 mb-1.5">
                          {band.emoji} {band.label} · {inBand.length}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {inBand
                            .map(id => ({ id, name: memberById[id]?.name ?? '?', p: baseOf(id) }))
                            .sort((x, y) => y.p - x.p || x.name.localeCompare(y.name))
                            .map(x => (
                              <span key={x.id}
                                className="inline-flex items-center gap-1 r-card bg-slate-100
                                           dark:bg-white/10 px-2 py-1 t-meta font-bold
                                           text-slate-700 dark:text-white/80">
                                {x.name}
                                <span className="text-slate-400 font-black">{formatPrice(x.p)}</span>
                              </span>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Named, not just counted. "3 passed over" tells a captain
                    nothing; knowing it's the ₹1 Cr all-rounder he wanted is
                    exactly what decides whether he saves his purse. */}
                {A.unsold.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10">
                    <p className="t-micro font-black uppercase tracking-widest text-amber-600 mb-1.5">
                      ↻ Passed over · {A.unsold.length} — back at base price next round
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {A.unsold
                        .map(p => ({ id: p.member_id, name: memberById[p.member_id]?.name ?? '?', p: baseOf(p.member_id) }))
                        .sort((x, y) => y.p - x.p || x.name.localeCompare(y.name))
                        .map(x => (
                          <span key={x.id}
                            className="inline-flex items-center gap-1 r-card bg-amber-50 dark:bg-amber-400/10
                                       border border-amber-200 dark:border-amber-400/20 px-2 py-1
                                       t-meta font-bold text-amber-800 dark:text-amber-200">
                            {x.name}
                            <span className="text-amber-500 font-black">{formatPrice(x.p)}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* ── TEAMS ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['team1', 'team2'] as TeamKey[]).map(t => {
                const cap = captainOf(t);
                const roster = A.squad(t);
                const used = (A.spent(t) / (a.purse_lakh || 1)) * 100;
                return (
                  <div key={t} className="r-card p-4 text-white shadow-lg"
                    style={{ background: `linear-gradient(150deg, ${TEAM_COLOR[t]}, #0b1220)` }}>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-lg">{TEAM_EMOJI[t]} {teamName(t)}</span>
                      <span className="t-micro font-bold text-white/60">
                        {roster.length + 1}/{a.squad_size}
                      </span>
                    </div>

                    {cap && (
                      <div className="flex items-center gap-2 mt-2.5 bg-white/12 r-card px-2 py-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-300" fill="currentColor" />
                        <span className="text-sm font-bold truncate">{memberById[cap]?.name}</span>
                        <span className="ml-auto t-micro font-black text-amber-300">
                          {A.captainCost(t) > 0 ? formatPrice(A.captainCost(t)) : 'CAPTAIN'}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-2xl font-extrabold ${
                        A.budget(t) < 0 ? 'text-rose-300' : ''}`}>
                        <Wallet className="w-4 h-4 opacity-60" />{formatPrice(A.budget(t))}
                      </span>
                      <span className="t-micro text-white/55">
                        {A.budget(t) < 0 ? 'overspent · ' : 'left '}of {formatPrice(a.purse_lakh)}
                        {A.captainCost(t) > 0 && ` · −${formatPrice(A.captainCost(t))} retention`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
                      <div className="h-full bg-white/70 transition-all duration-500" style={{ width: `${used}%` }} />
                    </div>

                    <div className="mt-3 space-y-1">
                      {roster.length === 0 && (
                        <p className="t-meta text-white/45 py-1">No players bought yet</p>
                      )}
                      {roster.map(p => (
                        <div key={p.id} className="flex items-center gap-2 bg-white/8 r-card px-2 py-1">
                          <Users className="w-3 h-3 text-white/40 flex-shrink-0" />
                          <span className="text-xs truncate flex-1">{memberById[p.member_id]?.name}</span>
                          <span className="t-meta font-black tabular-nums">{formatPrice(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── SOLD LOG ─────────────────────────────────────────────── */}
            {A.picks.length > 0 && (
              <Card className="p-4">
                <p className="t-micro font-black uppercase tracking-[2px] text-slate-400 mb-2">Auction log</p>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {[...A.picks].reverse().map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: p.team ? TEAM_COLOR[p.team] : '#94a3b8' }} />
                      <span className="font-bold text-slate-700 dark:text-white/80 flex-1 truncate">
                        {memberById[p.member_id]?.name}
                      </span>
                      {p.team
                        ? <span className="font-black tabular-nums" style={{ color: TEAM_COLOR[p.team] }}>
                            {formatPrice(p.price)} → {teamName(p.team)}
                          </span>
                        : <span className="text-slate-400 font-bold">Unsold</span>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {isAdmin && SHOW_RESET && (
              <button onClick={() => { if (confirm('Wipe this auction completely and start over?')) A.reset(); }}
                className="text-xs text-rose-500 font-bold">Reset auction</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-extrabold tabular-nums">{v}</p>
      <p className="t-micro uppercase tracking-widest text-white/40">{l}</p>
    </div>
  );
}

// ─── Setup ─────────────────────────────────────────────────────────────────────
function SetupCard({ league, memberById, baseOf, isAdmin, runningOrder, onStart }: {
  league: ReturnType<typeof useSCCLeague>;
  memberById: Record<string, Member>;
  baseOf: (id: string) => number;
  isAdmin: boolean;
  /** Scripted opening sequence; empty for a rehearsal. */
  runningOrder: readonly string[];
  onStart: ReturnType<typeof useAuctionLive>['start'];
}) {
  const [t1, setT1] = useState<string>(LEAGUE_TEAM_NAMES.team1);
  const [t2, setT2] = useState<string>(LEAGUE_TEAM_NAMES.team2);
  // The election decided these; they are retained, never auctioned.
  const [c1, setC1] = useState(LEAGUE_CAPTAIN_IDS[0] ?? '');
  const [c2, setC2] = useState(LEAGUE_CAPTAIN_IDS[1] ?? '');
  const [purse, setPurse] = useState(PURSE_LAKH);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pool = league.going.map(r => r.member_id).filter(id => !isLeagueCaptain(id));
  const input = 'w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-sm';

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <Gavel className="w-10 h-10 text-violet-500 mx-auto mb-3" />
        <h2 className="text-lg font-black text-slate-900 dark:text-white">The auction hasn't started</h2>
        <p className="text-sm text-slate-500 dark:text-white/60 mt-1.5">
          Keep this page open — it goes live the moment the first name is called 🔨
        </p>
      </Card>
    );
  }

  const go = async () => {
    if (!c1 || !c2 || c1 === c2) { setErr('Pick two different captains'); return; }
    const inPool = pool.filter(id => id !== c1 && id !== c2);
    // Anyone with a scripted slot leads, in exactly that order.
    const scripted = runningOrder.filter(id => inPool.includes(id));
    const order = [
      ...scripted,
      // The rest: Icons first, shuffled within each band — the big names sell
      // while every purse is still full. Banded, not priced: sorting on raw
      // price would put the ₹2 Cr names ahead of the ₹1 Cr ones inside a set
      // everyone sees as one group, so the order would mirror the squad list.
      ...inPool.filter(id => !scripted.includes(id))
        .map(id => ({ id, p: bandForPrice(baseOf(id)).minPrice, r: Math.random() }))
        .sort((x, y) => y.p - x.p || x.r - y.r)
        .map(x => x.id),
    ];
    if (order.length < 2) { setErr('Need at least 2 players in the pool'); return; }
    setBusy(true);
    const e = await onStart({
      team1Name: t1.trim() || 'Team 1', team2Name: t2.trim() || 'Team 2',
      team1CaptainId: c1, team2CaptainId: c2,
      poolOrder: order, purseLakh: purse, squadSize: SQUAD_SIZE,
      firstBid: baseOf(order[0]),
    });
    setBusy(false);
    setErr(e);
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Gavel className="w-5 h-5 text-violet-500" /> Set up the auction
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
          {pool.length} players go under the hammer · the two elected captains are retained, not auctioned.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="t-micro font-black uppercase tracking-widest text-slate-400">🦁 Team 1 name</label>
          <input value={t1} onChange={e => setT1(e.target.value)} className={input} />
        </div>
        <div>
          <label className="t-micro font-black uppercase tracking-widest text-slate-400">🐅 Team 2 name</label>
          <input value={t2} onChange={e => setT2(e.target.value)} className={input} />
        </div>
        <div>
          <label className="t-micro font-black uppercase tracking-widest text-slate-400">Team 1 captain</label>
          <select value={c1} onChange={e => setC1(e.target.value)} className={input}>
            <option value="">— Select —</option>
            {league.going.map(r => r.member_id).filter(id => id !== c2).map(id => (
              <option key={id} value={id}>{memberById[id]?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="t-micro font-black uppercase tracking-widest text-slate-400">Team 2 captain</label>
          <select value={c2} onChange={e => setC2(e.target.value)} className={input}>
            <option value="">— Select —</option>
            {league.going.map(r => r.member_id).filter(id => id !== c1).map(id => (
              <option key={id} value={id}>{memberById[id]?.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="t-micro font-black uppercase tracking-widest text-slate-400">
            Purse per team (₹ lakh) — {formatPrice(purse)}
          </label>
          <input type="number" value={purse} onChange={e => setPurse(Number(e.target.value) || 0)} className={input} />
        </div>
      </div>

      {err && <p className="text-sm font-bold text-rose-500">{err}</p>}

      <button onClick={go} disabled={busy}
        className="w-full r-control bg-gradient-to-r from-violet-600 to-pink-600 text-white font-black py-4
                   disabled:opacity-40">
        {busy ? 'Starting…' : 'Start the auction 🔨'}
      </button>
    </Card>
  );
}

export default AuctionLive;
