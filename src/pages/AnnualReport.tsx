import { useMemo, useState } from 'react';
import { useOpponentIncome } from '../hooks/useOpponentIncome';
import { useSeasonFund } from '../hooks/useSeasonFund';
import { Card } from '../components/ui/Card';
import { Printer, IndianRupee, TrendingUp, TrendingDown, Users, Calendar, ChevronDown, Lock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useTransactions } from '../hooks/useTransactions';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAuth } from '../context/AuthContext';

export function AnnualReport() {
  const { byDate: opponentByDate } = useOpponentIncome();
  const { seasons } = useSeasonFund();
  const { isAdmin } = useAuth();
  const { transactions } = useTransactions();
  const { members } = useMembers();
  const { matches } = useMatches();

  if (!isAdmin) {
    return (
      <div>
        <Header title="Annual Report" subtitle="Admin only" />
        <div className="p-8 max-w-md mx-auto mt-12">
          <Card className="p-8 text-center">
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
          </Card>
        </div>
      </div>
    );
  }

  /**
   * What the report can cover.
   *
   * A calendar year cuts a cricket season in half — Oct-to-May straddles two
   * of them, so "FY 2026" mixes the back end of one season with the front of
   * the next and belongs to neither. Seasons come first because that's the
   * unit the club actually thinks and talks in; the FY view stays for anyone
   * reconciling against a bank statement.
   */
  interface Period { key: string; label: string; start: string; end: string }

  const periods = useMemo<Period[]>(() => {
    const out: Period[] = seasons.map(s => ({
      key: `season-${s.id}`,
      label: s.name,
      start: s.start_date,
      end: s.end_date,
    }));
    const set = new Set<number>();
    transactions.forEach(t => set.add(new Date(t.date).getFullYear()));
    matches.forEach(m => set.add(new Date(m.date).getFullYear()));
    Array.from(set).sort((a, b) => b - a).forEach(y => out.push({
      key: `fy-${y}`, label: `FY ${y}`, start: `${y}-01-01`, end: `${y}-12-31`,
    }));
    return out.length ? out : [{
      key: 'fy-now', label: `FY ${new Date().getFullYear()}`,
      start: `${new Date().getFullYear()}-01-01`, end: `${new Date().getFullYear()}-12-31`,
    }];
  }, [seasons, transactions, matches]);

  const [periodKey, setPeriodKey] = useState<string>('');
  const period = periods.find(p => p.key === periodKey) ?? periods[0];

  const data = useMemo(() => {
    const start = period.start;
    const end = period.end;
    const yearTxns = transactions.filter(t => t.date >= start && t.date <= end);
    const yearMatches = matches.filter(m => m.date >= start && m.date <= end);

    const deposits = yearTxns.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const matchFees = yearTxns.filter(t => t.type === 'match_fee').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // ── Booking income ───────────────────────────────────────────────────────
    // Teams paying to play SCC is real cash in, and none of it was reaching
    // this page: those payments never became transactions, so an annual report
    // was understating the club's income by every rupee opponents had paid.
    // Read from the bookings themselves, and only what's VERIFIED — an agreed
    // booking is not money until it lands.
    let bookingIncome = 0;
    let bookingDue = 0;
    for (const [date, day] of opponentByDate) {
      if (date >= start && date <= end) {
        bookingIncome += day.paid;
        bookingDue += day.amount - day.paid;    // agreed, not yet received
      }
    }

    // ── Money paid OUT to another club ───────────────────────────────────────
    // The CricBot slots: SCC paid them for ground, rather than being paid to
    // play. Netting it against booking income is the only way "what we made
    // from opponents" means anything — otherwise the page shows ₹56,000 coming
    // in and quietly omits ₹28,000 going the other way.
    const paidToOpponents = (seasons.flatMap(s => s.bookings ?? []))
      .filter(b => b.date >= start && b.date <= end
        && (b as { prepaid_by?: string | null }).prepaid_by)
      .reduce((sum, b) => sum + Number(b.cost), 0);

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

    // Match summary — external matches only (internal Dhurandars vs Bazigars
    // are SCC vs SCC and don't represent club performance)
    const completed = yearMatches.filter(m => m.match_type !== 'internal' && ['won', 'lost', 'draw'].includes(m.result));
    const won = completed.filter(m => m.result === 'won').length;
    const lost = completed.filter(m => m.result === 'lost').length;
    const drawn = completed.filter(m => m.result === 'draw').length;

    return {
      deposits, expenses, matchFees, bookingIncome, bookingDue, paidToOpponents,
      // Net flow is real money in minus real money out. Booking income is as
      // real as a deposit — it just came from another club rather than a member.
      net: deposits + bookingIncome - expenses,
      yearTxns: yearTxns.length,
      topContributors,
      topCategories,
      matchesPlayed: completed.length,
      won, lost, drawn,
    };
  }, [period, transactions, matches, members]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div>
      <Header title="Annual Report" subtitle={`${period.label} · P&L Summary`} />

      <div className="p-4 lg:p-8 space-y-5 print:p-0">

        {/* ── Toolbar (hidden in print) ───────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="relative">
            <select
              value={period.key}
              onChange={e => setPeriodKey(e.target.value)}
              className="appearance-none pl-3 pr-9 py-2 r-control border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-sm cursor-pointer"
            >
              {periods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 r-control bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm shadow-md"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>

        {/* ── Print-only header ───────────────────────────────────────────────── */}
        <div className="hidden print:block border-b-2 border-gray-300 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <img src="/scc-logo.jpg" alt="SCC" className="w-14 h-14 r-card" />
            <div>
              <h1 className="text-2xl font-black">Sangria Cricket Club</h1>
              <p className="text-sm text-gray-600">Annual Report · {period.label}</p>
              <p className="text-xs text-gray-500">Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:gap-2">
          <div className="r-card p-5 print:border print:border-gray-300"
               style={{ background: 'linear-gradient(135deg, #065f46 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-emerald-300/80 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="t-micro font-bold uppercase tracking-[1.5px]">Deposits</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{fmt(data.deposits)}</p>
          </div>
          {/* Money from other clubs. Was missing entirely, which made every
              annual report understate income by whatever opponents had paid. */}
          <div className="r-card p-5"
               style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-blue-300/80 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="t-micro font-bold uppercase tracking-[1.5px]">Booking Income</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">
              {fmt(data.bookingIncome)}
            </p>
            <p className="t-micro text-blue-200/50 mt-1.5">Teams paying to play us</p>
          </div>

          <div className="r-card p-5"
               style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-red-300/80 mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="t-micro font-bold uppercase tracking-[1.5px]">Expenses</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{fmt(data.expenses)}</p>
          </div>
          <div className="r-card p-5"
               style={{ background: data.net >= 0
                 ? 'linear-gradient(135deg, #14532d 0%, #0a1019 100%)'
                 : 'linear-gradient(135deg, #7c2d12 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-amber-300/80 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="t-micro font-bold uppercase tracking-[1.5px]">Net Flow</span>
            </div>
            <p className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${data.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {data.net >= 0 ? '+' : '−'}{fmt(Math.abs(data.net))}
            </p>
          </div>
        </div>

        {/* ── The opponent ledger ──────────────────────────────────────────
            "We received ₹56,000 from bookings" is only half a sentence while
            ₹28,000 went the other way to CricBot. Both directions, and the
            difference, on one card — so nobody has to hold two numbers from
            two pages in their head to work out what playing other clubs
            actually earned. */}
        {(data.bookingIncome > 0 || data.paidToOpponents > 0) && (
          <div className="mt-3 r-card p-5"
               style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0a1019 100%)' }}>
            <div className="flex items-center gap-1.5 text-teal-300/80 mb-3">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="t-micro font-bold uppercase tracking-[1.5px]">
                Opponents · in and out
              </span>
            </div>

            <div className="space-y-1.5 t-body">
              <div className="flex justify-between text-white/85">
                <span>Teams paid us to play</span>
                <span className="tabular-nums text-emerald-300">+{fmt(data.bookingIncome)}</span>
              </div>
              {data.paidToOpponents > 0 && (
                <div className="flex justify-between text-white/85">
                  <span>We paid CricBot XI for ground</span>
                  <span className="tabular-nums text-red-300">−{fmt(data.paidToOpponents)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-1 border-t border-white/15 font-black">
                <span className="text-white">Net from opponents</span>
                <span className={`tabular-nums ${
                  data.bookingIncome - data.paidToOpponents >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {data.bookingIncome - data.paidToOpponents >= 0 ? '+' : '−'}
                  {fmt(Math.abs(data.bookingIncome - data.paidToOpponents))}
                </span>
              </div>
            </div>

            {data.bookingDue > 0 && (
              <p className="t-meta text-amber-300/80 mt-3">
                {fmt(data.bookingDue)} more agreed but not yet received — not counted above.
              </p>
            )}
            {data.paidToOpponents > 0 && (
              <p className="t-micro text-teal-200/50 mt-2 leading-snug">
                The CricBot payment was made by Avinash personally, so the club still
                owes him that amount — see the season page.
              </p>
            )}
          </div>
        )}

        {/* ── Match fees — deliberately NOT in the row above ────────────────
            Deposits, expenses and net flow are one story: money in, money out,
            the difference. Match fees is a different KIND of number — it moves
            from a member's wallet to the club, so it is neither new money nor
            money leaving. Sitting in the same row of four it invited arithmetic
            that cannot work, which is why fees exceeding deposits looked like a
            bug rather than a normal year. */}
        <div className="mt-3 r-card p-5"
             style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)' }}>
          <div className="flex items-center gap-1.5 text-blue-300/80 mb-1">
            <IndianRupee className="w-3.5 h-3.5" />
            <span className="t-micro font-bold uppercase tracking-[1.5px]">
              Match fees collected · internal transfer
            </span>
          </div>
          <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">
            {fmt(data.matchFees)}
          </p>
          <p className="t-meta text-blue-200/60 mt-2 leading-snug">
            Moved from member wallets to the club, so it is not counted in net
            flow — that would double-count money already recorded as a deposit.
            It can exceed deposits in a year when members spend balance they
            topped up in an earlier one.
          </p>
        </div>

        {/* Net flow, shown as its workings so the sign needs no explaining. */}
        <p className="mt-3 t-meta text-gray-400 text-center">
          Net flow = deposits {fmt(data.deposits)}
          {data.bookingIncome > 0 && <> + bookings {fmt(data.bookingIncome)}</>}
          {' '}− expenses {fmt(data.expenses)}
          {' '}= <span className={data.net >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            {data.net >= 0 ? '+' : '−'}{fmt(Math.abs(data.net))}
          </span>
        </p>

        {/* ── Match summary ───────────────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary-500" />
            Match Performance · {period.label}
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{data.matchesPlayed}</p>
              <p className="t-micro uppercase tracking-wider text-gray-500 mt-0.5">Played</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600">{data.won}</p>
              <p className="t-micro uppercase tracking-wider text-gray-500 mt-0.5">Won</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-600">{data.lost}</p>
              <p className="t-micro uppercase tracking-wider text-gray-500 mt-0.5">Lost</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600">{data.drawn}</p>
              <p className="t-micro uppercase tracking-wider text-gray-500 mt-0.5">No Result</p>
            </div>
          </div>
        </Card>

        {/* ── Two columns: Top contributors + Top expense categories ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2">
          <Card className="p-5">
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
                    <span className="w-6 h-6 r-card flex items-center justify-center t-micro font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{c.member!.name}</span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
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
                    <span className="w-6 h-6 r-card flex items-center justify-center t-micro font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{c.category}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
