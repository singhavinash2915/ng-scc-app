import { useState, useMemo } from 'react';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Trash2,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  List,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useTransactions } from '../hooks/useTransactions';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';

type TabType = 'transactions' | 'monthly' | 'reports';

interface MonthlyData {
  month: string;
  year: number;
  monthIndex: number;
  deposits: number;
  matchFees: number;
  expenses: number;
  netFlow: number;
  transactionCount: number;
}

export function Finance() {
  const { transactions, loading, addExpense, deleteTransaction, fetchTransactions } = useTransactions();
  const { members, addFunds, updateMember } = useMembers();
  const { isAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('transactions');

  // Transaction filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'match_fee' | 'expense'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [depositData, setDepositData] = useState({
    memberId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    transaction: typeof transactions[0] | null;
  }>({ show: false, transaction: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Generate list of months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Get month label
  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  // Overall stats
  const stats = useMemo(() => {
    const totalDeposits = transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalMatchFees = transactions
      .filter(t => t.type === 'match_fee')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const clubFunds = members.reduce((sum, m) => sum + m.balance, 0);

    return {
      totalDeposits,
      totalMatchFees,
      totalExpenses,
      clubFunds,
    };
  }, [transactions, members]);

  // Monthly data for dashboard and reports
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, MonthlyData>();

    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, {
          month: date.toLocaleDateString('en-IN', { month: 'short' }),
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          deposits: 0,
          matchFees: 0,
          expenses: 0,
          netFlow: 0,
          transactionCount: 0,
        });
      }

      const data = dataMap.get(monthKey)!;
      data.transactionCount++;

      if (t.type === 'deposit') {
        data.deposits += t.amount;
        data.netFlow += t.amount;
      } else if (t.type === 'match_fee') {
        data.matchFees += Math.abs(t.amount);
        // Match fees are internal balance deductions, not real cash out
      } else if (t.type === 'expense') {
        data.expenses += Math.abs(t.amount);
        data.netFlow += t.amount;
      }
    });

    return Array.from(dataMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => ({ key, ...data }));
  }, [transactions]);

  // Selected month stats for monthly tab
  const selectedMonthStats = useMemo(() => {
    if (selectedMonth === 'all') {
      return {
        deposits: stats.totalDeposits,
        matchFees: stats.totalMatchFees,
        expenses: stats.totalExpenses,
        netFlow: stats.totalDeposits - stats.totalExpenses,
      };
    }

    const data = monthlyData.find(m => m.key === selectedMonth);
    return data || { deposits: 0, matchFees: 0, expenses: 0, netFlow: 0 };
  }, [selectedMonth, monthlyData, stats]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchesSearch =
        txn.description?.toLowerCase().includes(search.toLowerCase()) ||
        txn.member?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || txn.type === typeFilter;

      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        const date = new Date(txn.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = monthKey === selectedMonth;
      }

      return matchesSearch && matchesType && matchesMonth;
    });
  }, [transactions, search, typeFilter, selectedMonth]);

  // Calculate month-over-month change for reports
  const monthlyComparison = useMemo(() => {
    if (monthlyData.length < 2) return null;

    const current = monthlyData[0];
    const previous = monthlyData[1];

    const depositsChange = previous.deposits > 0
      ? ((current.deposits - previous.deposits) / previous.deposits) * 100
      : current.deposits > 0 ? 100 : 0;

    const expensesChange = previous.expenses > 0
      ? ((current.expenses - previous.expenses) / previous.expenses) * 100
      : current.expenses > 0 ? 100 : 0;

    return {
      current,
      previous,
      depositsChange,
      expensesChange,
    };
  }, [monthlyData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const amount = parseFloat(expenseData.amount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await addExpense(amount, expenseData.description || 'Ad-hoc expense', expenseData.date);
      setShowExpenseModal(false);
      setExpenseData({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error('Failed to add expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const amount = parseFloat(depositData.amount);
    if (isNaN(amount) || amount <= 0 || !depositData.memberId) return;

    setIsSubmitting(true);
    try {
      await addFunds(depositData.memberId, amount, depositData.description || 'Fund deposit', depositData.date);
      // Refresh transactions to show the new deposit
      await fetchTransactions();
      setShowDepositModal(false);
      setDepositData({ memberId: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error('Failed to add deposit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!isAdmin || !deleteConfirm.transaction) return;

    const txn = deleteConfirm.transaction;
    setIsDeleting(true);

    try {
      // If it's a deposit, we need to reverse the member's balance
      if (txn.type === 'deposit' && txn.member_id) {
        const member = members.find(m => m.id === txn.member_id);
        if (member) {
          const newBalance = member.balance - txn.amount;
          await updateMember(txn.member_id, { balance: newBalance });
        }
      }

      // If it's a match_fee (negative), we need to add the amount back
      if (txn.type === 'match_fee' && txn.member_id) {
        const member = members.find(m => m.id === txn.member_id);
        if (member) {
          const newBalance = member.balance - txn.amount; // txn.amount is negative, so this adds back
          await updateMember(txn.member_id, { balance: newBalance });
        }
      }

      // Delete the transaction
      await deleteTransaction(txn.id);
      setDeleteConfirm({ show: false, transaction: null });
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getTransactionIcon = (_type: string, amount: number) => {
    if (amount >= 0) {
      return (
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <ArrowUpRight className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
      );
    }
    return (
      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
        <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
      </div>
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return <Badge variant="success">Deposit</Badge>;
      case 'match_fee':
        return <Badge variant="info">Match Fee</Badge>;
      case 'expense':
        return <Badge variant="warning">Expense</Badge>;
      case 'refund':
        return <Badge variant="default">Refund</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (direction === 'prev' && currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Finance" subtitle="Manage club funds and transactions" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Overall Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Club Funds</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₹{stats.clubFunds.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Deposits</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₹{stats.totalDeposits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <IndianRupee className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Match Fees</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₹{stats.totalMatchFees.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₹{stats.totalExpenses.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'transactions'
                ? 'text-primary-600 border-primary-500'
                : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <List className="w-4 h-4" />
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'monthly'
                ? 'text-primary-600 border-primary-500'
                : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Monthly Dashboard
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'reports'
                ? 'text-primary-600 border-primary-500'
                : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            {/* Filters and Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input pl-10 w-full sm:w-48"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{getMonthLabel(month)}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                  className="input pl-10 w-full sm:w-44"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">Deposits</option>
                  <option value="match_fee">Match Fees</option>
                  <option value="expense">Expenses</option>
                </select>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button onClick={() => setShowDepositModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Deposit
                  </Button>
                  <Button variant="secondary" onClick={() => setShowExpenseModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </div>
              )}
            </div>

            {/* Month Summary when filtered */}
            {selectedMonth !== 'all' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-sm text-green-600 dark:text-green-400">Deposits</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">
                    +₹{selectedMonthStats.deposits.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p className="text-sm text-purple-600 dark:text-purple-400">Match Fees</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                    -₹{selectedMonthStats.matchFees.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">Expenses</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">
                    -₹{selectedMonthStats.expenses.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className={`p-4 rounded-xl ${selectedMonthStats.netFlow >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                  <p className={`text-sm ${selectedMonthStats.netFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>Net Flow</p>
                  <p className={`text-xl font-bold ${selectedMonthStats.netFlow >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {selectedMonthStats.netFlow >= 0 ? '+' : ''}₹{selectedMonthStats.netFlow.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            )}

            {/* Transactions List */}
            <Card>
              <CardContent className="p-0">
                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No transactions found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTransactions.map(txn => (
                      <div key={txn.id} className="px-6 py-4 flex items-center gap-4">
                        {getTransactionIcon(txn.type, txn.amount)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {txn.description || txn.type}
                            </p>
                            {getTypeBadge(txn.type)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {txn.member?.name || 'Club'} •{' '}
                            {new Date(txn.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span
                          className={`text-lg font-bold ${
                            txn.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                          }`}
                        >
                          {txn.amount >= 0 ? '+' : ''}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirm({ show: true, transaction: txn })}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Monthly Dashboard Tab */}
        {activeTab === 'monthly' && (
          <>
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Breakdown</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  disabled={selectedMonth === 'all' || availableMonths.indexOf(selectedMonth) === availableMonths.length - 1}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input w-48"
                >
                  <option value="all">All Time</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{getMonthLabel(month)}</option>
                  ))}
                </select>
                <button
                  onClick={() => navigateMonth('next')}
                  disabled={selectedMonth === 'all' || availableMonths.indexOf(selectedMonth) === 0}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Monthly Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                    <Badge variant="success">Income</Badge>
                  </div>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    ₹{selectedMonthStats.deposits.toLocaleString('en-IN')}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">Total Deposits</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <IndianRupee className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    <Badge variant="info">Match</Badge>
                  </div>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    ₹{selectedMonthStats.matchFees.toLocaleString('en-IN')}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">Match Fees Used</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingDown className="w-8 h-8 text-red-600 dark:text-red-400" />
                    <Badge variant="danger">Expense</Badge>
                  </div>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                    ₹{selectedMonthStats.expenses.toLocaleString('en-IN')}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">Other Expenses</p>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${selectedMonthStats.netFlow >= 0
                ? 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-800'
                : 'from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200 dark:border-orange-800'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Wallet className={`w-8 h-8 ${selectedMonthStats.netFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} />
                    <Badge variant={selectedMonthStats.netFlow >= 0 ? 'default' : 'warning'}>Net</Badge>
                  </div>
                  <p className={`text-3xl font-bold ${selectedMonthStats.netFlow >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {selectedMonthStats.netFlow >= 0 ? '+' : ''}₹{selectedMonthStats.netFlow.toLocaleString('en-IN')}
                  </p>
                  <p className={`text-sm mt-1 ${selectedMonthStats.netFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    Net Cash Flow
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly History List */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-3 font-medium">Month</th>
                        <th className="pb-3 font-medium text-right">Deposits</th>
                        <th className="pb-3 font-medium text-right">Match Fees</th>
                        <th className="pb-3 font-medium text-right">Expenses</th>
                        <th className="pb-3 font-medium text-right">Net Flow</th>
                        <th className="pb-3 font-medium text-right">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {monthlyData.map(data => (
                        <tr
                          key={data.key}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${
                            selectedMonth === data.key ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                          onClick={() => setSelectedMonth(data.key)}
                        >
                          <td className="py-3 font-medium">
                            {data.month} {data.year}
                          </td>
                          <td className="py-3 text-right text-green-600 dark:text-green-400">
                            +₹{data.deposits.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 text-right text-purple-600 dark:text-purple-400">
                            -₹{data.matchFees.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 text-right text-red-500">
                            -₹{data.expenses.toLocaleString('en-IN')}
                          </td>
                          <td className={`py-3 text-right font-semibold ${data.netFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'}`}>
                            {data.netFlow >= 0 ? '+' : ''}₹{data.netFlow.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 text-right text-gray-500">
                            {data.transactionCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {monthlyData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No monthly data available
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <>
            {/* Month-over-Month Comparison */}
            {monthlyComparison && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Month-over-Month Comparison
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Month */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300">
                          {monthlyComparison.current.month} {monthlyComparison.current.year}
                        </h4>
                        <Badge variant="info">Current</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Deposits</span>
                          <span className="font-medium text-green-600">+₹{monthlyComparison.current.deposits.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expenses</span>
                          <span className="font-medium text-red-500">-₹{(monthlyComparison.current.matchFees + monthlyComparison.current.expenses).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Net Flow</span>
                          <span className={`font-bold ${monthlyComparison.current.netFlow >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                            {monthlyComparison.current.netFlow >= 0 ? '+' : ''}₹{monthlyComparison.current.netFlow.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Previous Month */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300">
                          {monthlyComparison.previous.month} {monthlyComparison.previous.year}
                        </h4>
                        <Badge variant="default">Previous</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Deposits</span>
                          <span className="font-medium text-green-600">+₹{monthlyComparison.previous.deposits.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expenses</span>
                          <span className="font-medium text-red-500">-₹{(monthlyComparison.previous.matchFees + monthlyComparison.previous.expenses).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Net Flow</span>
                          <span className={`font-bold ${monthlyComparison.previous.netFlow >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                            {monthlyComparison.previous.netFlow >= 0 ? '+' : ''}₹{monthlyComparison.previous.netFlow.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trend Indicators */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                      monthlyComparison.depositsChange >= 0
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      {monthlyComparison.depositsChange >= 0 ? (
                        <ArrowUp className="w-6 h-6 text-green-600" />
                      ) : (
                        <ArrowDown className="w-6 h-6 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Deposits Change</p>
                        <p className={`font-bold text-lg ${monthlyComparison.depositsChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {monthlyComparison.depositsChange >= 0 ? '+' : ''}{monthlyComparison.depositsChange.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                      monthlyComparison.expensesChange <= 0
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      {monthlyComparison.expensesChange <= 0 ? (
                        <ArrowDown className="w-6 h-6 text-green-600" />
                      ) : (
                        <ArrowUp className="w-6 h-6 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Expenses Change</p>
                        <p className={`font-bold text-lg ${monthlyComparison.expensesChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {monthlyComparison.expensesChange >= 0 ? '+' : ''}{monthlyComparison.expensesChange.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Financial Summary */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Financial Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/10 rounded-xl">
                    <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                      ₹{stats.totalDeposits.toLocaleString('en-IN')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Total Deposits (All Time)</p>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/10 rounded-xl">
                    <p className="text-4xl font-bold text-red-500">
                      ₹{(stats.totalMatchFees + stats.totalExpenses).toLocaleString('en-IN')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Total Spent (All Time)</p>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 rounded-xl">
                    <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                      ₹{stats.clubFunds.toLocaleString('en-IN')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Current Balance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Expense Breakdown</h3>
                <div className="space-y-4">
                  {/* Match Fees vs Other Expenses */}
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-500">Match Fees</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full flex items-center justify-end px-2"
                        style={{
                          width: `${(stats.totalMatchFees + stats.totalExpenses) > 0
                            ? (stats.totalMatchFees / (stats.totalMatchFees + stats.totalExpenses)) * 100
                            : 0}%`
                        }}
                      >
                        <span className="text-xs text-white font-medium">
                          {((stats.totalMatchFees / (stats.totalMatchFees + stats.totalExpenses)) * 100 || 0).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-28 text-right font-medium">₹{stats.totalMatchFees.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-500">Other Expenses</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full flex items-center justify-end px-2"
                        style={{
                          width: `${(stats.totalMatchFees + stats.totalExpenses) > 0
                            ? (stats.totalExpenses / (stats.totalMatchFees + stats.totalExpenses)) * 100
                            : 0}%`
                        }}
                      >
                        <span className="text-xs text-white font-medium">
                          {((stats.totalExpenses / (stats.totalMatchFees + stats.totalExpenses)) * 100 || 0).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-28 text-right font-medium">₹{stats.totalExpenses.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg Monthly Deposit</p>
                      <p className="font-bold text-green-600">
                        ₹{monthlyData.length > 0
                          ? Math.round(monthlyData.reduce((sum, m) => sum + m.deposits, 0) / monthlyData.length).toLocaleString('en-IN')
                          : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg Monthly Expense</p>
                      <p className="font-bold text-red-500">
                        ₹{monthlyData.length > 0
                          ? Math.round(monthlyData.reduce((sum, m) => sum + m.matchFees + m.expenses, 0) / monthlyData.length).toLocaleString('en-IN')
                          : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Minus className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg Net Flow</p>
                      <p className="font-bold text-blue-600">
                        {monthlyData.length > 0
                          ? (Math.round(monthlyData.reduce((sum, m) => sum + m.netFlow, 0) / monthlyData.length) >= 0 ? '+' : '')
                          : ''}
                        ₹{monthlyData.length > 0
                          ? Math.round(monthlyData.reduce((sum, m) => sum + m.netFlow, 0) / monthlyData.length).toLocaleString('en-IN')
                          : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Months Tracked</p>
                      <p className="font-bold text-purple-600">
                        {monthlyData.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <Input
            label="Date *"
            type="date"
            value={expenseData.date}
            onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
            required
          />
          <Input
            label="Amount (₹) *"
            type="number"
            min="1"
            placeholder="Enter amount"
            value={expenseData.amount}
            onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
            required
          />
          <TextArea
            label="Description *"
            placeholder="e.g., Cricket balls, First aid kit, etc."
            value={expenseData.description}
            onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
            rows={3}
            required
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowExpenseModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Deposit Modal */}
      <Modal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} title="Add Deposit">
        <form onSubmit={handleAddDeposit} className="space-y-4">
          <Input
            label="Date *"
            type="date"
            value={depositData.date}
            onChange={(e) => setDepositData({ ...depositData, date: e.target.value })}
            required
          />
          <Select
            label="Member *"
            value={depositData.memberId}
            onChange={(e) => setDepositData({ ...depositData, memberId: e.target.value })}
            options={[
              { value: '', label: 'Select a member' },
              ...members.map(m => ({ value: m.id, label: `${m.name} (₹${m.balance})` })),
            ]}
            required
          />
          <Input
            label="Amount (₹) *"
            type="number"
            min="1"
            placeholder="Enter amount"
            value={depositData.amount}
            onChange={(e) => setDepositData({ ...depositData, amount: e.target.value })}
            required
          />
          <Input
            label="Description"
            placeholder="e.g., Monthly contribution"
            value={depositData.description}
            onChange={(e) => setDepositData({ ...depositData, description: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowDepositModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Deposit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, transaction: null })}
        title="Delete Transaction"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">This action cannot be undone</p>
              <p className="text-sm text-red-600 dark:text-red-300">
                {deleteConfirm.transaction?.type === 'deposit' && deleteConfirm.transaction?.member_id
                  ? `Member balance will be reduced by ₹${Math.abs(deleteConfirm.transaction?.amount || 0).toLocaleString('en-IN')}`
                  : deleteConfirm.transaction?.type === 'match_fee' && deleteConfirm.transaction?.member_id
                  ? `Member balance will be increased by ₹${Math.abs(deleteConfirm.transaction?.amount || 0).toLocaleString('en-IN')}`
                  : 'This transaction will be permanently deleted'}
              </p>
            </div>
          </div>

          {deleteConfirm.transaction && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Type:</span>
                <span className="font-medium capitalize">{deleteConfirm.transaction.type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className={`font-bold ${deleteConfirm.transaction.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {deleteConfirm.transaction.amount >= 0 ? '+' : ''}₹{Math.abs(deleteConfirm.transaction.amount).toLocaleString('en-IN')}
                </span>
              </div>
              {deleteConfirm.transaction.member?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Member:</span>
                  <span className="font-medium">{deleteConfirm.transaction.member.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Description:</span>
                <span className="font-medium truncate max-w-[200px]">{deleteConfirm.transaction.description || '-'}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteConfirm({ show: false, transaction: null })}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteTransaction}
              loading={isDeleting}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
