import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee, Trophy, Award, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent } from './ui/Card';
import { useTransactions } from '../hooks/useTransactions';
import type { Member } from '../types';

interface DashboardChartsProps {
  members: Member[];
  totalFunds: number;
  winRate: number;
  matchResultData: { name: string; value: number; color: string }[];
  isActive: (id: string) => boolean;
}

export function DashboardCharts({ members, totalFunds, winRate, matchResultData, isActive }: DashboardChartsProps) {
  const { transactions } = useTransactions();

  const monthlyFinanceData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const txns = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
      return {
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        deposits: txns.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
        expenses: txns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, [transactions]);

  const thisMonthFinance = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const txns = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
    return {
      deposits: txns.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
    };
  }, [transactions]);

  const topContributors = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    transactions.filter(t => t.type === 'deposit' && t.member).forEach(t => {
      const e = map.get(t.member!.id);
      if (e) e.total += t.amount; else map.set(t.member!.id, { name: t.member!.name, total: t.amount });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [transactions]);

  const avgBalance = useMemo(() => {
    const active = members.filter(m => isActive(m.id));
    return active.length ? Math.round(active.reduce((s, m) => s + m.balance, 0) / active.length) : 0;
  }, [members, isActive]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card delay={0}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
            <IndianRupee className="w-4 h-4 text-green-500" />
            Finance Pulse
          </h3>
          <Link to="/finance" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold group">
            Details <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <p className="text-lg font-black text-green-600 dark:text-green-400">₹{totalFunds >= 1000 ? `${(totalFunds / 1000).toFixed(1)}k` : totalFunds}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Club Bank</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">₹{thisMonthFinance.deposits >= 1000 ? `${(thisMonthFinance.deposits / 1000).toFixed(1)}k` : thisMonthFinance.deposits}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">This Month</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <p className="text-lg font-black text-purple-600 dark:text-purple-400">₹{avgBalance >= 1000 ? `${(avgBalance / 1000).toFixed(1)}k` : avgBalance}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Avg / Member</p>
            </div>
          </div>
          <div className="h-36" style={{ minHeight: 144, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyFinanceData} barSize={8} barGap={2}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 11 }}
                  formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, '']}
                />
                <Bar dataKey="deposits" fill="#22c55e" radius={[3, 3, 0, 0]} name="Deposits" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5 mt-1">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] text-gray-400">Deposits</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-gray-400">Expenses</span></div>
          </div>
        </CardContent>
      </Card>

      <Card delay={0}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-amber-500" />
            Results & Top Contributors
          </h3>
        </div>
        <CardContent className="p-4">
          <div className="flex gap-3 items-center mb-4">
            <div style={{ width: 140, minWidth: 140, height: 140 }}>
              {matchResultData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={matchResultData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                      {matchResultData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '8px', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">No matches yet</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              {matchResultData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-gray-800 dark:text-gray-200">{item.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-400">Win Rate</span>
                  <span className="text-[10px] font-black text-green-600">{Math.round(winRate)}%</span>
                </div>
              </div>
            </div>
          </div>
          {topContributors.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Award className="w-3 h-3" /> Top Contributors
              </p>
              <div className="space-y-2">
                {topContributors.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-orange-100 text-orange-700'}`}>{i + 1}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-bold text-green-600">₹{c.total.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardCharts;
