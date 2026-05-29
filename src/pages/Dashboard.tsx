import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, TrendingUp, Trophy, AlertCircle, ChevronRight,
  IndianRupee, UserPlus, Swords,
  MessageCircle, Flame, MapPin, Activity, Crown, Radio, Target,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { CalendarWidget } from '../components/CalendarWidget';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { DashboardPoll } from '../components/DashboardPoll';
import { MyStatsButton } from '../components/MyStatsButton';
import { BirthdayBanner } from '../components/BirthdayBanner';
import { RenewalReminderBanner } from '../components/RenewalReminderBanner';
import { AnnouncementWall } from '../components/AnnouncementWall';
import { useWeather } from '../hooks/useWeather';
import { useLiveScore } from '../hooks/useLiveScore';
import { LiveScorecard } from '../components/LiveScorecard';
import { MatchSummaryCard } from '../components/MatchSummaryCard';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useRequests } from '../hooks/useRequests';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useCricketStats } from '../hooks/useCricketStats';
import { usePlayerOfPeriod } from '../hooks/usePlayerOfPeriod';
import { useMatchMemories } from '../hooks/useMatchMemories';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useMonthSummary } from '../hooks/useMonthSummary';
import { useAuth } from '../context/AuthContext';

// Lazy-loaded heavy components (photos, sponsor data load on-demand)
const DashboardStars = lazy(() => import('../components/DashboardStars'));
const DashboardDeferred = lazy(() => import('../components/DashboardDeferred'));

// Wrapper so we can call useLiveScore unconditionally inside a component
function LiveScorecardWidget({ match }: { match: { id: string; ch_match_id?: string | null; opponent?: string | null; venue?: string } }) {
  const { data, loading, error, countdown, refetch } = useLiveScore(match.ch_match_id);
  return (
    <LiveScorecard
      data={data}
      loading={loading}
      error={error}
      countdown={countdown}
      refetch={refetch}
      chMatchId={match.ch_match_id!}
      matchOpponent={match.opponent}
      matchVenue={match.venue}
    />
  );
}

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
  const memories = useMatchMemories(matches);

  // Live match alert — match scheduled today (in any state: upcoming or completed-today)
  const liveMatchToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return matches.find(m => m.date === today);
  }, [matches]);
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
    const upcomingCount = matches.filter(m => m.result === 'upcoming').length;
    return { totalMembers: members.length, activeMembers: activeCount, totalFunds, matchesPlayed: completed.length, won, lost, winRate, pendingRequests: getPendingCount(), upcomingCount };
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
    const dhurandarsWins = completed.filter(m => m.winning_team === 'dhurandars').length;
    const bazigarsWins   = completed.filter(m => m.winning_team === 'bazigars').length;
    const draws          = completed.filter(m => m.result === 'draw').length;

    // Current streak: count consecutive wins for the same team (newest-first)
    let streakTeam: string | null = null;
    let streakCount = 0;
    for (const m of completed) {
      if (m.result === 'draw') break;
      if (!streakTeam) { streakTeam = m.winning_team ?? null; streakCount = 1; }
      else if (m.winning_team === streakTeam) streakCount++;
      else break;
    }

    // Last completed internal match
    const lastMatch = completed[0] ?? null;

    // Next upcoming internal match
    const nextInternal = int
      .filter(m => m.result === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

    return { total: completed.length, dhurandarsWins, bazigarsWins, draws, streakTeam, streakCount, lastMatch, nextInternal };
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

  // Most recent completed match — any type (external or internal) for summary card
  const lastAnyCompletedMatch = useMemo(() => {
    return matches.find(m => ['won', 'lost', 'draw'].includes(m.result));
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

  // ── Personalisation: identify the "me" member ────────────────────────────
  const myMemberId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('scc-my-profile-id');
  }, []);
  const myMember = useMemo(() => members.find(m => m.id === myMemberId) ?? null, [members, myMemberId]);
  const myStats  = useMemo(() => cricketStats.find(s => s.member_id === myMemberId) ?? null, [cricketStats, myMemberId]);
  const myMoms   = myMemberId ? (momCounts[myMemberId] || 0) : 0;

  // Next milestone hint (SCC season runs)
  const myNextMilestone = useMemo(() => {
    if (!myStats) return null;
    const runs = myStats.batting_runs;
    const steps = [100, 250, 500, 1000, 2000, 5000];
    const next = steps.find(s => runs < s);
    if (!next) return null;
    return { away: next - runs, label: `${next} SCC runs` };
  }, [myStats]);

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
    <div className="bg-gray-950 min-h-screen">
      <Header title="Dashboard" subtitle="Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-4">

        {/* ── ALERTS ─────────────────────────────────────────────────────── */}
        <BirthdayBanner members={members} />
        <RenewalReminderBanner members={members} />

        {/* ── PREMIUM HERO ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl"
             style={{ background: 'radial-gradient(ellipse at 5% 0%, rgba(5,150,105,0.22) 0%, transparent 50%), radial-gradient(ellipse at 95% 100%, rgba(37,99,235,0.15) 0%, transparent 50%), linear-gradient(160deg, #050e1b 0%, #070c17 50%, #050a12 100%)' }}>

          {/* ── Decorative layer ── */}
          {/* top highlight line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent pointer-events-none" />
          {/* subtle grid texture */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* big diffuse glows */}
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
          {/* border */}
          <div className="absolute inset-0 border border-white/8 rounded-2xl pointer-events-none" />

          <div className="relative p-4 lg:p-6">

            {/* ── Row 1: Logo + Club name + Avatar ── */}
            <div className="flex items-center gap-3.5 mb-3">
              {/* Logo with glow halo */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-teal-400/10 blur-md" />
                <img src="/scc-logo.jpg" alt="SCC"
                     className="relative w-11 h-11 lg:w-13 lg:h-13 rounded-xl object-cover border border-white/20 shadow-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-black text-[17px] lg:text-2xl leading-tight tracking-tight">
                  Sangria Cricket Club
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-500/18 border border-emerald-400/30 text-emerald-300 text-[9px] font-black rounded-full uppercase tracking-widest">
                    Season 2025–26
                  </span>
                  <span className="text-gray-600 text-[11px]">{stats.activeMembers} active</span>
                </div>
              </div>
              {/* Avatar top-right */}
              {myMember && (
                <Link to={`/profile/${myMember.id}`} className="flex-shrink-0">
                  {myMember.avatar_url ? (
                    <img src={myMember.avatar_url} alt={myMember.name}
                         className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400/50 ring-2 ring-emerald-400/10 shadow-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600/50 to-teal-600/40 border-2 border-emerald-400/50 flex items-center justify-center shadow-lg">
                      <span className="text-emerald-200 font-black text-sm">{myMember.name[0]}</span>
                    </div>
                  )}
                </Link>
              )}
            </div>

            {/* ── Form strip + MyStats: all on one controlled row ── */}
            <div className="flex items-center gap-1.5 mb-4 min-w-0">
              {/* Form label */}
              {lastFiveResults.length > 0 && (
                <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest flex-shrink-0">Form</span>
              )}
              {/* W/L/D chips */}
              {lastFiveResults.map(m => (
                <div key={m.id} className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center text-[9px] font-black text-white ${
                  m.result === 'won'  ? 'bg-emerald-500'
                : m.result === 'lost' ? 'bg-red-500'
                : 'bg-amber-500'
                }`}>
                  {m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'D'}
                </div>
              ))}
              {/* Streak badge — whitespace-nowrap so it never wraps */}
              {streak && streak.count >= 2 && (
                <span className={`whitespace-nowrap flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  streak.result === 'won'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : 'bg-red-500/15 text-red-300 border border-red-500/25'
                }`}>
                  {streak.result === 'won' ? '🔥' : '😤'} {streak.count} streak
                </span>
              )}
              {/* Push MyStats to right */}
              <div className="flex-1 min-w-0" />
              <div className="flex-shrink-0">
                <MyStatsButton compact />
              </div>
            </div>

            {/* ── Stat chips ── */}
            <div className="grid grid-cols-4 gap-2 lg:gap-2.5">
              {[
                { label: 'Matches',  value: stats.matchesPlayed,   numColor: 'text-white',      accent: 'from-white/5',        border: 'border-white/8',         bar: 'bg-white/20' },
                { label: 'Won',      value: animatedWon,           numColor: 'text-emerald-400', accent: 'from-emerald-500/12', border: 'border-emerald-500/20',   bar: 'bg-emerald-400' },
                { label: 'Win %',    value: `${animatedWinRate}%`, numColor: 'text-amber-400',   accent: 'from-amber-500/12',   border: 'border-amber-500/20',     bar: 'bg-amber-400' },
                { label: 'Upcoming', value: stats.upcomingCount,   numColor: 'text-blue-400',    accent: 'from-blue-500/12',    border: 'border-blue-500/20',      bar: 'bg-blue-400' },
              ].map(({ label, value, numColor, accent, border, bar }) => (
                <div key={label} className={`relative rounded-xl pt-3 pb-2.5 px-1 text-center border ${border} bg-gradient-to-b ${accent} to-transparent overflow-hidden`}>
                  {/* Colored top accent bar */}
                  <div className={`absolute top-0 left-1/4 right-1/4 h-0.5 ${bar} rounded-full opacity-60`} />
                  <div className={`text-2xl lg:text-3xl font-black tabular-nums leading-tight ${numColor}`}>{value}</div>
                  <div className="text-gray-600 text-[8px] lg:text-[9px] uppercase tracking-widest mt-1 font-bold">{label}</div>
                </div>
              ))}
            </div>

            {/* ── Personal greeting ── */}
            {myMember && (
              <div className="mt-4 pt-4 border-t border-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-white text-sm leading-tight">
                      Hey, {myMember.name.split(' ')[0]}! 🏏
                    </p>
                    <p className="text-[11px] mt-0.5">
                      <span className="text-gray-400">{myStats?.batting_runs ?? 0} runs · {myStats?.bowling_wickets ?? 0} wkts</span>
                      {myMoms > 0 && <><span className="text-gray-700"> · </span><span className="text-yellow-400 font-bold">{myMoms} MOM</span></>}
                      <span className="text-gray-600"> this season</span>
                    </p>
                  </div>
                  <Link
                    to={`/profile/${myMember.id}`}
                    className="flex-shrink-0 px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-emerald-600/25 to-teal-600/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:from-emerald-600/40 hover:border-emerald-500/50 transition-all whitespace-nowrap shadow-lg shadow-emerald-900/30"
                  >
                    My Profile →
                  </Link>
                </div>
                {myNextMilestone && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Target className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    <span className="text-purple-300 text-[10px] font-bold">
                      {myNextMilestone.away} more to {myNextMilestone.label}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── LIVE TICKER ──────────────────────────────────────────────── */}
        {tickerItems.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto py-2 px-3.5 bg-black/40 border border-white/8 rounded-xl backdrop-blur-sm">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-md flex-shrink-0">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
            <div className="flex items-center gap-6 text-xs text-gray-400 whitespace-nowrap">
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-gray-700" />}
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── ANNOUNCEMENT WALL ────────────────────────────────────────── */}
        <AnnouncementWall />

        {/* ── LIVE SCORECARD (only when match is actually in progress) ── */}
        {liveMatchToday?.ch_match_id && liveMatchToday.result === 'upcoming' && (
          <LiveScorecardWidget match={liveMatchToday} />
        )}

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

        </div>

        {/* ── LAST MATCH SUMMARY + ON THIS DAY ────────────────────────── */}
        {(lastAnyCompletedMatch || memories.length > 0) && (
          <div className={`grid grid-cols-1 gap-4 ${lastAnyCompletedMatch && memories.length > 0 ? 'lg:grid-cols-3' : ''}`}>

            {/* Last match card — full width on mobile, 2/3 on desktop (when memories also shown) */}
            {lastAnyCompletedMatch && (
              <div className={memories.length > 0 ? 'lg:col-span-2' : ''}>
                <MatchSummaryCard match={lastAnyCompletedMatch} />
              </div>
            )}

            {/* On This Day — side panel on desktop, stacks below on mobile */}
            {memories.length > 0 && (
              <div className="rounded-2xl border border-white/8 p-4 flex flex-col justify-center"
                   style={{ background: 'linear-gradient(135deg, #1a0820 0%, #0d0d0d 100%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🗓️</span>
                  <span className="text-pink-400 text-[10px] font-bold uppercase tracking-[2px]">On This Day</span>
                </div>
                <div className="space-y-2.5">
                  {memories.slice(0, 2).map(m => (
                    <div key={m.match.id} className="border-l-2 border-pink-500/30 pl-3">
                      <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wider mb-0.5">
                        {m.yearsAgo === 1 ? '1 year ago' : `${m.yearsAgo} years ago`}
                      </p>
                      <p className="text-sm text-gray-300 font-medium leading-snug">
                        {m.match.match_type === 'internal' ? 'Dhurandars vs Bazigars' : `vs ${m.match.opponent || 'TBD'}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                          m.match.result === 'won'  ? 'bg-emerald-500/15 text-emerald-400'
                          : m.match.result === 'lost' ? 'bg-red-500/15 text-red-400'
                          : 'bg-amber-500/15 text-amber-400'
                        }`}>{m.match.result}</span>
                        {m.match.our_score && (
                          <span className="text-[10px] text-gray-600">{m.match.our_score} vs {m.match.opponent_score}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

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

              {/* Header row */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" /> Internal Rivalry · {internalMatchStats.total} played
                </p>
                {/* Streak badge */}
                {internalMatchStats.streakCount >= 2 && internalMatchStats.streakTeam && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                    internalMatchStats.streakTeam === 'dhurandars'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    🔥 {internalMatchStats.streakCount}-match streak
                  </span>
                )}
              </div>

              {/* Score row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/40 mb-3 transition-transform ${internalMatchStats.dhurandarsWins > internalMatchStats.bazigarsWins ? 'scale-110' : ''}`}>
                    <span className="text-3xl lg:text-4xl font-black text-white tabular-nums">{animatedDhurandarsWins}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">🦁 Dhurandars</h4>
                  <p className="text-blue-300/50 text-xs">wins</p>
                  {internalMatchStats.dhurandarsWins > internalMatchStats.bazigarsWins && (
                    <p className="text-yellow-400 text-xs mt-1 font-black">👑 Leading</p>
                  )}
                </div>
                <div className="text-center flex-shrink-0 px-2">
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                    <span className="text-white font-black text-sm">VS</span>
                  </div>
                  {internalMatchStats.draws > 0 && (
                    <p className="text-amber-400/70 text-[10px] mt-1">{internalMatchStats.draws} draw{internalMatchStats.draws > 1 ? 's' : ''}</p>
                  )}
                  {internalMatchStats.dhurandarsWins === internalMatchStats.bazigarsWins && (
                    <p className="text-white/40 text-[10px] mt-1">Tied!</p>
                  )}
                </div>
                <div className="flex-1 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/40 mb-3 transition-transform ${internalMatchStats.bazigarsWins > internalMatchStats.dhurandarsWins ? 'scale-110' : ''}`}>
                    <span className="text-3xl lg:text-4xl font-black text-white tabular-nums">{animatedBazigarsWins}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">🐅 Bazigars</h4>
                  <p className="text-purple-300/50 text-xs">wins</p>
                  {internalMatchStats.bazigarsWins > internalMatchStats.dhurandarsWins && (
                    <p className="text-yellow-400 text-xs mt-1 font-black">👑 Leading</p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
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
                <span className="text-blue-400/60 text-[10px] font-medium">🦁 Dhurandars</span>
                {internalMatchStats.draws > 0 && <span className="text-amber-400/60 text-[10px] font-medium">Draws</span>}
                <span className="text-purple-400/60 text-[10px] font-medium">Bazigars 🐅</span>
              </div>

              {/* Last match + next match footer */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                {internalMatchStats.lastMatch && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30 text-[10px] uppercase tracking-wider font-bold">Last:</span>
                    <span className={`text-[11px] font-bold ${
                      internalMatchStats.lastMatch.winning_team === 'dhurandars' ? 'text-blue-300' :
                      internalMatchStats.lastMatch.winning_team === 'bazigars'   ? 'text-purple-300' :
                      'text-amber-300'
                    }`}>
                      {internalMatchStats.lastMatch.winning_team === 'dhurandars' ? '🦁 Dhurandars won' :
                       internalMatchStats.lastMatch.winning_team === 'bazigars'   ? '🐅 Bazigars won' : 'Draw'}
                    </span>
                    {internalMatchStats.lastMatch.our_score && (
                      <span className="text-white/30 text-[10px]">
                        · {internalMatchStats.lastMatch.our_score}
                        {internalMatchStats.lastMatch.opponent_score && ` vs ${internalMatchStats.lastMatch.opponent_score}`}
                      </span>
                    )}
                    <span className="text-white/25 text-[10px]">
                      {new Date(internalMatchStats.lastMatch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
                {internalMatchStats.nextInternal && (
                  <Link
                    to="/matches"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white/70 text-[10px] font-bold hover:bg-white/20 transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    Next: {new Date(internalMatchStats.nextInternal.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Link>
                )}
                <Link
                  to="/matches"
                  className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold"
                >
                  View all →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── RECENT MATCHES + LOW BALANCE ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent Matches */}
          <div className="rounded-2xl overflow-hidden border border-white/8"
               style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #0f0f0f 100%)' }}>
            <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Recent Matches
              </h3>
              <Link to="/matches" className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-0.5 font-semibold transition-colors group">
                All <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            {recentMatches.length === 0 ? (
              <p className="p-6 text-center text-gray-600 text-sm">No matches yet</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recentMatches.map(match => (
                  <div key={match.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                      match.result === 'won'  ? 'bg-emerald-600' :
                      match.result === 'lost' ? 'bg-red-700' :
                      match.result === 'draw' ? 'bg-amber-600' : 'bg-gray-700'
                    }`}>
                      {match.result === 'upcoming' ? '⏳' : match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {match.match_type === 'internal' ? 'Dhurandars vs Bazigars' : `vs ${match.opponent || 'TBD'}`}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">
                        {match.venue && `${match.venue} · `}
                        {new Date(match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {match.our_score && (
                      <span className="text-xs font-semibold text-gray-500 flex-shrink-0 tabular-nums">{match.our_score}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Balance Alert */}
          <div className="rounded-2xl overflow-hidden border border-white/8"
               style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #0f0f0f 100%)' }}>
            <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                Low Balance
                {allLowBalanceMembers.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500/80 text-white text-[9px] font-black rounded-full">{allLowBalanceMembers.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {isAdmin && allLowBalanceMembers.length > 0 && (
                  <button onClick={() => setShowWhatsAppModal(true)} className="text-emerald-500 hover:text-emerald-400 transition-colors" title="WhatsApp Reminders">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                <Link to="/members" className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-0.5 font-semibold transition-colors group">
                  All <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
            {lowBalanceMembers.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-900/30 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-sm text-gray-600">All members have sufficient balance 🎉</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {lowBalanceMembers.map(member => (
                  <div key={member.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-400">{member.name.charAt(0)}</span>
                      </div>
                    )}
                    <p className="font-medium text-white text-sm flex-1 truncate">{member.name}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      member.balance < 0
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      ₹{member.balance.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
