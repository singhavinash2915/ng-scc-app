import { Card } from './ui/Card';
import { Wallet, Landmark, AlertTriangle } from 'lucide-react';
import { useClubMoney } from '../hooks/useClubMoney';

// ─── The two numbers, side by side ────────────────────────────────────────────
// Built to be shown at an audit. Member credit and cash in hand are opposites —
// one is what the club owes, the other what it holds — and for most of a season
// they look nothing alike.

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function ClubMoneyCard() {
  const m = useClubMoney();
  if (m.loading) return null;

  const tight = m.cashInHand < m.owedToOwner;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Wallet className="w-3.5 h-3.5" />
            <span className="t-micro font-black uppercase tracking-wider">Member credit</span>
          </div>
          <p className="t-num text-2xl text-slate-900 dark:text-white">{rupees(m.memberCredit)}</p>
          <p className="t-micro text-slate-400 mt-1 leading-snug">
            Prepaid cricket members can still draw on. Owed to them, not held.
          </p>
        </Card>

        <Card tone={tight ? 'warn' : 'plain'} className="p-4">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Landmark className="w-3.5 h-3.5" />
            <span className="t-micro font-black uppercase tracking-wider">Cash in hand</span>
          </div>
          <p className="t-num text-2xl text-slate-900 dark:text-white">{rupees(m.cashInHand)}</p>
          <p className="t-micro text-slate-400 mt-1 leading-snug">
            {rupees(m.cashIn)} received · {rupees(m.cashOut)} paid out.
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
          Still to pay
        </p>
        <div className="space-y-1 t-body">
          <div className="flex justify-between text-slate-700 dark:text-white/75">
            <span>Ground owner</span>
            <span className="tabular-nums">{rupees(m.owedToOwner)}</span>
          </div>
          {m.owedToMembers > 0 && (
            <div className="flex justify-between text-slate-700 dark:text-white/75">
              <span>Members who paid personally</span>
              <span className="tabular-nums">{rupees(m.owedToMembers)}</span>
            </div>
          )}
        </div>

        {/* The sentence a treasurer needs, said before it's a problem. */}
        {tight && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-400/20
                          flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="t-meta text-amber-700 dark:text-amber-300 leading-snug">
              Cash in hand is below what's owed to the ground owner. That's normal
              mid-season — the rest comes in as members top up and matches are
              played — but it's the number to watch.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
