import { useMemo, useState } from 'react';
import { Printer, IndianRupee, TrendingUp, TrendingDown, Users, Calendar, ChevronDown, Lock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useTransactions } from '../hooks/useTransactions';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAuth } from '../context/AuthContext';

export function AnnualReport() {
  const { isAdmin } = useAuth();
  const { transactions } = useTransactions();
  const { members } = useMembers();
  const { matches } = useMatches();

  if (!isAdmin) {
    return (
      <div>
        <Header title="Annual Report" subtitle="Admin only" />
        <div className="p-8 max-w-md mx-auto mt-12">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-900">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Admin access required
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The Annual Report contains sensitive financial information.
              Please log in as an admin from the sidebar to view it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Available years (from transactions + matches)
  const years = useMemo(() => {
    const set = new Set<number>();
    transactions.forEach(t => set.add(new Date(t.date).getFullYear()));
    matches.forEach(m => set.add(new Date(m.date).getFullYear()));
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [new Date().getFullYear()];
  }, [transactions, matches]);

  const [year, setYear] = useState(years[0]);

  const data = useMemo(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const yearTxns = transactions.filter(t => t.date >= start && t.date <= end);
    const yearMatches = matches.filter(m => m.date >= start && m.date <= end);

    const deposits = yearTxns.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const matchFees = yearTxns.filter(t => t.type === 'match_fee').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // Top 10 contributors (by deposit amount this year)
    const byMember: Record<string, number> = {};
    yearTxns.filter(t => t.type === 'deposit' && t.member_id).forEach(t => {
      byMember[t.member_id!] = (byMember[t.member_id!] || 0) + Number(t.amount);
    });
    const topContributors = Object.entries(byMember)
      .map(([id, amt]) => ({ member: members.find(m => m.id === id), amount: amt }))
      .filter(x => x.member)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Expense breakdown by category (description first word, fallback to description)
    const byCategory: Record<string, number> = {};
    yearTxns.filter(t => t.type === 'expense').forEach(t => {
      const cat = (t.description || 'Other').split(/[-:]/)[0].trim().slice(0, 30) || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(Number(t.amount));
    });
    const topCategories = Object.entries(byCategory)
      .map(([cat, amt]) => ({ category: cat, amount: amt }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Match summary
    const completed = yearMatches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completed.filter(m => m.result === 'won').length;
    const lost = completed.filter(m => m.result === 'lost').length;
    const drawn = completed.filter(m => m.result === 'draw').length;

    return {
      deposits, expenses, matchFees,
      net: deposits - expenses,
      yearTxns: yearTxns.length,
      topContributors,
      topCategories,
      matchesPlayed: completed.length,
      won, lost, drawn,
    };
  }, [year, transactions, matches, members]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div>
      <Header title="Annual Report" subtitle={`Financial Year ${year} · P&L Summary`} />

      <div className="p-4 lg:p-8 space-y-5 print:p-0">

        {/* ── Toolbar (hidden in print) ───────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="relative">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-9 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-sm cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>FY {y}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm shadow-md"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>

        {/* ── Print-only header ───────────────────────────────────────────────── */}
        <div className="hidden print:block border-b-2 border-gray-300 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <img src="/scc-logo.jpg" alt="SCC" className="w-14 h-14 rounded-lg" />
            <div>
              <h1 className="text-2xl font-black">Sangria Cricket Club</h1>
              <p className="text-sm text-gray-600">Annual Report · Financial Year {year}</p>
              <p className="text-xs text-gray-500">Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:gap-2">
          <div className="rounded-2xl p-5 print:border print:border-gray-300"
               style={{ background: 'linear-gradient(135deg, #065f46 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-emerald-300/80 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]">Deposits</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{fmt(data.deposits)}</p>
          </div>
          <div className="rounded-2xl p-5"
               style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-red-300/80 mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]">Expenses</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{fmt(data.expenses)}</p>
          </div>
          <div className="rounded-2xl p-5"
               style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-blue-300/80 mb-1">
              <IndianRupee className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]">Match Fees</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{fmt(data.matchFees)}</p>
          </div>
          <div className="rounded-2xl p-5"
               style={{ background: data.net >= 0
                 ? 'linear-gradient(135deg, #14532d 0%, #0a1019 100%)'
                 : 'linear-gradient(135deg, #7c2d12 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-amber-300/80 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]">Net Flow</span>
            </div>
            <p className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${data.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {data.net >= 0 ? '+' : '−'}{fmt(Math.abs(data.net))}
            </p>
          </div>
        </div>

        {/* ── Match summary ───────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary-500" />
            Match Performance · {year}
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{data.matchesPlayed}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Played</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600">{data.won}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Won</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-600">{data.lost}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Lost</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600">{data.drawn}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Drawn</p>
            </div>
          </div>
        </div>

        {/* ── Two columns: Top contributors + Top expense categories ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-500" />
              Top Contributors
            </h3>
            {data.topContributors.length === 0 ? (
              <p className="text-sm text-gray-400">No deposits this year.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.topContributors.map((c, i) => (
                  <div key={c.member!.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{c.member!.name}</span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Top Expense Categories
            </h3>
            {data.topCategories.length === 0 ? (
              <p className="text-sm text-gray-400">No expenses this year.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.topCategories.map((c, i) => (
                  <div key={c.category} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{c.category}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-4 print:mt-8">
          {data.yearTxns} transactions · Generated by Sangria Cricket Club app
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm; }
          body { background: white !important; color: #111 !important; }
          [class*="bg-gradient"], [style*="linear-gradient"] {
            background: white !important;
            color: #111 !important;
            border: 1px solid #d1d5db !important;
          }
          [style*="linear-gradient"] * {
            color: #111 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default AnnualReport;
