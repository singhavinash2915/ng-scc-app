import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, TrendingUp, Trophy, AlertCircle, ChevronRight,
  IndianRupee, UserPlus, Star, Award, Camera, Swords,
  MessageCircle, Building2, ExternalLink, Flame, MapPin, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { CalendarWidget } from '../components/CalendarWidget';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { DashboardPoll } from '../components/DashboardPoll';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useRequests } from '../hooks/useRequests';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';
import { useSponsor } from '../hooks/useSponsor';
import { useCricketStats } from '../hooks/useCricketStats';

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
  const { members, loading: membersLoading } = useMembers();
  const { matches, loading: matchesLoading, fetchMatches } = useMatches();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { getPendingCount } = useRequests();
  const { photos: matchPhotos, loading: photosLoading } = useMatchPhotos();
  const { activeCount, isActive } = useMemberActivity(members, matches);
  const { isAdmin } = useAuth();
  const { sponsors } = useSponsor();
  const { stats: cricketStats } = useCricketStats();
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const stats = useMemo(() => {
    const totalFunds = members.reduce((sum, m) => sum + m.balance, 0);
    const ext = matches.filter(m => m.match_type !== 'internal');
    const completed = ext.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completed.filter(m => m.result === 'won').length;
    const lost = completed.filter(m => m.result === 'lost').length;
    const winRate = completed.length > 0 ? (won / completed.length) * 100 : 0;
    return { totalMembers: members.length, activeMembers: activeCount, totalFunds, matchesPlayed: completed.length, won, lost, winRate, pendingRequests: getPendingCount() };
  }, [members, matches, getPendingCount, activeCount]);

  const recentMatches = useMemo(() => matches.slice(0, 5), [matches]);
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

  const monthlyFinanceData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const txns = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
      return {
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        deposits: txns.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
        expenses: txns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, [transactions]);

  const thisMonthFinance = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const txns = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
    return {
      deposits: txns.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
    };
  }, [transactions]);

  const matchResultData = useMemo(() => {
    const ext = matches.filter(m => m.match_type !== 'internal');
    return [
      { name: 'Won', value: ext.filter(m => m.result === 'won').length, color: '#22c55e' },
      { name: 'Lost', value: ext.filter(m => m.result === 'lost').length, color: '#ef4444' },
      { name: 'Draw', value: ext.filter(m => m.result === 'draw').length, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [matches]);

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

  const topContributors = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    transactions.filter(t => t.type === 'deposit' && t.member).forEach(t => {
      const e = map.get(t.member!.id);
      if (e) e.total += t.amount; else map.set(t.member!.id, { name: t.member!.name, total: t.amount });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [transactions]);

  const topPerformers = useMemo(() => {
    if (!cricketStats.length) return [];
    const result: { player: typeof cricketStats[0]; label: string; stat: number | string; unit: string; gradient: string; icon: string }[] = [];
    // MVP — combined score
    const byMVP = [...cricketStats].sort((a, b) => {
      const scoreA = a.batting_runs + a.bowling_wickets * 20 + (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs) * 10;
      const scoreB = b.batting_runs + b.bowling_wickets * 20 + (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) * 10;
      return scoreB - scoreA;
    });
    if (byMVP[0]) result.push({ player: byMVP[0], label: 'Season MVP', stat: byMVP[0].batting_runs + byMVP[0].bowling_wickets * 20 + (byMVP[0].fielding_catches + byMVP[0].fielding_stumpings + byMVP[0].fielding_run_outs) * 10, unit: 'MVP pts', gradient: 'from-amber-500 to-yellow-500', icon: '👑' });
    // Top run scorer
    const byRuns = [...cricketStats].sort((a, b) => b.batting_runs - a.batting_runs);
    if (byRuns[0]) result.push({ player: byRuns[0], label: 'Top Batsman', stat: byRuns[0].batting_runs, unit: 'runs', gradient: 'from-blue-500 to-indigo-500', icon: '🏏' });
    // Top wicket taker
    const byWkts = [...cricketStats].filter(s => s.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets);
    if (byWkts[0]) result.push({ player: byWkts[0], label: 'Top Bowler', stat: byWkts[0].bowling_wickets, unit: 'wickets', gradient: 'from-rose-500 to-red-600', icon: '⚡' });
    // Best fielder
    const byField = [...cricketStats].sort((a, b) => (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) - (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs));
    const fieldTotal = byField[0] ? byField[0].fielding_catches + byField[0].fielding_stumpings + byField[0].fielding_run_outs : 0;
    if (byField[0] && fieldTotal > 0) result.push({ player: byField[0], label: 'Best Fielder', stat: fieldTotal, unit: 'dismissals', gradient: 'from-emerald-500 to-green-600', icon: '🧤' });
    return result;
  }, [cricketStats]);

  const avgBalance = useMemo(() => {
    const active = members.filter(m => isActive(m.id));
    return active.length ? Math.round(active.reduce((s, m) => s + m.balance, 0) / active.length) : 0;
  }, [members, isActive]);

  const countdown = useCountdown(nextUpcomingMatch ? nextUpcomingMatch.date : null);

  const animatedMembers = useAnimatedValue(stats.activeMembers, 800);
  const animatedFunds = useAnimatedValue(stats.totalFunds, 1200);
  const animatedMatches = useAnimatedValue(stats.matchesPlayed, 800);
  const animatedWinRate = useAnimatedValue(Math.round(stats.winRate), 1000);
  const animatedWon = useAnimatedValue(stats.won, 800);
  const animatedLost = useAnimatedValue(stats.lost, 800);
  const animatedDhurandarsWins = useAnimatedValue(internalMatchStats.dhurandarsWins, 800);
  const animatedBazigarsWins = useAnimatedValue(internalMatchStats.bazigarsWins, 800);

  const loading = membersLoading || matchesLoading || transactionsLoading || photosLoading;

  const winRateCirc = 2 * Math.PI * 16;
  const winRateDash = (stats.winRate / 100) * winRateCirc;

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

        {/* ── HERO BANNER ─────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900" />
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='24' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='30' cy='30' r='14' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='30' cy='30' r='4' fill='white'/%3E%3Cline x1='0' y1='30' x2='60' y2='30' stroke='white' stroke-width='0.5'/%3E%3Cline x1='30' y1='0' x2='30' y2='60' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-300/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-56 h-56 bg-teal-300/10 rounded-full blur-3xl translate-y-1/3 pointer-events-none" />

          <div className="relative p-5 lg:p-8">
            {/* Club identity row */}
            <div className="flex items-center gap-4 mb-6">
              <img src="/scc-logo.jpg" alt="SCC" className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl border-2 border-white/20 shadow-xl object-cover flex-shrink-0" />
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-white leading-tight">Sangria Cricket Club</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 bg-green-400/20 border border-green-400/30 rounded-full text-green-300 text-[11px] font-semibold">Season 2026–27</span>
                  <span className="text-white/40 text-[11px]">{stats.matchesPlayed} matches · {stats.activeMembers} active</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Next Match */}
              {nextUpcomingMatch ? (
                <div>
                  <p className="text-green-300/80 text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    Next Match
                  </p>
                  <h2 className="text-white text-xl lg:text-2xl font-black mb-1.5">
                    vs <span className="text-green-300">{nextUpcomingMatch.opponent || 'TBD'}</span>
                  </h2>
                  <div className="flex items-center gap-3 text-white/55 text-sm flex-wrap mb-3">
                    {nextUpcomingMatch.venue && (
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextUpcomingMatch.venue}</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                      {new Date(nextUpcomingMatch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[{ v: countdown.days, l: 'Days' }, { v: countdown.hours, l: 'Hrs' }, { v: countdown.mins, l: 'Min' }, { v: countdown.secs, l: 'Sec' }].map(({ v, l }) => (
                      <div key={l} className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[46px] border border-white/10">
                        <span className="text-xl font-black text-white tabular-nums leading-none">{String(v).padStart(2, '0')}</span>
                        <span className="text-white/45 text-[9px] font-semibold uppercase tracking-wide mt-0.5">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  {[{ v: stats.matchesPlayed, l: 'Matches', c: 'text-white' }, { v: stats.won, l: 'Won', c: 'text-green-400' }, { v: stats.lost, l: 'Lost', c: 'text-red-400' }, { v: `${Math.round(stats.winRate)}%`, l: 'Win Rate', c: 'text-amber-400' }].map(({ v, l, c }) => (
                    <div key={l} className="text-center">
                      <div className={`text-3xl font-black tabular-nums ${c}`}>{v}</div>
                      <div className="text-white/45 text-xs mt-0.5">{l}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Man of the Match — always shown when available */}
              {showManOfMatch && (
                <div className="flex items-center gap-3 bg-white/5 border border-yellow-400/20 rounded-2xl px-4 py-3 lg:justify-self-end">
                  <div className="relative flex-shrink-0">
                    {showManOfMatch.man_of_match?.avatar_url ? (
                      <img src={showManOfMatch.man_of_match.avatar_url} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-yellow-400/50 shadow-lg" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-yellow-500/20 border-2 border-yellow-400/40 flex items-center justify-center">
                        <span className="text-xl font-black text-yellow-200">{showManOfMatch.man_of_match?.name?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                      <Star className="w-3 h-3 text-yellow-900" fill="currentColor" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-yellow-300/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">⭐ Man of the Match</p>
                    <h3 className="text-base font-black text-white truncate">{showManOfMatch.man_of_match?.name}</h3>
                    <p className="text-white/50 text-xs truncate">vs {showManOfMatch.opponent}
                      {showManOfMatch.result === 'won' && <span className="text-green-400 ml-1">· Won 🏆</span>}
                    </p>
                    {showManOfMatch.our_score && (
                      <p className="text-white/40 text-xs">{showManOfMatch.our_score}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── FORM STRIP ──────────────────────────── */}
        {lastFiveResults.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Last {lastFiveResults.length}</span>
            <div className="flex gap-1.5">
              {lastFiveResults.map(m => (
                <div key={m.id} title={`vs ${m.opponent} – ${m.result.toUpperCase()}`}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md flex-shrink-0 transition-transform hover:scale-110 cursor-default ${
                    m.result === 'won' ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/25' :
                    m.result === 'lost' ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/25' :
                    'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/25'
                  }`}>
                  {m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'D'}
                </div>
              ))}
            </div>
            {streak && streak.count >= 2 && (
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                streak.result === 'won' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                streak.result === 'lost' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {streak.result === 'won' ? <Flame className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {streak.count}-match {streak.result === 'won' ? 'win streak 🔥' : streak.result === 'lost' ? 'losing run' : 'draw streak'}
              </span>
            )}
          </div>
        )}

        {/* ── STATS GRID ──────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Active Members */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 lg:p-5 shadow-lg shadow-blue-500/20 group cursor-default">
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/5 rounded-full" />
            <Users className="w-5 h-5 text-blue-100/80 mb-3 relative" />
            <p className="text-3xl font-black text-white tabular-nums relative">{animatedMembers}</p>
            <p className="text-blue-100/65 text-xs font-medium mt-0.5 relative">Active Members</p>
            <p className="text-blue-200/40 text-[10px] mt-1 relative">{stats.totalMembers} total</p>
          </div>

          {/* Total Funds */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 p-4 lg:p-5 shadow-lg shadow-emerald-500/20 group cursor-default">
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/5 rounded-full" />
            <IndianRupee className="w-5 h-5 text-emerald-100/80 mb-3 relative" />
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums relative leading-tight">
              ₹{animatedFunds >= 1000 ? `${(animatedFunds / 1000).toFixed(1)}k` : animatedFunds.toLocaleString('en-IN')}
            </p>
            <p className="text-emerald-100/65 text-xs font-medium mt-0.5 relative">Club Funds</p>
            <p className="text-emerald-200/40 text-[10px] mt-1 relative">Avg ₹{avgBalance >= 1000 ? `${(avgBalance / 1000).toFixed(1)}k` : avgBalance} / member</p>
          </div>

          {/* Matches Played */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 p-4 lg:p-5 shadow-lg shadow-violet-500/20 group cursor-default">
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/5 rounded-full" />
            <Calendar className="w-5 h-5 text-violet-100/80 mb-3 relative" />
            <p className="text-3xl font-black text-white tabular-nums relative">{animatedMatches}</p>
            <p className="text-violet-100/65 text-xs font-medium mt-0.5 relative">Matches Played</p>
            <p className="text-violet-200/40 text-[10px] mt-1 relative">{animatedWon}W · {animatedLost}L</p>
          </div>

          {/* Win Rate with SVG ring */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 p-4 lg:p-5 shadow-lg shadow-amber-500/20 group cursor-default">
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/5 rounded-full" />
            <div className="flex items-start justify-between relative">
              <div>
                <Trophy className="w-5 h-5 text-amber-100/80 mb-3" />
                <p className="text-3xl font-black text-white tabular-nums">{animatedWinRate}%</p>
                <p className="text-amber-100/65 text-xs font-medium mt-0.5">Win Rate</p>
              </div>
              <svg className="w-14 h-14 -rotate-90 flex-shrink-0" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="3.5"
                  strokeDasharray={`${winRateDash.toFixed(2)} ${winRateCirc.toFixed(2)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
            </div>
          </div>
        </div>

        {/* ── SEASON STARS ────────────────────────── */}
        {topPerformers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                Season 2026–27 Stars
              </h2>
              <Link to="/ai-insights" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold">
                Full Leaderboard <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {topPerformers.map(({ player, label, stat, unit, gradient, icon }) => (
                <div key={`${player.member_id}-${label}`} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 shadow-lg group cursor-default`}>
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute -bottom-3 -left-3 w-10 h-10 bg-white/5 rounded-full" />
                  <div className="text-xl mb-2 relative">{icon}</div>
                  <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none relative">{stat}</p>
                  <p className="text-white/55 text-[9px] uppercase tracking-wide relative mt-0.5">{unit}</p>
                  <div className="mt-3 relative">
                    <p className="text-white text-xs font-bold truncate">{player.member?.name || '—'}</p>
                    <p className="text-white/50 text-[10px] truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SQUAD POLL ──────────────────────────── */}
        <DashboardPoll matches={matches} members={members} onMatchUpdate={fetchMatches} />

        {/* ── FINANCE PULSE + RESULTS ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card delay={300}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <IndianRupee className="w-4 h-4 text-green-500" />
                Finance Pulse
              </h3>
              <Link to="/finance" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold group">
                Details <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-lg font-black text-green-600 dark:text-green-400">₹{stats.totalFunds >= 1000 ? `${(stats.totalFunds / 1000).toFixed(1)}k` : stats.totalFunds}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Club Bank</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400">₹{thisMonthFinance.deposits >= 1000 ? `${(thisMonthFinance.deposits / 1000).toFixed(1)}k` : thisMonthFinance.deposits}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">This Month</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p className="text-lg font-black text-purple-600 dark:text-purple-400">₹{avgBalance >= 1000 ? `${(avgBalance / 1000).toFixed(1)}k` : avgBalance}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Avg / Member</p>
                </div>
              </div>
              <div className="h-36" style={{ minHeight: 144, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyFinanceData} barSize={8} barGap={2}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 11 }}
                      formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, '']}
                    />
                    <Bar dataKey="deposits" fill="#22c55e" radius={[3, 3, 0, 0]} name="Deposits" />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-5 mt-1">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] text-gray-400">Deposits</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-gray-400">Expenses</span></div>
              </div>
            </CardContent>
          </Card>

          <Card delay={350}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-amber-500" />
                Results & Top Contributors
              </h3>
            </div>
            <CardContent className="p-4">
              <div className="flex gap-3 items-center mb-4">
                <div style={{ width: 140, minWidth: 140, height: 140 }}>
                  {matchResultData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={matchResultData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                          {matchResultData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '8px', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">No matches yet</div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {matchResultData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-gray-800 dark:text-gray-200">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-gray-400">Win Rate</span>
                      <span className="text-[10px] font-black text-green-600">{Math.round(stats.winRate)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              {topContributors.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Award className="w-3 h-3" /> Top Contributors
                  </p>
                  <div className="space-y-2">
                    {topContributors.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-orange-100 text-orange-700'}`}>{i + 1}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{c.name}</span>
                        <span className="text-xs font-bold text-green-600">₹{c.total.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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

        {/* ── PHOTO GALLERY ───────────────────────── */}
        {matchPhotos.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Camera className="w-3.5 h-3.5 text-primary-500" />
              Team Gallery
            </h2>
            <PhotoCarousel photos={matchPhotos} autoPlayInterval={5000} />
          </div>
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

        {/* ── SPONSOR BANNER ──────────────────────── */}
        {sponsors && sponsors.length > 0 && (
          <div className="space-y-3">
            {sponsors.map((s) => (
              <Card key={s.id} delay={25}>
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-3">Powered By</p>
                  <div className="flex items-center gap-4">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="w-14 h-14 object-contain rounded-xl bg-gray-50 dark:bg-gray-700 p-1.5 flex-shrink-0 shadow-sm" />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">{s.name}</h3>
                      {s.tagline && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.tagline}</p>}
                      {s.member && <p className="text-xs text-gray-400 mt-0.5">SCC Member: {s.member.name}</p>}
                    </div>
                    {s.website_url && (
                      <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                        <ExternalLink className="w-4 h-4 text-gray-400 hover:text-primary-500" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
