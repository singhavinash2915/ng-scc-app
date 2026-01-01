import { useMemo } from 'react';
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
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useRequests } from '../hooks/useRequests';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

export function Dashboard() {
  const { members, loading: membersLoading } = useMembers();
  const { matches, loading: matchesLoading } = useMatches();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { getPendingCount } = useRequests();

  const stats = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'active').length;
    const totalFunds = members.reduce((sum, m) => sum + m.balance, 0);
    const completedMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completedMatches.filter(m => m.result === 'won').length;
    const lost = completedMatches.filter(m => m.result === 'lost').length;
    const winRate = completedMatches.length > 0 ? (won / completedMatches.length) * 100 : 0;

    return {
      totalMembers: members.length,
      activeMembers,
      totalFunds,
      matchesPlayed: completedMatches.length,
      won,
      lost,
      winRate,
      pendingRequests: getPendingCount(),
    };
  }, [members, matches, getPendingCount]);

  const recentMatches = useMemo(() => {
    return matches.slice(0, 5);
  }, [matches]);

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  const lowBalanceMembers = useMemo(() => {
    return members.filter(m => m.status === 'active' && m.balance < 500).slice(0, 5);
  }, [members]);

  // Animated values
  const animatedMembers = useAnimatedValue(stats.activeMembers, 800);
  const animatedFunds = useAnimatedValue(stats.totalFunds, 1200);
  const animatedMatches = useAnimatedValue(stats.matchesPlayed, 800);
  const animatedWinRate = useAnimatedValue(Math.round(stats.winRate), 1000);
  const animatedWon = useAnimatedValue(stats.won, 800);
  const animatedLost = useAnimatedValue(stats.lost, 800);

  const loading = membersLoading || matchesLoading || transactionsLoading;

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
              <Link
                to="/members"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium group"
              >
                View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
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

        {/* Recent Transactions */}
        <Card delay={500}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-primary-500" />
              Recent Transactions
            </h3>
            <Link
              to="/finance"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium group"
            >
              View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No transactions yet</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentTransactions.map((txn, index) => (
                  <div
                    key={txn.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                    style={{ animationDelay: `${550 + index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.amount >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} group-hover:scale-110 transition-transform`}>
                        <IndianRupee className={`w-5 h-5 ${txn.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {txn.description || txn.type}
                        </p>
                        <p className="text-sm text-gray-500">
                          {txn.member?.name || 'Club'} • {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold text-lg tabular-nums ${txn.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {txn.amount >= 0 ? '+' : ''}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
