import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { seasonWindow, CURRENT_SEASON } from '../config/season';

/**
 * Lightweight hook that loads only this-month and this-season transaction
 * summaries so the Dashboard can render "This Month" and "this season ↑ X%"
 * cards without fetching the full transactions table.
 */
// The season start comes from the season config, not a literal. It was pinned
// at '2025-09-01', so every "this season" figure on the Dashboard was actually
// measuring two seasons — which is how club funds came to be reported as up
// 606% since the start of a season that began last week.
export function useMonthSummary(seasonStart = seasonWindow(CURRENT_SEASON).start) {
  const [data, setData] = useState({
    deposits: 0, expenses: 0, count: 0,
    seasonDeposits: 0, seasonExpenses: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // First of the current month in LOCAL time (toISOString would shift to
      // the previous day in IST and wrongly include last month's final day).
      const now = new Date();
      const monthStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // Fetch season deposit + expense transactions (covers this month + season).
      // We filter to these two types because match_fee/refund rows are the bulk
      // and would push the result past Supabase's 1000-row cap, silently
      // truncating the data (which made "This Month" under-count expenses).
      const { data: txns } = await supabase
        .from('transactions')
        .select('type, amount, date')
        .in('type', ['deposit', 'expense'])
        .gte('date', seasonStart)
        .limit(5000);

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

      // Money paid to the ground owner never touches the transactions table —
      // it lives in the payment ledger. Left out, "this month" reported ₹0 out
      // in a month the club paid ₹1,50,000 to Four Star, which is the single
      // biggest thing that happened to its money all season.
      //
      // Only the OUT side is topped up here. Member contributions are already
      // counted as wallet deposits — the same six September payments appear in
      // both tables by design — so adding the fund rows as well would count that
      // money twice.
      const { data: groundPays } = await supabase
        .from('ground_payments')
        .select('amount, date')
        .gte('date', seasonStart);
      const gp = (groundPays ?? []) as Array<{ amount: number; date: string }>;
      const seasonGround = gp.reduce((s, p) => s + Number(p.amount), 0);
      const monthGround = gp
        .filter(p => p.date >= monthStartDate)
        .reduce((s, p) => s + Number(p.amount), 0);

      if (cancelled) return;

      setData({
        deposits, expenses: expenses + monthGround, count: monthTxns.length,
        seasonDeposits, seasonExpenses: seasonExpenses + seasonGround,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [seasonStart]);

  return data;
}
