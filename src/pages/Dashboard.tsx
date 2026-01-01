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
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useRequests } from '../hooks/useRequests';

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

  const loading = membersLoading || matchesLoading || transactionsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Dashboard" subtitle="Welcome to Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.activeMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <IndianRupee className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Funds</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₹{stats.totalFunds.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Matches</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.matchesPlayed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.winRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Win/Loss Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Matches Won</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats.won}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Matches Lost</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {stats.lost}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-red-500/30 rotate-180" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.pendingRequests}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Matches */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Matches</h3>
              <Link
                to="/matches"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <CardContent className="p-0">
              {recentMatches.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No matches yet</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentMatches.map(match => (
                    <div key={match.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
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
          <Card>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Low Balance Alert</h3>
              <Link
                to="/members"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <CardContent className="p-0">
              {lowBalanceMembers.length === 0 ? (
                <p className="p-6 text-center text-gray-500">All members have sufficient balance</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lowBalanceMembers.map(member => (
                    <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      </div>
                      <span className={`font-semibold ${member.balance < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
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
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
            <Link
              to="/finance"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No transactions yet</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentTransactions.map(txn => (
                  <div key={txn.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {txn.description || txn.type}
                      </p>
                      <p className="text-sm text-gray-500">
                        {txn.member?.name || 'Club'} • {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className={`font-semibold ${txn.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
