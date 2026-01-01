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

export function Finance() {
  const { transactions, loading, addExpense, deleteTransaction } = useTransactions();
  const { members, addFunds, updateMember } = useMembers();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'match_fee' | 'expense'>('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
  });

  const [depositData, setDepositData] = useState({
    memberId: '',
    amount: '',
    description: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    transaction: typeof transactions[0] | null;
  }>({ show: false, transaction: null });
  const [isDeleting, setIsDeleting] = useState(false);

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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchesSearch =
        txn.description?.toLowerCase().includes(search.toLowerCase()) ||
        txn.member?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || txn.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, typeFilter]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const amount = parseFloat(expenseData.amount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await addExpense(amount, expenseData.description || 'Ad-hoc expense');
      setShowExpenseModal(false);
      setExpenseData({ amount: '', description: '' });
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
      await addFunds(depositData.memberId, amount, depositData.description || 'Fund deposit');
      setShowDepositModal(false);
      setDepositData({ memberId: '', amount: '', description: '' });
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
        {/* Stats Cards */}
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
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense">
        <form onSubmit={handleAddExpense} className="space-y-4">
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
