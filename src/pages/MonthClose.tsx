import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Undo2, AlertTriangle, Check } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useMonthClose } from '../hooks/useMonthClose';
import { EXPENSE_CATEGORIES, categoryOf } from '../lib/expenseCategories';
import { supabase } from '../lib/supabase';

// ─── Month close ──────────────────────────────────────────────────────────────
// One screen an admin can hand to a core member: what the club spent this month
// on things other than the ground, who was around to use it, and exactly what
// each person's share works out to — before a single rupee moves.
//
// Nothing posts until Confirm, and anything posted can be undone.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const label = (p: string) =>
  new Date(p + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shift = (p: string, by: number) => {
  const d = new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function MonthClose() {
  const { isAdmin } = useAuth();
  const { members, fetchMembers } = useMembers();
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const M = useMonthClose(period);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tagging, setTagging] = useState(false);

  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <Header title="Month close" subtitle="Admins only" />
        <Card className="p-5"><p className="t-body text-slate-500">This page is for club admins.</p></Card>
      </div>
    );
  }

  if (M.needsMigration) {
    return (
      <div className="space-y-4">
        <Header title="Month close" subtitle="One migration to run first" />
        <Card className="p-5">
          <p className="font-black text-slate-900 dark:text-white">Not set up yet</p>
          <p className="t-body text-slate-500 dark:text-white/50 mt-1">
            Run <code className="t-meta">supabase/migrations/add_expense_splitting.sql</code> in the
            Supabase SQL editor, then reload.
          </p>
        </Card>
      </div>
    );
  }

  const p = M.plan;
  const closedRow = M.closed.find(c => c.period === period);

  const doPost = async () => {
    setBusy(true); setMsg(null);
    const res = await M.post({});
    setBusy(false); setConfirming(false);
    if (res.ok) { setMsg(`Posted — ${res.rows} members charged.`); void fetchMembers(); }
    else setMsg(`Could not post: ${res.error}`);
  };

  const doUndo = async () => {
    setBusy(true); setMsg(null);
    const res = await M.undo();
    setBusy(false);
    if (res.ok) { setMsg('Undone — balances restored.'); void fetchMembers(); }
    else setMsg(`Could not undo: ${res.error}`);
  };

  return (
    <div className="space-y-4">
      <Header title="Month close" subtitle="Split the month's club costs" />

      {/* ── Month picker ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setPeriod(shift(period, -1))}
            className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                       flex items-center justify-center" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="font-display font-extrabold text-slate-900 dark:text-white">{label(period)}</p>
            {M.isClosed && (
              <p className="t-micro font-black uppercase tracking-wider text-emerald-600
                            dark:text-emerald-400 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> closed
              </p>
            )}
          </div>
          <button onClick={() => setPeriod(shift(period, 1))}
            className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                       flex items-center justify-center" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['Club costs', inr(p.pot)],
            ['Appearances', String(p.appearances)],
            ['Per match', p.appearances ? `₹${p.perAppearance.toFixed(2)}` : '—']].map(([k, v]) => (
            <div key={k} className="r-control bg-slate-50 dark:bg-white/5 py-2.5 text-center">
              <p className="t-num text-lg text-slate-900 dark:text-white leading-none">{v}</p>
              <p className="t-micro text-slate-400 mt-0.5">{k}</p>
            </div>
          ))}
        </div>
      </Card>

      {msg && (
        <div className="r-card border border-slate-200 dark:border-white/10 p-3">
          <p className="t-body font-semibold text-slate-700 dark:text-white/80">{msg}</p>
        </div>
      )}

      {/* ── Untagged expenses ───────────────────────────────────────────
          An expense with no category never reaches the pot. Before this the
          admin had no way to know that — the month just looked empty. */}
      {M.untagged.length > 0 && (
        <Card className="p-4 border-amber-200 dark:border-amber-400/25">
          <p className="t-micro font-black uppercase tracking-[1.5px] text-amber-700
                        dark:text-amber-300 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {M.untagged.length} expense
            {M.untagged.length === 1 ? '' : 's'} not categorised
          </p>
          <p className="t-meta text-slate-500 dark:text-white/50 mt-1">
            These are in {label(period)} but won't be split until you say what they were for.
          </p>
          <div className="mt-3 space-y-3">
            {M.untagged.map(u => (
              <div key={u.id} className="r-control border border-slate-200 dark:border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold t-body text-slate-900 dark:text-white truncate">
                    {u.description || 'Expense'}
                  </p>
                  <p className="t-num text-sm shrink-0">{inr(u.amount)}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {EXPENSE_CATEGORIES.map(c => (
                    <button key={c.key} disabled={tagging}
                      onClick={async () => {
                        setTagging(true);
                        await supabase.from('transactions')
                          .update({ category: c.key, expense_kind: c.kind })
                          .eq('id', u.id);
                        await M.refetch();
                        setTagging(false);
                      }}
                      className="text-left px-2.5 py-1.5 r-control border border-slate-200
                                 dark:border-white/10 t-micro font-bold
                                 text-slate-700 dark:text-white/80 disabled:opacity-40">
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── What's in the pot ── */}
      <Card className="p-4">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
          What's in the pot
        </p>
        {p.lines.length === 0 ? (
          <p className="t-body text-slate-500 dark:text-white/50 mt-2">
            No splittable costs this month. Mark an expense as <em>consumable</em> or
            <em> season item</em> in Finance for it to appear here — ground payments
            stay out, they're covered by match fees.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
            {p.lines.map(l => (
              <div key={l.expense.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold t-body text-slate-900 dark:text-white truncate">
                    {l.expense.description || l.expense.category || 'Expense'}
                  </p>
                  <p className="t-micro text-slate-400">
                    {categoryOf(l.expense.category)?.label ?? 'Other'} ·{' '}
                    {l.expense.kind === 'season_item'
                      ? `season item · ${inr(l.expense.amount)} spread over the season`
                      : `used this month · ${inr(l.expense.amount)}`}
                  </p>
                </div>
                <p className="t-num text-sm text-slate-900 dark:text-white">{inr(l.slice)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Who pays what ── */}
      {p.shares.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
              Who pays what
            </p>
            <p className="t-micro text-slate-400">{p.shares.length} members</p>
          </div>
          <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10 max-h-96 overflow-y-auto">
            {p.shares.map(s => {
              const m = byId.get(s.memberId);
              const after = (Number(m?.balance) || 0) - (M.isClosed ? 0 : s.amount);
              return (
                <div key={s.memberId} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold t-body text-slate-900 dark:text-white truncate">
                      {m?.name ?? 'Unknown'}
                    </p>
                    <p className="t-micro text-slate-400">
                      {s.appearances} match{s.appearances === 1 ? '' : 'es'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="t-num text-sm text-slate-900 dark:text-white">{inr(s.amount)}</p>
                    {/* Seeing who this pushes into the red BEFORE posting is the
                        point — it's a conversation to have first, not after. */}
                    <p className={`t-micro ${after < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                      {M.isClosed ? 'balance' : 'after'} {inr(after)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-3 mt-1 border-t
                          border-slate-100 dark:border-white/10">
            <p className="t-meta font-black text-slate-500">Total charged</p>
            <p className="t-num text-slate-900 dark:text-white">
              {inr(p.shares.reduce((s, x) => s + x.amount, 0))}
            </p>
          </div>
        </Card>
      )}

      {/* ── Post / undo ── */}
      {p.pot > 0 && p.appearances === 0 && (
        <div className="r-card border border-amber-200 dark:border-amber-400/25
                        bg-amber-50/70 dark:bg-amber-500/10 p-4">
          <p className="font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Nobody played this month
          </p>
          <p className="t-meta text-slate-600 dark:text-white/60 mt-1">
            There's {inr(p.pot)} to split and no appearances to split it across. Leave the month
            open — the cost rolls into the next month with cricket in it.
          </p>
        </div>
      )}

      {!M.isClosed && p.shares.length > 0 && (
        confirming ? (
          <div className="r-card border border-slate-200 dark:border-white/10 p-4">
            <p className="font-black text-slate-900 dark:text-white">
              Charge {p.shares.length} members {inr(p.pot)} for {label(period)}?
            </p>
            <p className="t-meta text-slate-500 dark:text-white/50 mt-1">
              This moves money out of wallets. It can be undone.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setConfirming(false)}
                className="px-4 py-2.5 r-control border border-slate-200 dark:border-white/10
                           t-meta font-black text-slate-500">Cancel</button>
              <button onClick={() => void doPost()} disabled={busy}
                className="flex-1 py-2.5 r-control bg-emerald-500 text-white t-meta font-black
                           disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />{busy ? 'Posting…' : 'Yes, charge them'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="w-full py-3 r-control bg-emerald-500 text-white font-black
                       inline-flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> Close {label(period)}
          </button>
        )
      )}

      {M.isClosed && (
        <div className="space-y-2">
          <p className="t-meta text-slate-500 dark:text-white/50 px-1">
            Closed {closedRow ? new Date(closedRow.closed_at).toLocaleDateString('en-GB') : ''} ·
            {' '}{inr(closedRow?.misc_total ?? 0)} across {closedRow?.appearances ?? 0} appearances.
          </p>
          <button onClick={() => void doUndo()} disabled={busy}
            className="w-full py-2.5 r-control border border-rose-200 dark:border-rose-400/25
                       text-rose-600 dark:text-rose-400 t-meta font-black
                       inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Undo2 className="w-4 h-4" />{busy ? 'Undoing…' : 'Undo this month'}
          </button>
        </div>
      )}
    </div>
  );
}
