import { Card } from './ui/Card';
import { useMemberStatement } from '../hooks/useMemberStatement';

// ─── Member statement ─────────────────────────────────────────────────────────
// Built for the question a core member asks at an audit and that no page could
// previously answer: "how much have I put into this club, in total?"
//
// The club runs two pots — the match-fee wallet and the season ground fund —
// and they are deliberately kept apart, because paying for the ground does not
// put money behind your match fees. Keeping them apart is right; leaving a
// member to add them up in their head is not.

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const KIND_LABEL: Record<string, { text: string; tone: string }> = {
  deposit:     { text: 'Wallet',      tone: 'text-emerald-600 dark:text-emerald-400' },
  refund:      { text: 'Refund',      tone: 'text-emerald-600 dark:text-emerald-400' },
  match_fee:   { text: 'Match fee',   tone: 'text-slate-500 dark:text-white/50' },
  expense:     { text: 'Expense',     tone: 'text-slate-500 dark:text-white/50' },
  season_fund: { text: 'Ground fund', tone: 'text-blue-600 dark:text-blue-400' },
  prepaid:     { text: 'Paid ground', tone: 'text-amber-600 dark:text-amber-400' },
  // Its own label on purpose. Shown as "Match fee" it read as money paid to
  // play, which for some members overstated that by nearly ₹5,000.
  adjustment:  { text: 'Opening',     tone: 'text-violet-600 dark:text-violet-400' },
  // Not "Wallet". It is the same money as the ground-fund line above it, and
  // showing both in deposit green read as two separate payments.
  transfer:    { text: 'Moved',       tone: 'text-blue-600 dark:text-blue-400' },
};

export function MemberStatement({ memberId, name }: { memberId: string; name: string }) {
  const s = useMemberStatement(memberId);
  if (s.loading) return null;

  const first = name.split(' ')[0];
  const targetPct = s.seasonFundTarget
    ? Math.min(100, (s.seasonFundPaid / s.seasonFundTarget) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* ── The number an audit asks for ─────────────────────────────────── */}
      <Card className="p-5">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
          Total {first} has put in
        </p>
        <p className="t-num text-4xl text-slate-900 dark:text-white mt-1">
          {rupees(s.totalPutIn)}
        </p>
        <p className="t-meta text-slate-500 dark:text-white/55 mt-1">
          Across every pot the club runs — this is the audit figure.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
          {[
            { l: 'Wallet in', v: s.walletIn },
            { l: 'Ground fund', v: s.seasonFundPaid },
            { l: 'Paid personally', v: s.prepaidForClub },
          ].map(x => (
            <div key={x.l} className="text-center">
              <p className="t-num text-lg text-slate-900 dark:text-white leading-none">
                {rupees(x.v)}
              </p>
              <p className="t-micro font-black uppercase tracking-wider text-slate-400 mt-1">
                {x.l}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Wallet — the only pot match fees come out of ─────────────────── */}
      <Card className="p-5">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
          Match wallet
        </p>
        <p className="t-num text-3xl mt-1 text-slate-900 dark:text-white">
          {rupees(s.balance)}
        </p>
        <p className="t-meta text-slate-500 dark:text-white/55">
          {rupees(s.walletIn - s.fundTransferred)} paid in
          {s.fundTransferred > 0 && <> · {rupees(s.fundTransferred)} moved from ground fund</>}
          {' '}· {rupees(s.matchFees)} in match fees
          {s.adjustment !== 0 && (
            <> · {rupees(Math.abs(s.adjustment))} opening adjustment</>
          )}
        </p>
        {/* The carry-in is not a match fee and not a deposit. Members with one
            were being told they had paid it to play. */}
        {s.adjustment !== 0 && (
          <p className="t-micro text-slate-400 mt-1 leading-snug">
            The opening adjustment is your position carried in from before the club
            moved to the app — not money you paid to play.
          </p>
        )}
        {/* Says plainly why the balance can look small next to a big total. */}
        <p className="t-micro text-slate-400 mt-2 leading-snug">
          Ground fund money is kept separate and doesn't appear here — it pays for
          the ground, not your match fees.
        </p>

        {/* ── Reconciliation ──────────────────────────────────────────────
            The stored balance and the recorded transactions disagreeing is
            not necessarily an error — an opening balance carried in from
            before the app would do it, as would a balance corrected by hand.
            But an audit has to be TOLD, not left to find it. */}
        {Math.abs(s.drift) > 0.5 && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-400/20">
            <p className="t-meta font-black text-amber-600 dark:text-amber-300">
              Doesn't match the entries below
            </p>
            <div className="mt-1.5 space-y-0.5 t-meta text-slate-600 dark:text-white/65">
              <div className="flex justify-between">
                <span>From recorded entries</span>
                <span className="tabular-nums">{rupees(s.balanceFromLedger)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance actually stored</span>
                <span className="tabular-nums">{rupees(s.balance)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 dark:text-white">
                <span>Unexplained</span>
                <span className="tabular-nums">
                  {s.drift >= 0 ? '+' : '−'}{rupees(Math.abs(s.drift))}
                </span>
              </div>
            </div>
            <p className="t-micro text-slate-400 mt-2 leading-snug">
              Usually an opening balance from before the app, or a correction made
              directly. Worth recording the reason so it isn't queried again.
            </p>
          </div>
        )}
      </Card>

      {/* ── Ground fund ──────────────────────────────────────────────────── */}
      {(s.seasonFundTarget > 0 || s.seasonFundPaid > 0) && (
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
              Ground fund
            </p>
            <p className="t-meta text-slate-400">
              {rupees(s.seasonFundPaid)}{s.seasonFundTarget > 0 && ` of ${rupees(s.seasonFundTarget)}`}
            </p>
          </div>
          {s.seasonFundTarget > 0 && (
            <>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${targetPct}%` }} />
              </div>
              <p className="t-meta text-slate-500 dark:text-white/55 mt-2">
                {s.seasonFundPaid >= s.seasonFundTarget
                  ? 'Fully paid for this season.'
                  : `${rupees(s.seasonFundTarget - s.seasonFundPaid)} still to go.`}
              </p>
            </>
          )}
        </Card>
      )}

      {/* ── Every line, newest first ─────────────────────────────────────── */}
      <Card className="p-5">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
          Every entry
        </p>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {s.lines.map((l, i) => {
            const k = KIND_LABEL[l.kind] ?? KIND_LABEL.deposit;
            return (
              <div key={`${l.date}-${i}`}
                className="flex items-start gap-2 py-1 border-b border-slate-50 dark:border-white/5">
                <span className="t-micro text-slate-400 tabular-nums w-16 flex-shrink-0">
                  {new Date(l.date + 'T00:00:00').toLocaleDateString('en-IN',
                    { day: 'numeric', month: 'short' })}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-body text-slate-700 dark:text-white/75 leading-tight">
                    {l.label}
                  </span>
                  <span className={`block t-micro font-bold ${k.tone}`}>{k.text}</span>
                </span>
                <span className={`t-body font-black tabular-nums ${
                  l.amount >= 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {l.amount >= 0 ? '+' : '−'}{rupees(Math.abs(l.amount))}
                </span>
              </div>
            );
          })}
          {!s.lines.length && (
            <p className="t-meta text-slate-400">Nothing recorded yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
