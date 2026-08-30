import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { planMonth, periodOf, type SplittableExpense, type MonthPlan } from '../lib/expenseSplit';

// ─── Closing a month ──────────────────────────────────────────────────────────
// Loads the misc expenses and the appearances behind one month, plans the split
// without touching anything, and posts it in a single database call so a
// dropped connection can never leave half the club charged.

export interface ClosedMonth { period: string; closed_at: string; misc_total: number; appearances: number }

// 42P01 missing table, 42703 missing COLUMN, PGRST202 missing function.
// 42703 was the one that mattered and the one I left out: before the migration
// the table exists but the columns don't, so the page showed a cheerful "no
// splittable costs this month" instead of "you haven't run the migration".
const isMissing = (e: { code?: string } | null) =>
  !!e && ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code ?? '');

export function useMonthClose(period: string) {
  const [expenses, setExpenses] = useState<SplittableExpense[]>([]);
  const [appearances, setAppearances] = useState<Record<string, number>>({});
  const [closed, setClosed] = useState<ClosedMonth[]>([]);
  const [untagged, setUntagged] = useState<Array<{ id: string; amount: number; date: string; description: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // Every expense that could still be contributing a slice — a season item
    // bought in October is still being paid off the following August, so this
    // cannot be filtered to the month being closed.
    const { data: ex, error: exErr } = await supabase
      .from('transactions')
      .select('id, amount, date, description, category, expense_kind')
      .eq('type', 'expense')
      .order('date', { ascending: false })
      .limit(500);
    if (exErr && isMissing(exErr)) { setNeedsMigration(true); setLoading(false); return; }

    // Expenses in this month that nobody has categorised. Without surfacing
    // these the month simply looks empty and the admin has no way to find out
    // why — which is exactly how a "no splittable costs" screen lies.
    const first0 = `${period}-01`;
    const last0 = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)
      .toLocaleDateString('en-CA');
    setUntagged((ex ?? [])
      .filter(r => !r.expense_kind && !r.category)
      .filter(r => { const d = String(r.date).slice(0, 10); return d >= first0 && d <= last0; })
      .map(r => ({ id: r.id, amount: Math.abs(Number(r.amount) || 0),
                   date: String(r.date).slice(0, 10), description: r.description })));

    setExpenses((ex ?? [])
      // Only expenses an admin has marked for splitting. Ground payments are
      // funded by match fees and must never land in a misc pot.
      .filter(r => r.expense_kind === 'consumable' || r.expense_kind === 'season_item')
      .map(r => ({
        id: r.id, amount: Math.abs(Number(r.amount) || 0), date: String(r.date).slice(0, 10),
        kind: r.expense_kind as SplittableExpense['kind'],
        category: r.category, description: r.description,
      })));

    // Appearances in the month being closed.
    const first = `${period}-01`;
    const last = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)
      .toLocaleDateString('en-CA');
    const { data: ms } = await supabase.from('matches')
      .select('id').gte('date', first).lte('date', last);
    const ids = (ms ?? []).map(m => m.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: mp } = await supabase.from('match_players')
        .select('member_id, match_id').in('match_id', ids);
      for (const p of mp ?? []) counts[p.member_id] = (counts[p.member_id] ?? 0) + 1;
    }
    setAppearances(counts);

    const { data: cl } = await supabase.from('scc_month_close')
      .select('*').order('period', { ascending: false });
    setClosed((cl ?? []) as ClosedMonth[]);
    setLoading(false);
  }, [period]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const plan: MonthPlan = useMemo(
    () => planMonth(period, expenses, appearances), [period, expenses, appearances]);

  const isClosed = useMemo(
    () => closed.some(c => c.period === period), [closed, period]);

  const post = useCallback(async (names: Record<string, string>) => {
    const shares = plan.shares.map(s => ({
      member_id: s.memberId,
      amount: s.amount,
      note: `Share of ${period} club costs (${s.appearances} match${s.appearances === 1 ? '' : 'es'})`,
    }));
    void names;
    const { data, error } = await supabase.rpc('scc_post_month_split', {
      p_period: period, p_shares: shares,
      p_total: plan.pot, p_appearances: plan.appearances,
    });
    if (error) return { ok: false as const, error: error.message };
    await fetchAll();
    return { ok: true as const, rows: data as number };
  }, [plan, period, fetchAll]);

  const undo = useCallback(async () => {
    const { error } = await supabase.rpc('scc_undo_month_split', { p_period: period });
    if (error) return { ok: false as const, error: error.message };
    await fetchAll();
    return { ok: true as const };
  }, [period, fetchAll]);

  return { plan, expenses, untagged, appearances, closed, isClosed, loading, needsMigration,
           post, undo, refetch: fetchAll, periodOf };
}
