import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  TrendingUp,
  Trophy,
  AlertCircle,
  ChevronRight,
  IndianRupee,
  UserPlus,
  Sparkles,
  Star,
  Award,
  Camera,
  Swords,
  MessageCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { CalendarWidget } from '../components/CalendarWidget';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useRequests } from '../hooks/useRequests';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { members, loading: membersLoading } = useMembers();
  const { matches, loading: matchesLoading } = useMatches();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { getPendingCount } = useRequests();
  const { photos: matchPhotos, loading: photosLoading } = useMatchPhotos();
  const { activeCount, isActive } = useMemberActivity(members, matches);
  const { isAdmin } = useAuth();
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const stats = useMemo(() => {
    const totalFunds = members.reduce((sum, m) => sum + m.balance, 0);
    // External matches only for main stats
    const externalMatches = matches.filter(m => m.match_type !== 'internal');
    const completedMatches = externalMatches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completedMatches.filter(m => m.result === 'won').length;
    const lost = completedMatches.filter(m => m.result === 'lost').length;
    const winRate = completedMatches.length > 0 ? (won / completedMatches.length) * 100 : 0;

    return {
      totalMembers: members.length,
      activeMembers: activeCount,
      totalFunds,
      matchesPlayed: completedMatches.length,
      won,
      lost,
      winRate,
      pendingRequests: getPendingCount(),
    };
  }, [members, matches, getPendingCount, activeCount]);

  const recentMatches = useMemo(() => {
    return matches.slice(0, 5);
  }, [matches]);

  const allLowBalanceMembers = useMemo(() => {
    return members.filter(m => isActive(m.id) && m.balance < 500);
  }, [members, isActive]);

  const lowBalanceMembers = useMemo(() => {
    return allLowBalanceMembers.slice(0, 5);
  }, [allLowBalanceMembers]);

  // Get the latest won match with Man of the Match
  const latestWonMatch = useMemo(() => {
    return matches.find(m => m.result === 'won' && m.man_of_match);
  }, [matches]);

  // Check if Man of the Match should be displayed (until next match is played)
  const showManOfMatch = useMemo(() => {
    if (!latestWonMatch || !latestWonMatch.man_of_match) return null;

    // Find the index of the latest won match
    const wonMatchIndex = matches.findIndex(m => m.id === latestWonMatch.id);

    // Check if there's a newer completed match
    const newerCompletedMatch = matches.slice(0, wonMatchIndex).find(
      m => ['won', 'lost', 'draw'].includes(m.result)
    );

    // Only show if no newer completed match exists
    return newerCompletedMatch ? null : latestWonMatch;
  }, [matches, latestWonMatch]);

  // Monthly finance data for chart
  const monthlyFinanceData = useMemo(() => {
    const last6Months: { month: string; deposits: number; expenses: number }[] = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-IN', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthTransactions = transactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate >= monthStart && txnDate <= monthEnd;
      });

      const deposits = monthTransactions
        .filter(t => t.type === 'deposit')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = monthTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      last6Months.push({ month: monthKey, deposits, expenses });
    }

    return last6Months;
  }, [transactions]);

  // Win/Loss pie chart data (external matches only)
  const matchResultData = useMemo(() => {
    const externalMatches = matches.filter(m => m.match_type !== 'internal');
    const externalWon = externalMatches.filter(m => m.result === 'won').length;
    const externalLost = externalMatches.filter(m => m.result === 'lost').length;
    const externalDraw = externalMatches.filter(m => m.result === 'draw').length;
    return [
      { name: 'Won', value: externalWon, color: '#22c55e' },
      { name: 'Lost', value: externalLost, color: '#ef4444' },
      { name: 'Draw', value: externalDraw, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [matches]);

  // Internal match stats (Dhurandars vs Bazigars)
  const internalMatchStats = useMemo(() => {
    const internalMatches = matches.filter(m => m.match_type === 'internal');
    const completedInternal = internalMatches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const dhurandarsWins = completedInternal.filter(m => m.winning_team === 'dhurandars').length;
    const bazigarsWins = completedInternal.filter(m => m.winning_team === 'bazigars').length;
    const draws = completedInternal.filter(m => m.result === 'draw').length;

    return {
      total: completedInternal.length,
      dhurandarsWins,
      bazigarsWins,
      draws,
    };
  }, [matches]);

  // Top contributors
  const topContributors = useMemo(() => {
    const contributorMap = new Map<string, { name: string; total: number }>();

    transactions
      .filter(t => t.type === 'deposit' && t.member)
      .forEach(t => {
        const existing = contributorMap.get(t.member!.id);
        if (existing) {
          existing.total += t.amount;
        } else {
          contributorMap.set(t.member!.id, {
            name: t.member!.name,
            total: t.amount,
          });
        }
      });

    return Array.from(contributorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [transactions]);

  // Animated values
  const animatedMembers = useAnimatedValue(stats.activeMembers, 800);
  const animatedFunds = useAnimatedValue(stats.totalFunds, 1200);
  const animatedMatches = useAnimatedValue(stats.matchesPlayed, 800);
  const animatedWinRate = useAnimatedValue(Math.round(stats.winRate), 1000);
  const animatedWon = useAnimatedValue(stats.won, 800);
  const animatedLost = useAnimatedValue(stats.lost, 800);
  const animatedDhurandarsWins = useAnimatedValue(internalMatchStats.dhurandarsWins, 800);
  const animatedBazigarsWins = useAnimatedValue(internalMatchStats.bazigarsWins, 800);

  const loading = membersLoading || matchesLoading || transactionsLoading || photosLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-500"></div>
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary-500 animate-pulse" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-white to-primary-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen">
      <Header title="Dashboard" subtitle="Welcome to Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Man of the Match - Hero Section */}
        {showManOfMatch && showManOfMatch.man_of_match && (
          <Card className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 border-0 overflow-hidden relative" delay={0}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <CardContent className="p-6 lg:p-8 relative">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                {/* Trophy Icon */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
                      <Star className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Trophy className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                </div>

                {/* Player Photo */}
                <div className="flex-shrink-0">
                  {showManOfMatch.man_of_match.avatar_url ? (
                    <img
                      src={showManOfMatch.man_of_match.avatar_url}
                      alt={showManOfMatch.man_of_match.name}
                      className="w-28 h-28 lg:w-36 lg:h-36 rounded-2xl object-cover border-4 border-white/30 shadow-2xl"
                    />
                  ) : (
                    <div className="w-28 h-28 lg:w-36 lg:h-36 rounded-2xl bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-2xl">
                      <span className="text-4xl lg:text-5xl font-bold text-white">
                        {showManOfMatch.man_of_match.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white/90 text-sm font-medium mb-2 backdrop-blur-sm">
                    <Award className="w-4 h-4" />
                    Man of the Match
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                    {showManOfMatch.man_of_match.name}
                  </h2>
                  <p className="text-white/80 text-sm lg:text-base">
                    vs {showManOfMatch.opponent || 'Opposition'} • {new Date(showManOfMatch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {showManOfMatch.our_score && (
                    <p className="text-white/90 font-semibold mt-2 text-lg">
                      {showManOfMatch.our_score} - {showManOfMatch.opponent_score}
                    </p>
                  )}
                </div>

                {/* Decorative Stars */}
                <div className="hidden lg:flex flex-col gap-2 text-white/20">
                  <Star className="w-8 h-8 animate-pulse" />
                  <Star className="w-6 h-6 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <Star className="w-4 h-4 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Photos Carousel */}
        {matchPhotos.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-500" />
              Team Gallery
            </h2>
            <PhotoCarousel photos={matchPhotos} autoPlayInterval={5000} />
          </div>
        )}

        {/* Join Club Banner */}
        <Link to="/requests">
          <Card className="bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 border-0 overflow-hidden relative group" delay={0}>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-white">
                  <h3 className="text-lg font-bold">Want to Join Sangria Cricket Club?</h3>
                  <p className="text-primary-100 text-sm">
                    Click here to submit your membership request
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card delay={50} className="group overflow-hidden">
            <CardContent className="p-4 lg:p-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-4 relative">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Members</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {animatedMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={100} className="group overflow-hidden">
            <CardContent className="p-4 lg:p-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-4 relative">
                <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <IndianRupee className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Funds</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    ₹{animatedFunds.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={150} className="group overflow-hidden">
            <CardContent className="p-4 lg:p-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-4 relative">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Matches</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {animatedMatches}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={200} className="group overflow-hidden">
            <CardContent className="p-4 lg:p-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-4 relative">
                <div className="p-3 bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Win Rate</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {animatedWinRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Win/Loss Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card delay={250} className="group overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Matches Won</p>
                  <p className="text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                    {animatedWon}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${stats.matchesPlayed > 0 ? (stats.won / stats.matchesPlayed) * 100 : 0}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card delay={300} className="group overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Matches Lost</p>
                  <p className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {animatedLost}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-8 h-8 text-red-500 rotate-180" />
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-1000"
                  style={{ width: `${stats.matchesPlayed > 0 ? (stats.lost / stats.matchesPlayed) * 100 : 0}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card delay={350} className="group overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Pending Requests</p>
                  <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {stats.pendingRequests}
                  </p>
                </div>
                <div className={`p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full transition-transform ${stats.pendingRequests > 0 ? 'animate-pulse' : ''} group-hover:scale-110`}>
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                </div>
              </div>
              {stats.pendingRequests > 0 && (
                <Link to="/requests" className="mt-3 inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium">
                  Review now <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Internal Match Stats - Dhurandars vs Bazigars */}
        {internalMatchStats.total > 0 && (
          <Card delay={370} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-purple-500" />
                Internal Matches - Dhurandars vs Bazigars
              </h3>
            </div>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                {/* Dhurandars */}
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-3 shadow-lg">
                    <span className="text-3xl font-bold text-white tabular-nums">
                      {animatedDhurandarsWins}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-blue-600 dark:text-blue-400">Sangria Dhurandars</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Wins</p>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center px-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center shadow-inner">
                    <span className="text-xl font-bold text-gray-500 dark:text-gray-400">VS</span>
                  </div>
                  {internalMatchStats.draws > 0 && (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                      {internalMatchStats.draws} Draw{internalMatchStats.draws > 1 ? 's' : ''}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {internalMatchStats.total} match{internalMatchStats.total > 1 ? 'es' : ''} played
                  </p>
                </div>

                {/* Bazigars */}
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 mb-3 shadow-lg">
                    <span className="text-3xl font-bold text-white tabular-nums">
                      {animatedBazigarsWins}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-purple-600 dark:text-purple-400">Sangria Bazigars</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Wins</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  {internalMatchStats.dhurandarsWins > 0 && (
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-1000"
                      style={{
                        width: `${(internalMatchStats.dhurandarsWins / internalMatchStats.total) * 100}%`,
                      }}
                    ></div>
                  )}
                  {internalMatchStats.draws > 0 && (
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000"
                      style={{
                        width: `${(internalMatchStats.draws / internalMatchStats.total) * 100}%`,
                      }}
                    ></div>
                  )}
                  {internalMatchStats.bazigarsWins > 0 && (
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-1000"
                      style={{
                        width: `${(internalMatchStats.bazigarsWins / internalMatchStats.total) * 100}%`,
                      }}
                    ></div>
                  )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="text-blue-500 font-medium">Dhurandars</span>
                  <span className="text-purple-500 font-medium">Bazigars</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Finance Chart */}
          <Card delay={375}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary-500" />
                Monthly Finance Overview
              </h3>
            </div>
            <CardContent className="p-4">
              <div className="h-64" style={{ minHeight: '256px', minWidth: '0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyFinanceData}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                    />
                    <Bar dataKey="deposits" fill="#22c55e" radius={[4, 4, 0, 0]} name="Deposits" />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Deposits</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match Results Pie Chart & Top Contributors */}
          <Card delay={400}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary-500" />
                Match Results & Top Contributors
              </h3>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Pie Chart */}
                <div className="h-40" style={{ minHeight: '160px', minWidth: '0' }}>
                  {matchResultData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={matchResultData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {matchResultData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                      No matches yet
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-col justify-center gap-2">
                  {matchResultData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.name}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Contributors */}
              {topContributors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1">
                    <Award className="w-3 h-3" /> TOP CONTRIBUTORS
                  </p>
                  <div className="space-y-2">
                    {topContributors.map((contributor, index) => (
                      <div key={contributor.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-200 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {contributor.name}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          ₹{contributor.total.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Matches */}
          <Card delay={400}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                Recent Matches
              </h3>
              <Link
                to="/matches"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium group"
              >
                View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <CardContent className="p-0">
              {recentMatches.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No matches yet</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentMatches.map((match, index) => (
                    <div
                      key={match.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                      style={{ animationDelay: `${450 + index * 50}ms` }}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          vs {match.opponent || 'TBD'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {match.venue} • {new Date(match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <Badge
                        variant={
                          match.result === 'won'
                            ? 'success'
                            : match.result === 'lost'
                            ? 'danger'
                            : match.result === 'draw'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {match.result === 'upcoming' ? 'Upcoming' : match.result.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Balance Members */}
          <Card delay={450}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Low Balance Alert
              </h3>
              <div className="flex items-center gap-3">
                {isAdmin && allLowBalanceMembers.length > 0 && (
                  <button
                    onClick={() => setShowWhatsAppModal(true)}
                    className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1 font-medium"
                    title="Send WhatsApp Reminders"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                <Link
                  to="/members"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium group"
                >
                  View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
            <CardContent className="p-0">
              {lowBalanceMembers.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-gray-500">All members have sufficient balance</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lowBalanceMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                      style={{ animationDelay: `${500 + index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      </div>
                      <span className={`font-bold px-3 py-1 rounded-full text-sm ${member.balance < 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' : 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        ₹{member.balance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar Widget */}
        <CalendarWidget matches={matches} />
      </div>

      {/* WhatsApp Reminders Modal */}
      <WhatsAppRemindersModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        members={allLowBalanceMembers}
      />
    </div>
  );
}
