import { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  IndianRupee,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Send,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useTransactions } from '../hooks/useTransactions';
import { useFeeTracking } from '../hooks/useFeeTracking';
import { useAuth } from '../context/AuthContext';
import { MatchDayMessageModal } from '../components/MatchDayMessageModal';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import type { Match } from '../types';

type TabType = 'matches' | 'balances';

export function FeeTracking() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const { transactions } = useTransactions();
  const { isAdmin } = useAuth();
  const { matchFeeStatuses, memberBalances, stats } = useFeeTracking(matches, members, transactions);

  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all');
  const [balanceSearch, setBalanceSearch] = useState('');
  const [showMatchDayModal, setShowMatchDayModal] = useState(false);
  const [matchDayMatch, setMatchDayMatch] = useState<Match | null>(null);
  const [showRemindersModal, setShowRemindersModal] = useState(false);

  // Filter member balances
  const filteredBalances = useMemo(() => {
    return memberBalances.filter(mb => {
      if (balanceFilter !== 'all' && mb.status !== balanceFilter) return false;
      if (balanceSearch && !mb.member.name.toLowerCase().includes(balanceSearch.toLowerCase())) return false;
      return true;
    });
  }, [memberBalances, balanceFilter, balanceSearch]);

  // Chart data: top 10 members by balance (ascending = lowest first)
  const balanceChartData = useMemo(() => {
    return memberBalances
      .slice(0, 10)
      .map(mb => ({
        name: mb.member.name.split(' ')[0],
        balance: mb.member.balance,
        status: mb.status,
      }));
  }, [memberBalances]);

  // Low balance members for reminder
  const lowBalanceMembers = useMemo(() => {
    return memberBalances
      .filter(mb => mb.status === 'critical' || mb.status === 'low')
      .map(mb => mb.member);
  }, [memberBalances]);

  const openMatchDayMessage = (match: Match) => {
    setMatchDayMatch(match);
    setShowMatchDayModal(true);
  };

  return (
    <div>
      <Header title="Fee Tracking" subtitle="Track fees, balances & match-day logistics" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card delay={0}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Club Funds</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.totalFunds.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={1}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Balance</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.avgBalance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={2}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Low Balance</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.criticalCount + stats.lowCount}
                    <span className="text-xs font-normal text-gray-400 ml-1">members</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={3}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Collection Rate</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.overallCollectionRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* This Month Summary */}
        <Card delay={4}>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">This Month</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                <p className="text-xs text-green-600 dark:text-green-400">Deposits Received</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {stats.monthDeposits.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                <p className="text-xs text-red-600 dark:text-red-400">Match Fees Deducted</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">
                  {stats.monthMatchFees.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { key: 'matches' as const, label: 'Match Fees', icon: IndianRupee },
            { key: 'balances' as const, label: 'Member Balances', icon: Users },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Match Fees Tab */}
        {activeTab === 'matches' && (
          <div className="space-y-4">
            {matchFeeStatuses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No matches with squad data found.
                </CardContent>
              </Card>
            ) : (
              matchFeeStatuses.map((status) => {
                const isExpanded = expandedMatch === status.match.id;
                const matchDate = new Date(status.match.date + 'T00:00:00');
                const isUpcoming = status.match.result === 'upcoming';

                return (
                  <Card key={status.match.id}>
                    <CardContent className="p-0">
                      {/* Match header row */}
                      <button
                        onClick={() => setExpandedMatch(isExpanded ? null : status.match.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-12 rounded-full flex-shrink-0 ${
                            status.collectionRate === 100 ? 'bg-green-500' :
                            status.collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                {matchDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              {isUpcoming && <Badge variant="info" size="sm">UPCOMING</Badge>}
                              {status.match.result === 'won' && <Badge variant="success" size="sm">WON</Badge>}
                              {status.match.result === 'lost' && <Badge variant="danger" size="sm">LOST</Badge>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {status.match.venue} {status.match.opponent ? `vs ${status.match.opponent}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Progress indicator */}
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {status.paidCount}/{status.totalPlayers}
                            </p>
                            <p className="text-xs text-gray-500">paid</p>
                          </div>
                          {/* Progress bar */}
                          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                status.collectionRate === 100 ? 'bg-green-500' :
                                status.collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${status.collectionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 w-10 text-right">
                            {status.collectionRate}%
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg py-2">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{status.paidCount}</p>
                              <p className="text-xs text-green-600 dark:text-green-400">Paid</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg py-2">
                              <p className="text-lg font-bold text-red-600 dark:text-red-400">{status.unpaidCount}</p>
                              <p className="text-xs text-red-600 dark:text-red-400">Unpaid</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2">
                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {status.totalCollected.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                of {status.totalExpected.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>

                          {/* Paid players */}
                          {status.paidMembers.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Paid
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {status.paidMembers.map(m => (
                                  <span key={m.id} className="px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unpaid players */}
                          {status.unpaidMembers.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Unpaid
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {status.unpaidMembers.map(m => (
                                  <span key={m.id} className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                                    {m.name} (₹{m.balance.toFixed(0)})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {isAdmin && isUpcoming && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => openMatchDayMessage(status.match)}
                                className="!bg-green-600 hover:!bg-green-700 !text-white"
                              >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                Match Day Message
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Member Balances Tab */}
        {activeTab === 'balances' && (
          <div className="space-y-4">
            {/* Balance chart */}
            {balanceChartData.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Lowest Balances
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={balanceChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(17,24,39,0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: 12,
                        }}
                        formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Balance']}
                      />
                      <Bar dataKey="balance" radius={[0, 6, 6, 0]}>
                        {balanceChartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              entry.status === 'critical' ? '#ef4444' :
                              entry.status === 'low' ? '#f59e0b' : '#22c55e'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2 flex-1">
                {(['all', 'critical', 'low', 'healthy'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setBalanceFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      balanceFilter === f
                        ? f === 'critical' ? 'bg-red-500 text-white'
                        : f === 'low' ? 'bg-amber-500 text-white'
                        : f === 'healthy' ? 'bg-green-500 text-white'
                        : 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-1 opacity-75">
                        ({f === 'critical' ? stats.criticalCount
                          : f === 'low' ? stats.lowCount
                          : stats.healthyCount})
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={balanceSearch}
                  onChange={e => setBalanceSearch(e.target.value)}
                  placeholder="Search member..."
                  className="pl-9 pr-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 border-none outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-48"
                />
              </div>
            </div>

            {/* WhatsApp reminder button */}
            {isAdmin && lowBalanceMembers.length > 0 && (
              <Button
                onClick={() => setShowRemindersModal(true)}
                className="!bg-green-600 hover:!bg-green-700 !text-white"
                size="sm"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Send Reminders ({lowBalanceMembers.length})
              </Button>
            )}

            {/* Balance table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Member</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Last Deposit</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Matches Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBalances.map((mb, idx) => (
                        <tr
                          key={mb.member.id}
                          className={`border-b border-gray-100 dark:border-gray-800 ${
                            idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                                {mb.member.avatar_url ? (
                                  <img
                                    src={mb.member.avatar_url}
                                    alt={mb.member.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-white">
                                    {mb.member.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{mb.member.name}</p>
                                <p className="text-xs text-gray-400">{mb.member.matches_played} matches</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${
                              mb.status === 'critical' ? 'text-red-600 dark:text-red-400' :
                              mb.status === 'low' ? 'text-amber-600 dark:text-amber-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              {mb.member.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <Badge
                              variant={mb.status === 'critical' ? 'danger' : mb.status === 'low' ? 'warning' : 'success'}
                              size="sm"
                            >
                              {mb.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500 hidden md:table-cell">
                            {mb.lastDepositDate
                              ? new Date(mb.lastDepositDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500 hidden md:table-cell">
                            {mb.matchesSinceDeposit > 0 ? mb.matchesSinceDeposit : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredBalances.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    No members match the filter.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Match Day Message Modal */}
      {showMatchDayModal && matchDayMatch && (
        <MatchDayMessageModal
          isOpen={showMatchDayModal}
          onClose={() => { setShowMatchDayModal(false); setMatchDayMatch(null); }}
          match={matchDayMatch}
          members={members}
        />
      )}

      {/* WhatsApp Reminders Modal */}
      <WhatsAppRemindersModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        members={lowBalanceMembers}
        threshold={500}
      />
    </div>
  );
}
