import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, TrendingUp, Trophy, ChevronRight,
  IndianRupee, Flame, MapPin, Activity, Crown, Radio,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MatchCentreCard } from '../components/MatchCentreCard';
import { BirthdayBoard } from '../components/BirthdayBoard';
import { MahaSangramCard } from '../components/MahaSangramCard';
import { ExploreGrid } from '../components/ExploreGrid';
import { AccentSwitcher } from '../components/AccentSwitcher';
import { PremiumHero } from '../components/PremiumHero';

import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { DashboardPoll } from '../components/DashboardPoll';
import { BirthdayBanner } from '../components/BirthdayBanner';

import { RenewalReminderBanner } from '../components/RenewalReminderBanner';




import { ElClasicoChampionBanner } from '../components/ElClasicoChampionBanner';
import { useWeather } from '../hooks/useWeather';
import { useLiveScore } from '../hooks/useLiveScore';
import { useAppLiveMatch } from '../hooks/useAppLiveMatch';
import { useMe } from '../context/MemberContext';
import { YourSeason } from '../components/YourSeason';
import { SignInCard } from '../components/SignInCard';
import { LiveScorecard } from '../components/LiveScorecard';
import { MatchSummaryCard } from '../components/MatchSummaryCard';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useSeasonLeague } from '../hooks/useSeasonLeague';
import { useLiveStream } from '../hooks/useLiveStream';
import { useRequests } from '../hooks/useRequests';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useCricketStats } from '../hooks/useCricketStats';
import { usePlayerOfPeriod } from '../hooks/usePlayerOfPeriod';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useMonthSummary } from '../hooks/useMonthSummary';

// Lazy-loaded heavy components (photos, sponsor data load on-demand)
const DashboardStars = lazy(() => import('../components/DashboardStars'));
const DashboardDeferred = lazy(() => import('../components/DashboardDeferred'));

// Wrapper so we can call useLiveScore unconditionally inside a component
function LiveScorecardWidget({ match }: { match: { id: string; ch_match_id?: string | null; opponent?: string | null; venue?: string; date?: string } }) {
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
      matchDate={match.date}
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
  const league = useSeasonLeague();
  const liveStream = useLiveStream();
  const appLive = useAppLiveMatch();
  const { me, loading: meLoading } = useMe();
  // Match Day mode — an upcoming match dated today takes over the top banner
  const { todaysMatch } = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local
    const tm = matches.find(m => m.result === 'upcoming' && m.date === today) ?? null;
    const next = league.upcoming[0];
    const days = next
      ? Math.max(0, Math.ceil((new Date(next.date + 'T00:00:00').getTime() - now.getTime()) / 86400000))
      : null;
    return { todaysMatch: tm, daysToKickoff: days };
  }, [matches, league.upcoming]);
  const { counts: momCounts } = useMOMCounts();
  const monthSummary = useMonthSummary();
  const { stats: cricketStats } = useCricketStats('2025-26');
  const { playerOfMonth, playerOfWeek } = usePlayerOfPeriod(matches, members, cricketStats);

  // Live match alert — match scheduled today (in any state: upcoming or completed-today)
  const liveMatchToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return matches.find(m => m.date === today);
  }, [matches]);
  // If a match was played in the last 7 days, show "of the Week"; else "of the Month"
  const featuredPlayer = playerOfWeek || playerOfMonth;
  const featuredLabel = playerOfWeek ? 'Player of the Week' : 'Player of the Month';
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
    // Current season: Oct 2025 → Sep 2026
    const seasonStart = '2025-10-01';
    const seasonEnd   = '2026-09-30';
    // Overall SCC stats — external matches only.
    // Internal matches (Dhurandars vs Bazigars) are SCC vs SCC, so they don't
    // count as a "win/loss" against an external opponent. They're tracked in
    // the separate "Internal Rivalry" card.
    const seasonMatches = matches.filter(m => m.date >= seasonStart && m.date <= seasonEnd && m.match_type !== 'internal');
    const completed = seasonMatches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completed.filter(m => m.result === 'won').length;
    const lost = completed.filter(m => m.result === 'lost').length;
    const winRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
    const upcomingCount = seasonMatches.filter(m => m.result === 'upcoming').length;
    return { totalMembers: members.length, activeMembers: activeCount, totalFunds, matchesPlayed: completed.length, won, lost, winRate, pendingRequests: getPendingCount(), upcomingCount };
  }, [members, matches, getPendingCount, activeCount]);

  const allLowBalanceMembers = useMemo(() => members.filter(m => isActive(m.id) && m.balance < 1000), [members, isActive]);

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

  // ── Personalisation: identify the "me" member ────────────────────────────
  const myMemberId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('scc-my-profile-id');
  }, []);
  const myMember = useMemo(() => members.find(m => m.id === myMemberId) ?? null, [members, myMemberId]);
  const myStats  = useMemo(() => cricketStats.find(s => s.member_id === myMemberId) ?? null, [cricketStats, myMemberId]);
  const myMoms   = myMemberId ? (momCounts[myMemberId] || 0) : 0;
  const myNextMilestone = useMemo(() => {
    if (!myStats) return null;
    const runs = myStats.batting_runs;
    const next = [100, 250, 500, 1000, 2000, 5000].find(s => runs < s);
    return next ? { away: next - runs, label: `${next} SCC runs` } : null;
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
    <div className="aurora-bg min-h-screen">
      <Header title="Dashboard" subtitle="Sangria Cricket Club" />

      {/* ── SCORED IN THE APP — the very first thing on the page ─────────
          Above the CricHeroes block on purpose: when we're scoring a match
          ourselves this is the live score, and it's the one page element that
          everyone opening the app mid-match is looking for. */}
      {appLive.live && (
        <div className="px-4 lg:px-8 pt-4">
          <Link to={`/score/${appLive.live.matchId}`}
            className="block relative overflow-hidden rounded-2xl px-5 py-4 shadow-lg group"
            style={{ background: 'linear-gradient(110deg,#064e3b,#059669 55%,#10b981)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/25 flex items-center justify-center flex-shrink-0">
                <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[2px] text-white/75">
                  🔴 Live · Innings {appLive.live.innings}
                </p>
                <p className="text-white font-black text-lg leading-tight truncate">
                  {appLive.live.battingTeam} {appLive.live.runs}/{appLive.live.wickets}
                  <span className="text-white/70 font-bold text-sm">
                    {' '}({Math.floor(appLive.live.legalBalls / 6)}.{appLive.live.legalBalls % 6})
                  </span>
                </p>
                <p className="text-white/85 text-xs font-medium truncate">
                  {appLive.live.target
                    ? `Need ${Math.max(0, appLive.live.target - appLive.live.runs)} to beat ${appLive.live.bowlingTeam}`
                    : `v ${appLive.live.bowlingTeam} — tap for ball by ball`}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      )}

      {/* ── LIVE SCORECARD — CricHeroes-scored matches ─────────────────── */}
      {liveMatchToday?.ch_match_id && !['won', 'lost', 'draw'].includes(liveMatchToday.result) && (
        <div className="px-4 lg:px-8 pt-4">
          <LiveScorecardWidget match={liveMatchToday} />
        </div>
      )}

      {/* ── WE'RE LIVE — pinned to the very top whenever a stream is on ── */}
      {liveStream.isLive && (
        <div className="px-4 lg:px-8 pt-4">
          <Link
            to={liveStream.stream.ch_match_id ? `/live/${liveStream.stream.ch_match_id}` : '/watch'}
            className="block relative overflow-hidden rounded-2xl px-5 py-4 shadow-lg group"
            style={{ background: 'linear-gradient(110deg,#991b1b,#e11d48 55%,#f97316)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/25 flex items-center justify-center flex-shrink-0">
                <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base leading-tight truncate">
                  🔴 WE'RE LIVE {liveStream.stream.title ? `— ${liveStream.stream.title}` : ''}
                </p>
                <p className="text-white/90 text-xs font-medium">Tap to watch the stream + live scorecard</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      )}

      {/* ── YOUR SEASON — the club data, addressed to one person ────────
          Above the club-wide hero on purpose: a signed-in member wants to know
          whether THEY are playing before they want the club's win rate. Signed
          out this is the sign-in card, and everything below still works. */}
      {!meLoading && (
        <div className="px-4 lg:px-8 pt-4">
          {me ? <YourSeason matches={matches} members={members} /> : <SignInCard />}
        </div>
      )}

      {/* ── PREMIUM HERO (theme-aware: light + dark) ──────────────────── */}
      <div className="px-4 lg:px-8 pt-4 space-y-3">
        <div className="flex justify-end"><AccentSwitcher /></div>
        <PremiumHero
          greeted={!!me}
          firstName={myMember?.name.split(' ')[0] ?? null}
          profileId={myMember?.id ?? null}
          avatarUrl={myMember?.avatar_url ?? null}
          winRate={Math.round(stats.winRate)}
          won={stats.won}
          lost={stats.lost}
          matchesPlayed={stats.matchesPlayed}
          upcomingCount={stats.upcomingCount}
          nextOpponent={nextUpcomingMatch?.opponent ?? null}
          nextDate={nextUpcomingMatch?.date ?? null}
          activeMembers={stats.activeMembers}
          totalMembers={stats.totalMembers}
          streak={streak}
          lastFive={lastFiveResults}
          myRuns={myStats?.batting_runs ?? null}
          myWkts={myStats?.bowling_wickets ?? null}
          myMoms={myMoms}
          milestone={myNextMilestone}
        />
      </div>

      {/* ── Remaining sections keep the Stadium-Night dark styling for now ── */}
      <div className="p-4 lg:p-8 space-y-4">

        {/* ── AUCTION NIGHT ────────────────────────────────────────────────
             Both the auction banners and the SCC League registration banner are
             retired now the auction is finished. They were written for the
             build-up — "auction night is next", "captains elected" — and reading
             that a week afterwards makes the app look stale. The MahaSangram
             card below carries the result instead. */}

        {/* ── EL CLÁSICO CHAMPIONS — 24h heroic victory showcase ────────── */}
        <ElClasicoChampionBanner matches={matches} />

        {/* ── ALERTS ─────────────────────────────────────────────────────── */}
        <BirthdayBanner members={members} />
        <RenewalReminderBanner members={members} />

        {/* ── BOOK A MATCH — subtle, share-with-opponents prompt ─────────── */}
        <a
          href="/book-match"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-white/8 border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-colors"
        >
          <span className="text-[14px] flex-shrink-0">📣</span>
          <span className="flex-1 text-[11px] text-slate-500 dark:text-gray-400 group-hover:text-slate-600 dark:text-gray-300">
            Got a team that wants to play SCC? <span className="text-emerald-400/90 font-semibold">Share the booking link</span>
          </span>
          <ChevronRight className="w-3 h-3 text-slate-400 dark:text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
        </a>



        {/* ── LIVE TICKER ──────────────────────────────────────────────── */}
        {tickerItems.length > 0 && (
          <div className="glass flex items-center gap-3 overflow-x-auto py-2 px-3.5 rounded-xl">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-md flex-shrink-0">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
            <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-gray-700" />}
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── BENTO GRID ────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 auto-rows-[minmax(120px,auto)]">

          {/* FEATURED — Next Match (4x2 on lg, full width on mobile) */}
          <div className="feature-pitch col-span-2 lg:col-span-4 lg:row-span-2 relative overflow-hidden rounded-2xl p-6 lg:p-7 shadow-2xl">
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
                <h2 className="text-slate-900 dark:text-white text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] relative">
                  {nextUpcomingMatch.match_type === 'internal'
                    ? <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-300 dark:to-teal-300 bg-clip-text text-transparent">{nextUpcomingMatch.opponent || 'Internal Match'}</span>
                    : <>vs <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-300 dark:to-teal-300 bg-clip-text text-transparent">{nextUpcomingMatch.opponent || 'TBD'}</span></>
                  }
                </h2>
                <div className="flex items-center gap-4 text-slate-500 dark:text-gray-400 text-xs mt-3 flex-wrap relative">
                  {nextUpcomingMatch.venue && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextUpcomingMatch.venue}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                    {new Date(nextUpcomingMatch.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {matchWeather && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-white"
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
                    <div key={l} className="flex flex-col items-center bg-slate-100 dark:bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2.5 min-w-[56px] border border-slate-200 dark:border-white/8">
                      <span className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-none">{String(v).padStart(2, '0')}</span>
                      <span className="text-slate-400 dark:text-gray-500 text-[9px] font-semibold uppercase tracking-[1.5px] mt-1">{l}</span>
                    </div>
                  ))}
                </div>

                {/* Last MOM pinned to the bottom */}
                {showManOfMatch?.man_of_match && (
                  <div className="relative mt-6 pt-5 border-t border-slate-200 dark:border-white/8 flex items-center gap-3">
                    {showManOfMatch.man_of_match.avatar_url ? (
                      <img src={showManOfMatch.man_of_match.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-yellow-400/40" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center">
                        <span className="text-sm font-black text-yellow-200">{showManOfMatch.man_of_match.name?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-yellow-400 text-[9px] font-bold uppercase tracking-[1.5px]">⭐ Last Man of the Match</p>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{showManOfMatch.man_of_match.name}
                        <span className="text-slate-500 dark:text-gray-400 font-semibold ml-2">vs {showManOfMatch.opponent}</span>
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
                    <div className="text-slate-400 dark:text-gray-500 text-xs mt-0.5 uppercase tracking-wider">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members (2x1) */}
          <div className="glass col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5">
            <div className="absolute top-0 left-5 right-5 h-0.5 bg-blue-400 rounded-full opacity-70" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Members</span>
            </div>
            <p className="font-display text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums relative leading-none">{animatedMembers}</p>
            <p className="text-slate-500 dark:text-gray-400 text-[11px] mt-2 relative">of {stats.totalMembers} · <span className="text-blue-300">active</span></p>
          </div>

          {/* Club Funds (2x1) */}
          <div className="glass col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5">
            <div className="absolute top-0 left-5 right-5 h-0.5 bg-emerald-400 rounded-full opacity-70" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Club Funds</span>
            </div>
            <p className="font-display text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums relative leading-none">
              ₹{animatedFunds >= 1000 ? `${(animatedFunds / 1000).toFixed(1)}k` : animatedFunds.toLocaleString('en-IN')}
            </p>
            {/* Season growth trend pill */}
            {(() => {
              const seasonNet = monthSummary.seasonDeposits - monthSummary.seasonExpenses;
              const starting = stats.totalFunds - seasonNet;
              const pct = starting > 0 ? Math.round((seasonNet / starting) * 100) : 0;
              if (seasonNet === 0 || monthSummary.loading) {
                return <p className="text-slate-500 dark:text-gray-400 text-[11px] mt-2 relative">Avg ₹{avgBalance >= 1000 ? `${(avgBalance / 1000).toFixed(1)}k` : avgBalance} / member</p>;
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
          <div className="glass col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden rounded-2xl p-5">
            <div className="absolute top-0 left-5 right-5 h-0.5 bg-amber-400 rounded-full opacity-70" />
            <div className="flex items-center gap-1.5 mb-3 relative">
              <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="text-amber-600 dark:text-amber-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Win Rate</span>
            </div>
            <div className="flex items-center gap-5 relative">
              <svg width="110" height="110" viewBox="0 0 42 42" className="flex-shrink-0">
                <circle cx="21" cy="21" r="15.9" fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="3" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                  strokeDasharray={`${stats.winRate} 100`} transform="rotate(-90 21 21)" strokeLinecap="round" />
                <text x="21" y="23.5" textAnchor="middle" className="fill-slate-900 dark:fill-white" fontSize="9" fontWeight="900">{animatedWinRate}%</text>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex gap-4">
                  <div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{animatedWon}</div>
                    <div className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-bold">Won</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-red-500 dark:text-red-400 tabular-nums">{animatedLost}</div>
                    <div className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-bold">Lost</div>
                  </div>
                </div>
                {lastFiveResults.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[9px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1.5">Last 5</div>
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
                {streak.count}-match {streak.result === 'won' ? 'win streak 🔥' : streak.result === 'lost' ? 'tough run' : 'no result streak'}
              </div>
            )}
          </div>

          {/* MOM Race Leaderboard (2x2) */}
          {topMOMs.length > 0 && (
            <div className="glass col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden rounded-2xl p-5">
              <div className="absolute top-0 left-5 right-5 h-0.5 bg-amber-400 rounded-full opacity-70" />
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
                      'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400'
                    }`}>{idx + 1}</div>
                    {entry.member!.avatar_url ? (
                      <img src={entry.member!.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-white/10" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-yellow-950">{entry.member!.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-800 dark:text-white truncate flex-1">{entry.member!.name.split(' ').slice(0, 2).join(' ')}</span>
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
            <div className="glass col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5">
              <div className="absolute top-0 left-5 right-5 h-0.5 bg-pink-400 rounded-full opacity-70" />
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-pink-400/15 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2 relative">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-pink-300" fill="currentColor" />
                  <span className="text-pink-600 dark:text-pink-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">{featuredLabel}</span>
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
                  <div className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">{featuredPlayer.member.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-pink-200/60 mt-0.5 font-semibold">{featuredPlayer.periodLabel}</div>
                  {featuredPlayer.tieBroken && (
                    <div className="text-[9px] text-slate-400 dark:text-pink-300/40 mt-0.5">tie-broken by season MVP score</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* This Month (2x1) */}
          <div className="glass col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl p-4 lg:p-5">
            <div className="absolute top-0 left-5 right-5 h-0.5 bg-emerald-400 rounded-full opacity-70" />
            <div className="flex items-center gap-1.5 mb-2 relative">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">This Month</span>
            </div>
            <p className="font-display text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums relative leading-none">
              <span className={monthSummary.deposits - monthSummary.expenses >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {monthSummary.deposits - monthSummary.expenses >= 0 ? '+' : '−'}₹{Math.abs(monthSummary.deposits - monthSummary.expenses).toLocaleString('en-IN')}
              </span>
            </p>
            <p className="text-slate-500 dark:text-gray-400 text-[11px] mt-2 relative">
              <span className="text-emerald-400">₹{monthSummary.deposits.toLocaleString('en-IN')} in</span>
              <span className="mx-1.5 text-slate-300 dark:text-gray-600">·</span>
              <span className="text-red-400">₹{monthSummary.expenses.toLocaleString('en-IN')} out</span>
            </p>
          </div>

        </div>

        {/* ── MATCH CENTRE — pre-match analytics for the next match ───── */}
        {nextUpcomingMatch && (
          <MatchCentreCard
            nextMatch={nextUpcomingMatch}
            matches={matches}
            members={members}
            cricketStats={cricketStats}
          />
        )}

        {/* ── LAST MATCH SUMMARY + ON THIS DAY ────────────────────────── */}
        {/* ── LAST MATCH SUMMARY ──────────────────────────────────────────
             "On This Day / From the Archives" is gone. It surfaced whatever
             happened to share today's date, which on most days is nothing, and
             on the rest is a year-old league game nobody was asking about. */}
        {lastAnyCompletedMatch && (
          <MatchSummaryCard match={lastAnyCompletedMatch} />
        )}

        {/* ── BIRTHDAYS ─────────────────────────────────────────────────── */}
        <BirthdayBoard members={members} />

        {/* ── SEASON STARS (lazy — loads cricketStats on demand) ────────── */}
        {showDeferred && (
          <Suspense fallback={null}>
            <DashboardStars momCounts={momCounts} />
          </Suspense>
        )}

        {/* ── MAHASANGRAM — this season's internal competition ─────────── */}
        <MahaSangramCard matches={matches} />

        {/* ── INTERNAL BATTLE ─────────────────────────────────────────────
             The Dhurandars vs Bazigars rivalry is off the Dashboard: it's a
             different competition from MahaSangram and having both sets of
             internal teams on one screen just reads as confusion. Its record
             is intact and still shown on the Matches and Records pages. */}

        {/* ── MATCH DAY banner — takes over when we play today ────────── */}
        {todaysMatch && !liveStream.isLive && (
          <Link to="/matches" className="block relative overflow-hidden rounded-2xl px-5 py-4 shadow-lg group"
            style={{ background: 'linear-gradient(110deg,#991b1b,#dc2626 55%,#f97316)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/25 flex items-center justify-center flex-shrink-0 text-xl animate-pulse">🔴</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base leading-tight truncate">MATCH DAY — vs {todaysMatch.opponent || 'TBD'} 🏏</p>
                <p className="text-white/90 text-xs font-medium truncate">{todaysMatch.venue || 'Venue TBD'} · squad up, predictions in — let's go!</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {/* ── SQUAD POLL ───────────────────────────────────────────────── */}
        <DashboardPoll matches={matches} members={members} onMatchUpdate={fetchMatches} />

        {/* ── EXPLORE — everything that used to be inlined above ──────── */}
        <ExploreGrid />

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
