import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Transaction } from '../types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          member:members(id, name),
          match:matches(id, venue, date)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'member' | 'match'>) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select(`
          *,
          member:members(id, name),
          match:matches(id, venue, date)
        `)
        .single();

      if (error) throw error;
      setTransactions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add transaction');
    }
  };

  const addExpense = async (amount: number, description: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          type: 'expense',
          amount: -Math.abs(amount),
          description,
        }])
        .select()
        .single();

      if (error) throw error;
      setTransactions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add expense');
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete transaction');
    }
  };

  const getTotalFunds = () => {
    return transactions.reduce((total, t) => total + t.amount, 0);
  };

  const getMemberTransactions = (memberId: string) => {
    return transactions.filter(t => t.member_id === memberId);
  };

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    addTransaction,
    addExpense,
    deleteTransaction,
    getTotalFunds,
    getMemberTransactions,
  };
}
