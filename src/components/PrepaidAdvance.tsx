import { Card } from './ui/Card';
import { HandCoins } from 'lucide-react';

// ─── Advance tracker ──────────────────────────────────────────────────────────
// When a member pays for slots out of their own pocket, the club owes them.
// This is the bit that has to be visible: without it somebody is thousands of
// rupees down with nothing on paper, and after a couple of rained-off matches
// nobody agrees what was settled.
//
// It counts DOWN, because what members need to see isn't how much was spent —
// it's how much is still owed to a teammate.

export interface PrepaidGroup {
  memberName: string;
  opponent: string | null;
  total: number;
  settled: number;
  slots: number;
  slotsSettled: number;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function PrepaidAdvance({ groups }: { groups: PrepaidGroup[] }) {
  if (!groups.length) return null;

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const owed = g.total - g.settled;
        const pct = g.total ? (g.settled / g.total) * 100 : 0;
        const done = owed <= 0;
        return (
          <Card key={`${g.memberName}-${g.opponent}`} tone={done ? 'good' : 'warn'} className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 r-control bg-amber-100 dark:bg-amber-400/20
                              flex items-center justify-center flex-shrink-0">
                <HandCoins className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white">
                  {g.opponent ? `${g.opponent} series` : 'Prepaid slots'}
                </p>
                <p className="t-meta text-slate-500 dark:text-white/60">
                  {g.memberName} paid {rupees(g.total)} in advance
                </p>
              </div>
            </div>

            <p className="t-num text-3xl mt-4 text-slate-900 dark:text-white">
              {done ? 'Settled' : rupees(owed)}
            </p>
            <p className="t-meta text-slate-500 dark:text-white/60">
              {done
                ? `All ${g.slots} matches played — ${g.memberName} has been paid back in full.`
                : `still owed to ${g.memberName} · ${g.slotsSettled} of ${g.slots} matches played`}
            </p>

            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, pct)}%` }} />
            </div>

            {/* The sentence that stops anyone having to ask. */}
            <p className="t-micro text-slate-400 mt-2 leading-snug">
              Match fees for these games repay {g.memberName} rather than going to the
              ground — he has already paid for them. Nobody pays anything extra.
            </p>
          </Card>
        );
      })}
    </div>
  );
}
