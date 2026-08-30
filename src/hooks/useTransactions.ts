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
      // PostgREST caps a plain select at 1000 rows and says nothing about it.
      // The ledger passed 1000 entries some time ago, so the oldest ones were
      // silently missing from every total computed off this hook — and from
      // everything the AI was told about club money.
      const PAGE = 1000;
      const all: Transaction[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            member:members(id, name),
            match:matches(id, venue, date)
          `)
          .order('date', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...((data || []) as Transaction[]));
        if (!data || data.length < PAGE) break;
      }
      setTransactions(all);
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

  const addExpense = async (
    amount: number, description: string, date?: string,
    /** Category and how it's consumed. Omitted on older callers, and on
     *  installs where the splitting migration hasn't run — see the retry. */
    meta?: { category?: string | null; expense_kind?: string | null },
  ) => {
    try {
      const row: Record<string, unknown> = {
        type: 'expense',
        amount: -Math.abs(amount),
        description,
        date: date || new Date().toISOString().split('T')[0],
      };
      if (meta?.category) row.category = meta.category;
      if (meta?.expense_kind) row.expense_kind = meta.expense_kind;

      let { data, error } = await supabase.from('transactions').insert([row]).select().single();

      // The splitting migration adds `category` and `expense_kind`. Without it
      // Postgres rejects the whole insert (42703) and the expense would simply
      // fail to save — losing the record entirely over a feature the admin may
      // not have switched on yet. Retry without them.
      if (error && (error as { code?: string }).code === '42703') {
        delete row.category; delete row.expense_kind;
        ({ data, error } = await supabase.from('transactions').insert([row]).select().single());
      }

      if (error) throw error;
      // Insert in correct position based on date
      setTransactions(prev => {
        const newTransactions = [data, ...prev];
        return newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
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
