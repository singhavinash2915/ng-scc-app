import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Lightweight hook that loads only this-month and this-season transaction
 * summaries so the Dashboard can render "This Month" and "this season ↑ X%"
 * cards without fetching the full transactions table.
 */
export function useMonthSummary(seasonStart = '2025-09-01') {
  const [data, setData] = useState({
    deposits: 0, expenses: 0, count: 0,
    seasonDeposits: 0, seasonExpenses: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartDate = monthStart.toISOString().split('T')[0];

      // Fetch all season transactions once (covers both this month and season)
      const { data: txns } = await supabase
        .from('transactions')
        .select('type, amount, date')
        .gte('date', seasonStart);

      if (cancelled) return;

      if (!txns) {
        setData({
          deposits: 0, expenses: 0, count: 0,
          seasonDeposits: 0, seasonExpenses: 0,
          loading: false,
        });
        return;
      }

      // Season totals
      const seasonDeposits = txns
        .filter(t => t.type === 'deposit')
        .reduce((s, t) => s + Number(t.amount), 0);
      const seasonExpenses = txns
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

      // This month totals (filter in JS)
      const monthTxns = txns.filter(t => t.date >= monthStartDate);
      const deposits = monthTxns
        .filter(t => t.type === 'deposit')
        .reduce((s, t) => s + Number(t.amount), 0);
      const expenses = monthTxns
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

      setData({
        deposits, expenses, count: monthTxns.length,
        seasonDeposits, seasonExpenses,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [seasonStart]);

  return data;
}
