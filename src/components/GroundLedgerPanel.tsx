import { Card } from './ui/Card';
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
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Member';

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
          <p className="t-meta text-amber-700/70 dark:text-amber-300/60 mt-2">
            Repaid from opponent collections first, member collections second.
          </p>
        </Card>
      )}
    </div>
  );
}
