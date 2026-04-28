import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, TrendingUp, Trophy, AlertCircle, ChevronRight,
  IndianRupee, UserPlus, Swords,
  MessageCircle, Flame, MapPin, Activity, Crown, Zap, Radio,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { CalendarWidget } from '../components/CalendarWidget';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { DashboardPoll } from '../components/DashboardPoll';
import { BirthdayBanner } from '../components/BirthdayBanner';
import { RenewalReminderBanner } from '../components/RenewalReminderBanner';
import { AnnouncementWall } from '../components/AnnouncementWall';
import { useWeather } from '../hooks/useWeather';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useRequests } from '../hooks/useRequests';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useCricketStats } from '../hooks/useCricketStats';
import { usePlayerOfPeriod } from '../hooks/usePlayerOfPeriod';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useMonthSummary } from '../hooks/useMonthSummary';
import { useAuth } from '../context/AuthContext';

// Lazy-loaded heavy components (photos, sponsor data load on-demand)
const DashboardStars = lazy(() => import('../components/DashboardStars'));
const DashboardDeferred = lazy(() => import('../components/DashboardDeferred'));

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return timeLeft;
}

export function Dashboard() {
  // ── Critical data (loads immediately — needed for hero + stats) ────────────
  const { members, loading: membersLoading } = useMembers();
  const { matches, loading: matchesLoading, fetchMatches } = useMatches();
  const { activeCount, isActive } = useMemberActivity(members, matches);
  const { counts: momCounts } = useMOMCounts();
  const monthSummary = useMonthSummary();
  const { stats: cricketStats } = useCricketStats('2025-26');
  const { playerOfMonth, playerOfWeek } = usePlayerOfPeriod(matches, members, cricketStats);
  // If a match was played in the last 7 days, show "of the Week"; else "of the Month"
  const featuredPlayer = playerOfWeek || playerOfMonth;
  const featuredLabel = playerOfWeek ? 'Player of the Week' : 'Player of the Month';
  const { isAdmin } = useAuth();
  const { getPendingCount } = useRequests();
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // ── Deferred sections: mount after hero renders ───────────────────────────
  const [showDeferred, setShowDeferred] = useState(false);
  useEffect(() => {
    if (membersLoading || matchesLoading) return;
    const t = requestAnimationFrame(() => setShowDeferred(true));
    return () => cancelAnimationFrame(t);
  }, [membersLoading, matchesLoading]);

  const stats = useMemo(() => {
    const totalFunds = members.reduce((sum, m) => sum + m.balance, 0);
    const ext = matches.filter(m => m.match_type !== 'internal');
    const completed = ext.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completed.filter(m => m.result === 'won').length;
    const lost = completed.filter(m => m.result === 'lost').length;
    const winRate = completed.length > 0 ? (won / completed.length) * 100 : 0;
    return { totalMembers: members.length, activeMembers: activeCount, totalFunds, matchesPlayed: completed.length, won, lost, winRate, pendingRequests: getPendingCount() };
  }, [members, matches, getPendingCount, activeCount]);

  const recentMatches = useMemo(() =>
    matches.filter(m => ['won', 'lost', 'draw'].includes(m.result)).slice(0, 5),
  [matches]);
  const allLowBalanceMembers = useMemo(() => members.filter(m => isActive(m.id) && m.balance < 1000), [members, isActive]);
  const lowBalanceMembers = useMemo(() => allLowBalanceMembers.slice(0, 5), [allLowBalanceMembers]);

  const latestWonMatch = useMemo(() => matches.find(m => m.result === 'won' && m.man_of_match), [matches]);
  const showManOfMatch = useMemo(() => {
    if (!latestWonMatch?.man_of_match) return null;
    const idx = matches.findIndex(m => m.id === latestWonMatch.id);
    const newer = matches.slice(0, idx).find(m => ['won', 'lost', 'draw'].includes(m.result));
    return newer ? null : latestWonMatch;
  }, [matches, latestWonMatch]);

  const nextUpcomingMatch = useMemo(() => {
    const upcoming = matches.filter(m => m.result === 'upcoming');
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] ?? null;
  }, [matches]);

  const lastFiveResults = useMemo(() =>
    matches.filter(m => m.match_type !== 'internal' && ['won', 'lost', 'draw'].includes(m.result)).slice(0, 5),
  [matches]);

  const streak = useMemo(() => {
    if (!lastFiveResults.length) return null;
    const first = lastFiveResults[0].result;
    let count = 0;
    for (const m of lastFiveResults) { if (m.result === first) count++; else break; }
    return { result: first, count };
  }, [lastFiveResults]);

  const internalMatchStats = useMemo(() => {
    const int = matches.filter(m => m.match_type === 'internal');
    const completed = int.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    return {
      total: completed.length,
      dhurandarsWins: completed.filter(m => m.winning_team === 'dhurandars').length,
      bazigarsWins: completed.filter(m => m.winning_team === 'bazigars').length,
      draws: completed.filter(m => m.result === 'draw').length,
    };
  }, [matches]);

  const avgBalance = useMemo(() => {
    const active = members.filter(m => isActive(m.id));
    return active.length ? Math.round(active.reduce((s, m) => s + m.balance, 0) / active.length) : 0;
  }, [members, isActive]);

  // Top 5 MOM winners this season (joined with member profile for avatars)
  const topMOMs = useMemo(() => {
    const entries = Object.entries(momCounts)
      .map(([memberId, count]) => ({
        member: members.find(m => m.id === memberId),
        count,
      }))
      .filter(e => e.member)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return entries;
  }, [momCounts, members]);

  // Most recent completed match (for "Last Match" card)
  const lastCompletedMatch = useMemo(() => {
    return matches.find(m =>
      ['won', 'lost', 'draw'].includes(m.result) && m.match_type !== 'internal'
    );
  }, [matches]);


  // Live ticker items
  const tickerItems = useMemo(() => {
    const items: string[] = [];
    if (nextUpcomingMatch) {
      const d = new Date(nextUpcomingMatch.date);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      const when = days <= 0 ? 'TODAY' : days === 1 ? 'tomorrow' : `in ${days} days`;
      items.push(`⚡ Next: vs ${nextUpcomingMatch.opponent || 'TBD'} ${when}`);
    }
    if (topMOMs.length > 0) {
      items.push(`${topMOMs[0].member!.name} leads MOM race (${topMOMs[0].count})`);
    }
    if (streak && streak.count >= 2) {
      items.push(`${streak.count}-match ${streak.result === 'won' ? 'win streak 🔥' : 'run'}`);
    }
    if (lastCompletedMatch?.result === 'won') {
      items.push(`Last match: WON vs ${lastCompletedMatch.opponent}`);
    }
    return items;
  }, [nextUpcomingMatch, topMOMs, streak, lastCompletedMatch]);

  const countdown = useCountdown(nextUpcomingMatch ? nextUpcomingMatch.date : null);
  const { forecast: matchWeather } = useWeather(nextUpcomingMatch?.date || null);

  const animatedMembers = useAnimatedValue(stats.activeMembers, 800);
  const animatedFunds = useAnimatedValue(stats.totalFunds, 1200);
  const animatedWinRate = useAnimatedValue(Math.round(stats.winRate), 1000);
  const animatedWon = useAnimatedValue(stats.won, 800);
  const animatedLost = useAnimatedValue(stats.lost, 800);
  const animatedDhurandarsWins = useAnimatedValue(internalMatchStats.dhurandarsWins, 800);
  const animatedBazigarsWins = useAnimatedValue(internalMatchStats.bazigarsWins, 800);

  const loading = membersLoading || matchesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-950 to-teal-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-green-300/20 border-t-green-400 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🏏</div>
          </div>
          <p className="text-green-300/60 text-xs font-semibold uppercase tracking-widest animate-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Header title="Dashboard" subtitle="Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-5">

        {/* ── BIRTHDAY BANNER (only on someone's birthday) ───────────── */}
        <BirthdayBanner members={members} />

        {/* ── RENEWAL REMINDER (only when memberships are expiring) ──── */}
        <RenewalReminderBanner members={members} />

        {/* ── LIVE TICKER ──────────────────────────── */}
        {tickerItems.length > 0 && (
          <div className="flex items-center gap-4 overflow-x-auto py-2.5 px-4 bg-gray-900/80 dark:bg-gray-900 border border-gray-200/10 dark:border-gray-800 rounded-xl backdrop-blur-sm">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-md flex-shrink-0">
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </span>
            <div className="flex items-center gap-8 text-sm text-gray-300 whitespace-nowrap">
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-gray-500/40" />}
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── CLUB IDENTITY ROW ─────────────────────── */}
        <div className="flex items-center gap-3">
          <img src="/scc-logo.jpg" alt="SCC" className="w-11 h-11 rounded-xl shadow-lg object-cover flex-shrink-0" />
          <div>
            <h1 className="text-lg lg:text-xl font-black text-gray-900 dark:text-white leading-tight">Sangria Cricket Club</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="px-2 py-0.5 bg-primary-500/10 dark:bg-primary-400/20 border border-primary-500/30 text-primary-700 dark:text-primary-300 text-[10px] font-bold rounded-full uppercase tracking-wide">Season 2025–26</span>
              <span className="text-gray-400 dark:text-gray-500 text-[11px]">{stats.matchesPlayed} matches · {stats.activeMembers} active</span>
            </div>
          </div>
        </div>

        {/* ── ANNOUNCEMENT WALL (pinned at top) ───── */}
        <AnnouncementWall />

        {/* ── BENTO GRID ────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 auto-rows-[minmax(120px,auto)]">

          {/* FEATURED — Next Match (4x2 on lg, full width on mobile) */}
          <div className="col-span-2 lg:col-span-4 lg:row-span-2 relative overflow-hidden rounded-2xl p-6 lg:p-7 shadow-2xl"
               style={{
                 background: 'radial-gradient(800px circle at 0% 0%, rgba(16,185,129,0.35), transparent 50%), radial-gradient(600px circle at 100% 100%, rgba(20,184,166,0.25), transparent 60%), linear-gradient(180deg, #061122, #0a1019)',
               }}>
            <div className="absolute inset-0 border border-emerald-500/25 rounded-2xl pointer-events-none" />
            {nextUpcomingMatch ? (
              <>
                <div className="flex items-center gap-2 mb-3 relative">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-[2px]">Next Match</span>
                  {nextUpcomingMatch.match_type === 'internal' && (
                    <span className="bg-yellow-400/20 text-yellow-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-yellow-400/30">INTERNAL</span>
                  )}
                </div>
                <h2 className="text-white text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] relative">
                  {nextUpcomingMatch.match_type === 'internal'
                    ? <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">{nextUpcomingMatch.opponent || 'Internal Match'}</span>
                    : <>vs <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">{nextUpcomingMatch.opponent || 'TBD'}</span></>
                  }
                </h2>
                <div className="flex items-center gap-4 text-gray-400 text-xs mt-3 flex-wrap relative">
                  {nextUpcomingMatch.venue && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextUpcomingMatch.venue}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                    {new Date(nextUpcomingMatch.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {matchWeather && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-white"
                          title={`${matchWeather.label} · ${matchWeather.precipitation}% rain probability`}>
                      <span>{matchWeather.emoji}</span>
                      <span className="font-semibold tabular-nums">{matchWeather.tempMax}°/{matchWeather.tempMin}°</span>
                      {matchWeather.precipitation >= 30 && (
                        <span className="text-blue-300 text-[10px] font-bold">· {matchWeather.precipitation}% rain</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-5 relative">
                  {[{ v: countdown.days, l: 'Days' }, { v: countdown.hours, l: 'Hrs' }, { v: countdown.mins, l: 'Min' }, { v: countdown.secs, l: 'Sec' }].map(({ v, l }) => (
                    <div key={l} className="flex flex-col items-center bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2.5 min-w-[56px] border border-white/8">
                      <span className="text-xl lg:text-2xl font-black text-white tabular-nums leading-none">{String(v).padStart(2, '0')}</span>
                      <span className="text-gray-500 text-[9px] font-semibold uppercase tracking-[1.5px] mt-1">{l}</span>
                    </div>
                  ))}
                </div>

                {/* Last MOM pinned to the bottom */}
                {showManOfMatch?.man_of_match && (
                  <div className="relative mt-6 pt-5 border-t border-white/8 flex items-center gap-3">
                    {showManOfMatch.man_of_match.avatar_url ? (
                      <img src={showManOfMatch.man_of_match.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-yellow-400/40" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center">
                        <span className="text-sm font-black text-yellow-200">{showManOfMatch.man_of_match.name?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-yellow-400 text-[9px] font-bold uppercase tracking-[1.5px]">⭐ Last Man of the Match</p>
                      <h3 className="text-sm font-black text-white truncate">{showManOfMatch.man_of_match.name}
                        <span className="text-gray-400 font-semibold ml-2">vs {showManOfMatch.opponent}</span>
                      </h3>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-8 flex-wrap relative">
                {[{ v: stats.matchesPlayed, l: 'Matches', c: 'text-white' }, { v: stats.won, l: 'Won', c: 'text-emerald-400' }, { v: stats.lost, l: 'Lost', c: 'text-red-400' }, { v: `${Math.round(stats.winRate)}%`, l: 'Win Rate', c: 'text-amber-400' }].map(({ v, l, c }) => (
                  <div key={l} className="text-center">
                    <div className={`text-4xl font-black tabular-nums ${c}`}>{v}</div>
                    <div className="text-gray-500 text-xs mt-0.5 uppercase tracking-wider">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members (2x1) */}
          <div className="col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5"
               style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)' }}>
            <div className="absolute inset-0 border border-blue-500/25 rounded-2xl pointer-events-none" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Members</span>
            </div>
            <p className="text-4xl lg:text-5xl font-black text-white tabular-nums relative leading-none">{animatedMembers}</p>
            <p className="text-gray-400 text-[11px] mt-2 relative">of {stats.totalMembers} · <span className="text-blue-300">active</span></p>
          </div>

          {/* Club Funds (2x1) */}
          <div className="col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5"
               style={{ background: 'linear-gradient(135deg, #065f46 0%, #0a1019 100%)' }}>
            <div className="absolute inset-0 border border-emerald-500/25 rounded-2xl pointer-events-none" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Club Funds</span>
            </div>
            <p className="text-4xl lg:text-5xl font-black text-white tabular-nums relative leading-none">
              ₹{animatedFunds >= 1000 ? `${(animatedFunds / 1000).toFixed(1)}k` : animatedFunds.toLocaleString('en-IN')}
            </p>
            {/* Season growth trend pill */}
            {(() => {
              const seasonNet = monthSummary.seasonDeposits - monthSummary.seasonExpenses;
              const starting = stats.totalFunds - seasonNet;
              const pct = starting > 0 ? Math.round((seasonNet / starting) * 100) : 0;
              if (seasonNet === 0 || monthSummary.loading) {
                return <p className="text-gray-400 text-[11px] mt-2 relative">Avg ₹{avgBalance >= 1000 ? `${(avgBalance / 1000).toFixed(1)}k` : avgBalance} / member</p>;
              }
              const up = seasonNet > 0;
              return (
                <div className="relative mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    up ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                       : 'bg-red-500/15 text-red-300 border border-red-500/30'
                  }`}>
                    {up ? '↑' : '↓'} {Math.abs(pct)}%
                    <span className="opacity-70 font-semibold">this season</span>
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Win Rate Donut (2x2) */}
          <div className="col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden rounded-2xl p-5"
               style={{ background: 'linear-gradient(135deg, #9a3412 0%, #0a1019 100%)' }}>
            <div className="absolute inset-0 border border-orange-500/25 rounded-2xl pointer-events-none" />
            <div className="flex items-center gap-1.5 mb-3 relative">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Win Rate</span>
            </div>
            <div className="flex items-center gap-5 relative">
              <svg width="110" height="110" viewBox="0 0 42 42" className="flex-shrink-0">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                  strokeDasharray={`${stats.winRate} 100`} transform="rotate(-90 21 21)" strokeLinecap="round" />
                <text x="21" y="23.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">{animatedWinRate}%</text>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex gap-4">
                  <div>
                    <div className="text-2xl font-black text-emerald-400 tabular-nums">{animatedWon}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Won</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-red-400 tabular-nums">{animatedLost}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Lost</div>
                  </div>
                </div>
                {lastFiveResults.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">Last 5</div>
                    <div className="flex gap-1.5">
                      {lastFiveResults.map(m => (
                        <div key={m.id}
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white shadow-md ${
                            m.result === 'won' ? 'bg-gradient-to-br from-green-400 to-green-600' :
                            m.result === 'lost' ? 'bg-gradient-to-br from-red-400 to-red-600' :
                            'bg-gradient-to-br from-amber-400 to-amber-600'
                          }`}>
                          {m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'D'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {streak && streak.count >= 2 && (
              <div className={`inline-flex items-center gap-1 mt-4 px-2.5 py-1 rounded-full text-[10px] font-bold relative ${
                streak.result === 'won' ? 'bg-green-500/15 text-green-300 border border-green-500/30' :
                streak.result === 'lost' ? 'bg-red-500/15 text-red-300 border border-red-500/30' :
                'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {streak.result === 'won' ? <Flame className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {streak.count}-match {streak.result === 'won' ? 'win streak 🔥' : streak.result === 'lost' ? 'tough run' : 'draw streak'}
              </div>
            )}
          </div>

          {/* MOM Race Leaderboard (2x2) */}
          {topMOMs.length > 0 && (
            <div className="col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden rounded-2xl p-5"
                 style={{ background: 'linear-gradient(135deg, #854d0e 0%, #0a1019 100%)' }}>
              <div className="absolute inset-0 border border-yellow-500/25 rounded-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3 relative">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
                  <span className="text-amber-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">MOM Race</span>
                </div>
                <Link to="/leaderboard" className="text-[10px] text-amber-300/60 hover:text-amber-300 font-semibold">All →</Link>
              </div>
              <div className="space-y-1 relative">
                {topMOMs.map((entry, idx) => (
                  <div key={entry.member!.id} className="flex items-center gap-2.5 py-1.5 border-t border-white/6 first:border-0">
                    <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-black ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-yellow-950 shadow-lg shadow-amber-500/30' :
                      idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-orange-950' :
                      'bg-white/5 text-gray-400'
                    }`}>{idx + 1}</div>
                    {entry.member!.avatar_url ? (
                      <img src={entry.member!.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-yellow-950">{entry.member!.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-xs font-semibold text-white truncate flex-1">{entry.member!.name.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="flex items-center gap-0.5 text-amber-300 text-xs font-black tabular-nums">
                      {entry.count}
                      {idx === 0 && <span className="text-[10px]">🏆</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player of the Month / Week (2x1) */}
          {featuredPlayer && (
            <div className="col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5"
                 style={{ background: 'radial-gradient(300px circle at 0% 0%, rgba(244,114,182,0.25), transparent 55%), linear-gradient(135deg, #831843 0%, #1a0510 55%, #0a1019 100%)' }}>
              <div className="absolute inset-0 border border-pink-500/30 rounded-2xl pointer-events-none" />
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-pink-400/15 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2 relative">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-pink-300" fill="currentColor" />
                  <span className="text-pink-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">{featuredLabel}</span>
                </div>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-400/15 border border-pink-400/30 text-pink-200 text-[10px] font-black">
                  <Crown className="w-2.5 h-2.5" fill="currentColor" />
                  {featuredPlayer.moms} MOM{featuredPlayer.moms > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 relative">
                {featuredPlayer.member.avatar_url ? (
                  <img src={featuredPlayer.member.avatar_url} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-pink-400/40 shadow-lg shadow-pink-500/30 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 border-2 border-pink-400/40 flex items-center justify-center flex-shrink-0 shadow-lg shadow-pink-500/30">
                    <span className="text-xl font-black text-pink-950">{featuredPlayer.member.name.charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-black text-white truncate leading-tight">{featuredPlayer.member.name}</div>
                  <div className="text-[10px] text-pink-200/60 mt-0.5 font-semibold">{featuredPlayer.periodLabel}</div>
                  {featuredPlayer.tieBroken && (
                    <div className="text-[9px] text-pink-300/40 mt-0.5">tie-broken by season MVP score</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* This Month (2x1) */}
          <div className="col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5"
               style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0a1019 100%)' }}>
            <div className="absolute inset-0 border border-emerald-500/25 rounded-2xl pointer-events-none" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">This Month</span>
            </div>
            <p className="text-3xl lg:text-4xl font-black text-white tabular-nums relative leading-none">
              <span className={monthSummary.deposits - monthSummary.expenses >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {monthSummary.deposits - monthSummary.expenses >= 0 ? '+' : '−'}₹{Math.abs(monthSummary.deposits - monthSummary.expenses).toLocaleString('en-IN')}
              </span>
            </p>
            <p className="text-gray-400 text-[11px] mt-2 relative">
              <span className="text-emerald-400">₹{monthSummary.deposits.toLocaleString('en-IN')} in</span>
              <span className="mx-1.5 text-gray-600">·</span>
              <span className="text-red-400">₹{monthSummary.expenses.toLocaleString('en-IN')} out</span>
            </p>
          </div>

          {/* Last Match (full-width banner) */}
          {lastCompletedMatch && (
            <div className="col-span-2 lg:col-span-6 relative overflow-hidden rounded-2xl p-4 lg:p-5"
                 style={{ background: lastCompletedMatch.result === 'won'
                   ? 'linear-gradient(135deg, #065f46 0%, #0a1019 100%)'
                   : lastCompletedMatch.result === 'lost'
                   ? 'linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)'
                   : 'linear-gradient(135deg, #854d0e 0%, #0a1019 100%)'
                 }}>
              <div className={`absolute inset-0 rounded-2xl pointer-events-none border ${
                lastCompletedMatch.result === 'won' ? 'border-emerald-500/25'
                : lastCompletedMatch.result === 'lost' ? 'border-red-500/25'
                : 'border-amber-500/25'
              }`} />
              <div className="flex items-center gap-1.5 mb-2 relative">
                <Zap className={`w-3.5 h-3.5 ${
                  lastCompletedMatch.result === 'won' ? 'text-emerald-400'
                  : lastCompletedMatch.result === 'lost' ? 'text-red-400'
                  : 'text-amber-400'
                }`} />
                <span className={`text-[10px] font-bold uppercase tracking-[1.5px] ${
                  lastCompletedMatch.result === 'won' ? 'text-emerald-300/80'
                  : lastCompletedMatch.result === 'lost' ? 'text-red-300/80'
                  : 'text-amber-300/80'
                }`}>Last Match · {lastCompletedMatch.result.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-3 relative">
                {lastCompletedMatch.man_of_match?.avatar_url ? (
                  <img src={lastCompletedMatch.man_of_match.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover border border-yellow-400/40 flex-shrink-0" />
                ) : lastCompletedMatch.man_of_match ? (
                  <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-yellow-200">{lastCompletedMatch.man_of_match.name.charAt(0)}</span>
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  {lastCompletedMatch.our_score && lastCompletedMatch.opponent_score ? (
                    <div className="text-lg font-black text-white tabular-nums leading-tight">
                      {lastCompletedMatch.our_score}
                      <span className="text-gray-500 font-bold text-sm mx-1.5">vs</span>
                      {lastCompletedMatch.opponent_score}
                    </div>
                  ) : (
                    <div className="text-base font-black text-white">vs {lastCompletedMatch.opponent}</div>
                  )}
                  <p className="text-gray-400 text-[11px] mt-0.5 truncate">
                    vs {lastCompletedMatch.opponent}
                    {lastCompletedMatch.man_of_match && (
                      <> · <span className="text-yellow-300">MOM: {lastCompletedMatch.man_of_match.name.split(' ')[0]}</span></>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SEASON STARS (lazy — loads cricketStats on demand) ────────── */}
        {showDeferred && (
          <Suspense fallback={null}>
            <DashboardStars momCounts={momCounts} />
          </Suspense>
        )}

        {/* ── SQUAD POLL ──────────────────────────── */}
        <DashboardPoll matches={matches} members={members} onMatchUpdate={fetchMatches} />

        {/* ── INTERNAL BATTLE ─────────────────────── */}
        {internalMatchStats.total > 0 && (
          <div className="relative overflow-hidden rounded-2xl shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-slate-900 to-purple-900" />
            <div className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='20' x2='40' y2='20' stroke='white' stroke-width='0.5'/%3E%3Cline x1='20' y1='0' x2='20' y2='40' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: '40px 40px',
            }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/5" />
            <div className="relative p-5 lg:p-6">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-5 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Internal Battle · {internalMatchStats.total} matches played
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/40 mb-3">
                    <span className="text-3xl lg:text-4xl font-black text-white tabular-nums">{animatedDhurandarsWins}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">Dhurandars</h4>
                  <p className="text-blue-300/50 text-xs">wins</p>
                  {internalMatchStats.dhurandarsWins > internalMatchStats.bazigarsWins && (
                    <p className="text-yellow-400 text-xs mt-1">👑 Leading</p>
                  )}
                </div>
                <div className="text-center flex-shrink-0 px-2">
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                    <span className="text-white font-black text-sm">VS</span>
                  </div>
                  {internalMatchStats.draws > 0 && (
                    <p className="text-amber-400/70 text-[10px] mt-1">{internalMatchStats.draws} draw{internalMatchStats.draws > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/40 mb-3">
                    <span className="text-3xl lg:text-4xl font-black text-white tabular-nums">{animatedBazigarsWins}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">Bazigars</h4>
                  <p className="text-purple-300/50 text-xs">wins</p>
                  {internalMatchStats.bazigarsWins > internalMatchStats.dhurandarsWins && (
                    <p className="text-yellow-400 text-xs mt-1">👑 Leading</p>
                  )}
                </div>
              </div>
              <div className="mt-5 h-2 bg-white/10 rounded-full overflow-hidden flex">
                {internalMatchStats.dhurandarsWins > 0 && (
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-1000 rounded-l-full"
                    style={{ width: `${(internalMatchStats.dhurandarsWins / internalMatchStats.total) * 100}%` }} />
                )}
                {internalMatchStats.draws > 0 && (
                  <div className="h-full bg-amber-400 transition-all duration-1000"
                    style={{ width: `${(internalMatchStats.draws / internalMatchStats.total) * 100}%` }} />
                )}
                {internalMatchStats.bazigarsWins > 0 && (
                  <div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-1000 rounded-r-full"
                    style={{ width: `${(internalMatchStats.bazigarsWins / internalMatchStats.total) * 100}%` }} />
                )}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-blue-400/60 text-[10px] font-medium">Dhurandars</span>
                <span className="text-purple-400/60 text-[10px] font-medium">Bazigars</span>
              </div>
            </div>
          </div>
        )}

        {/* ── RECENT MATCHES + LOW BALANCE ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card delay={400}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-primary-500" />
                Recent Matches
              </h3>
              <Link to="/matches" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold group">
                View all <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <CardContent className="p-0">
              {recentMatches.length === 0 ? (
                <p className="p-6 text-center text-gray-400 text-sm">No matches yet</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {recentMatches.map(match => (
                    <div key={match.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                        match.result === 'won' ? 'bg-green-500' :
                        match.result === 'lost' ? 'bg-red-500' :
                        match.result === 'draw' ? 'bg-amber-500' : 'bg-gray-400'
                      }`}>
                        {match.result === 'upcoming' ? '⏳' : match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">vs {match.opponent || 'TBD'}</p>
                        <p className="text-[11px] text-gray-400 truncate">{match.venue} · {new Date(match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      {match.our_score && (
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">{match.our_score}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card delay={450}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                Low Balance Alert
                {allLowBalanceMembers.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{allLowBalanceMembers.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {isAdmin && allLowBalanceMembers.length > 0 && (
                  <button onClick={() => setShowWhatsAppModal(true)} className="text-green-600 hover:text-green-700 dark:text-green-400 transition-colors" title="WhatsApp Reminders">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                <Link to="/members" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold group">
                  View all <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
            <CardContent className="p-0">
              {lowBalanceMembers.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-500">All members have sufficient balance 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {lowBalanceMembers.map(member => (
                    <div key={member.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{member.name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="font-medium text-gray-900 dark:text-white text-sm flex-1 truncate">{member.name}</p>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        member.balance < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        ₹{member.balance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── PHOTO GALLERY (lazy) ─────────────────── */}
        {showDeferred && (
          <Suspense fallback={null}>
            <DashboardDeferred section="photos" />
          </Suspense>
        )}

        {/* ── CALENDAR ────────────────────────────── */}
        <CalendarWidget matches={matches} />

        {/* ── JOIN CLUB BANNER ────────────────────── */}
        <Link to="/requests">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 shadow-lg group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            <div className="relative flex items-center gap-4 p-4 lg:p-5">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm flex-shrink-0">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-white min-w-0">
                <h3 className="font-bold text-sm lg:text-base">Want to Join Sangria Cricket Club?</h3>
                <p className="text-primary-100 text-xs mt-0.5">Submit your membership request — we'd love to have you!</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </div>
          </div>
        </Link>

        {/* ── SPONSOR (always at bottom) ─────────── */}
        {showDeferred && (
          <Suspense fallback={null}>
            <DashboardDeferred section="sponsor" />
          </Suspense>
        )}

      </div>

      <WhatsAppRemindersModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        members={allLowBalanceMembers}
        threshold={1000}
      />
    </div>
  );
}
