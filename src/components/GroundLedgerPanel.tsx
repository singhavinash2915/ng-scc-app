import { useState } from 'react';
import { Card } from './ui/Card';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Landmark, HandCoins, AlertTriangle } from 'lucide-react';
import { useGroundLedger } from '../hooks/useGroundLedger';
import type { Member } from '../types';

// ─── Where the ground money went, and who is still owed ───────────────────────
// Two questions a treasurer is asked and the app could not previously answer:
// how much has actually reached the ground owner, and who is out of pocket.

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const SOURCE_LABEL: Record<string, string> = {
  member_fund:    'Member contributions',
  opponent:       'Opponent bookings',
  member_advance: 'Fronted by a member',
  club_wallet:    'Club wallet',
};

const SOURCE_INK: Record<string, string> = {
  member_fund:    'text-emerald-600 dark:text-emerald-400',
  opponent:       'text-sky-600 dark:text-sky-400',
  member_advance: 'text-amber-600 dark:text-amber-400',
  club_wallet:    'text-violet-600 dark:text-violet-400',
};

interface Props {
  members: Member[];
  /** Total contracted with the ground owner, for the "of ₹X" line. */
  contracted?: number;
}

export function GroundLedgerPanel({ members, contracted }: Props) {
  const L = useGroundLedger();
  const { isAdmin } = useAuth();
  const [repayFor, setRepayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [pot, setPot] = useState<'opponent' | 'member_fund' | 'club_wallet'>('opponent');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const record = async (advanceId: string, max: number) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setErr('Enter an amount.');
    if (n > max) return setErr(`That's more than the ₹${max.toLocaleString('en-IN')} outstanding.`);
    setSaving(true); setErr(null);
    const { error } = await supabase.from('member_advance_repayments').insert({
      advance_id: advanceId,
      date: new Date().toLocaleDateString('en-CA'),
      amount: n,
      funded_by: pot,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setRepayFor(null); setAmount('');
    await L.refresh();
  };
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Member';
  const potFree = (p: string) =>
    p === 'club_wallet' ? Infinity : (L.availability.find(a => a.pot === p)?.available ?? 0);

  if (L.missing) {
    return (
      <Card className="p-4">
        <p className="t-body text-slate-500 dark:text-gray-400">
          The payment ledger tables aren't in the database yet — run
          <span className="font-mono text-xs"> add_ground_payment_ledger.sql</span> and this fills in.
        </p>
      </Card>
    );
  }
  if (L.loading) return <Card className="p-4 t-body text-slate-500">Loading…</Card>;

  return (
    <div className="space-y-3">
      {/* A split that doesn't add up is someone's half-finished entry, not a
          rounding artefact — say so rather than quietly showing a wrong total. */}
      {L.unallocated.length > 0 && (
        <Card className="p-4 border-amber-400/60 bg-amber-50 dark:bg-amber-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300">
                {L.unallocated.length} payment{L.unallocated.length === 1 ? '' : 's'} not fully accounted for
              </p>
              {L.unallocated.map(u => (
                <p key={u.id} className="t-meta text-amber-700 dark:text-amber-300/80">
                  {u.date} · {rupees(u.amount)} paid, {rupees(Math.abs(u.shortfall))}
                  {u.shortfall > 0 ? ' unexplained' : ' over-allocated'}
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Paid to the ground ─────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="w-4 h-4 text-slate-400" />
          <p className="t-micro font-black uppercase tracking-widest text-slate-500">
            Paid to the ground
          </p>
        </div>

        <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
          {rupees(L.totalPaid)}
        </p>
        {contracted != null && contracted > 0 && (
          <>
            <p className="t-meta text-slate-500 dark:text-gray-400">
              of {rupees(contracted)} contracted · {rupees(Math.max(0, contracted - L.totalPaid))} still to pay
            </p>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (L.totalPaid / contracted) * 100)}%` }} />
            </div>
          </>
        )}

        {/* Funding mix */}
        <div className="mt-4 space-y-1.5">
          {Object.entries(L.fundedBy)
            .sort((a, b) => b[1] - a[1])
            .map(([src, amt]) => (
              <div key={src} className="flex items-center justify-between">
                <span className={`t-body font-semibold ${SOURCE_INK[src] ?? 'text-slate-600'}`}>
                  {SOURCE_LABEL[src] ?? src}
                </span>
                <span className="font-black tabular-nums text-slate-800 dark:text-white/90">
                  {rupees(amt)}
                </span>
              </div>
            ))}
        </div>

        {/* Each payment */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 space-y-2">
          {L.payments.map(p => (
            <div key={p.id}>
              <div className="flex items-center justify-between">
                <span className="t-meta text-slate-500 dark:text-gray-400">
                  {new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB',
                    { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-bold tabular-nums text-slate-800 dark:text-white/90">
                  {rupees(p.amount)}
                </span>
              </div>
              {p.sources.length > 0 && (
                <p className="t-micro text-slate-400 dark:text-gray-500">
                  {p.sources.map(s => `${SOURCE_LABEL[s.source] ?? s.source} ${rupees(s.amount)}`).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Owed back to members ───────────────────────────────────────── */}
      {L.totalOwedToMembers > 0 && (
        <Card className="p-4 border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins className="w-4 h-4 text-amber-600" />
            <p className="t-micro font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
              The club owes
            </p>
          </div>
          <p className="text-2xl font-black tabular-nums text-amber-700 dark:text-amber-300">
            {rupees(L.totalOwedToMembers)}
          </p>
          <div className="mt-2 space-y-1">
            {L.owedByMember.map(o => (
              <div key={o.member_id} className="flex items-center justify-between">
                <span className="t-body font-semibold text-slate-700 dark:text-white/85">
                  {nameOf(o.member_id)}
                </span>
                <span className="font-black tabular-nums text-amber-700 dark:text-amber-300">
                  {rupees(o.outstanding)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-amber-300/40 space-y-1">
            {L.advances.filter(a => a.outstanding > 0).map(a => (
              <p key={a.id} className="t-micro text-amber-700/80 dark:text-amber-300/70">
                {new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' · '}{a.purpose} — {rupees(a.outstanding)}
              </p>
            ))}
          </div>
          {/* What could actually be repaid today. A debt shown with no sense of
              whether the money exists to clear it is half the picture — and
              right now every rupee collected is already in the ground. */}
          {/* Money freeing up should announce itself. Opponent payments land
              weeks apart, and a debt nobody is reminded of is a debt that sits. */}
          {L.availableToRepay > 0 && (
            <div className="mt-3 r-control px-3 py-2 bg-emerald-500/15 border border-emerald-500/30">
              <p className="t-body font-black text-emerald-800 dark:text-emerald-300">
                {rupees(L.availableToRepay)} has freed up — {nameOf(L.owedByMember[0].member_id)} can be repaid
              </p>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-amber-300/40">
            <div className="flex items-center justify-between">
              <span className="t-meta text-amber-700/80 dark:text-amber-300/70">Free to repay today</span>
              <span className="font-black tabular-nums text-amber-800 dark:text-amber-200">
                {rupees(L.availableToRepay)}
              </span>
            </div>
            {L.availability.map(a => (
              <p key={a.pot} className="t-micro text-amber-700/60 dark:text-amber-300/50">
                {a.pot === 'opponent' ? 'Opponent bookings' : 'Member contributions'}:
                {' '}{rupees(a.collected)} in, {rupees(a.spent_on_ground + a.spent_on_repayments)} committed
              </p>
            ))}
            <p className="t-meta text-amber-700/70 dark:text-amber-300/60 mt-1">
              Repaid from opponent collections first, member collections second.
            </p>
          </div>

          {/* Recording a repayment writes a row rather than editing a number.
              The last ₹28,000 was marked repaid by a note when it never had
              been; an event with a date and a pot cannot be lost that way. */}
          {isAdmin && (
            <div className="mt-3 pt-2 border-t border-amber-300/40 space-y-2">
              {L.advances.filter(a => a.outstanding > 0).map(a => (
                <div key={a.id}>
                  {repayFor === a.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number" inputMode="numeric" value={amount} placeholder="Amount"
                          onChange={e => setAmount(e.target.value)}
                          className="flex-1 r-control px-2 py-1.5 text-sm border border-amber-300
                                     bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                        <select value={pot} onChange={e => setPot(e.target.value as typeof pot)}
                          className="r-control px-2 py-1.5 text-sm border border-amber-300
                                     bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          <option value="opponent">Opponent</option>
                          <option value="member_fund">Member fund</option>
                          <option value="club_wallet">Club wallet</option>
                        </select>
                      </div>
                      {err && <p className="t-micro text-rose-600">{err}</p>}
                      {/* A warning, not a block. Repaying out of the club wallet,
                          or out of money that has arrived but isn't verified yet,
                          is a legitimate thing to do — it just shouldn't happen
                          without the person noticing. */}
                      {!err && Number(amount) > potFree(pot) && (
                        <p className="t-micro text-amber-700 dark:text-amber-400">
                          Only {rupees(potFree(pot))} is free in {SOURCE_LABEL[pot]?.toLowerCase() ?? pot}.
                          Recording more will show that pot overdrawn.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button disabled={saving} onClick={() => record(a.id, a.outstanding)}
                          className="flex-1 r-control py-1.5 text-sm font-black bg-amber-500 text-white">
                          {saving ? 'Saving…' : 'Record repayment'}
                        </button>
                        <button onClick={() => { setRepayFor(null); setErr(null); }}
                          className="r-control px-3 py-1.5 text-sm font-bold text-slate-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => {
                        // Pre-fill what can actually be paid today, not the whole
                        // debt. Offering ₹28,000 when ₹3,000 is free invites a
                        // repayment the club cannot make, and nothing downstream
                        // would refuse it — available would simply go negative.
                        setRepayFor(a.id);
                        setAmount(String(Math.min(a.outstanding, Math.max(0, L.availableToRepay)) || a.outstanding));
                        setErr(null);
                      }}
                      className="w-full r-control py-1.5 text-sm font-bold border border-amber-400
                                 text-amber-700 dark:text-amber-300">
                      Repay {rupees(a.outstanding)} · {a.purpose.slice(0, 28)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {L.repayments.length > 0 && (
            <div className="mt-3 pt-2 border-t border-amber-300/40">
              <p className="t-micro font-black uppercase tracking-widest text-amber-700/70 mb-1">Repaid so far</p>
              {L.repayments.map(r => (
                <p key={r.id} className="t-micro text-amber-700/80 dark:text-amber-300/70">
                  {new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' · '}{rupees(r.amount)} from {SOURCE_LABEL[r.funded_by] ?? r.funded_by}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
