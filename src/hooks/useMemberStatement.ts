import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── One member, every rupee ──────────────────────────────────────────────────
// The club runs two separate pots and neither page knows about the other:
//
//   WALLET       members pay the club, an admin credits their balance, and
//                match fees come out of it automatically.
//   SEASON FUND  a separate contribution towards the ground booking. It does
//                NOT credit the wallet — different money, different purpose.
//
// Both are correct on their own and useless for the question a core member
// actually asks at an audit: "how much have I put in this season?" That answer
// lives in neither place, so this assembles it.
//
// Read-only and derived. Nothing here writes, so a statement can never
// disagree with the ledgers it is built from.

export interface StatementLine {
  date: string;
  label: string;
  amount: number;          // positive = in, negative = out
  kind: 'deposit' | 'match_fee' | 'season_fund' | 'refund' | 'expense' | 'prepaid';
}

export interface MemberStatement {
  walletIn: number;
  walletOut: number;
  balance: number;
  seasonFundPaid: number;
  seasonFundTarget: number;
  prepaidForClub: number;   // slots they paid for personally — the club owes them
  totalPutIn: number;       // the number an audit asks for
  /** What the wallet WOULD be if only the recorded transactions existed. */
  balanceFromLedger: number;
  /** stored − ledger. Non-zero means something moved without a transaction. */
  drift: number;
  lines: StatementLine[];
  loading: boolean;
}

const EMPTY: MemberStatement = {
  walletIn: 0, walletOut: 0, balance: 0, seasonFundPaid: 0, seasonFundTarget: 0,
  prepaidForClub: 0, totalPutIn: 0, balanceFromLedger: 0, drift: 0,
  lines: [], loading: true,
};

export function useMemberStatement(memberId: string | null, season?: { start: string; end: string }) {
  const [st, setSt] = useState<MemberStatement>(EMPTY);

  useEffect(() => {
    if (!memberId) { setSt({ ...EMPTY, loading: false }); return; }

    void (async () => {
      const lines: StatementLine[] = [];

      // ── Wallet ────────────────────────────────────────────────────────────
      const { data: txns } = await supabase
        .from('transactions')
        .select('date, type, amount, description')
        .eq('member_id', memberId).order('date', { ascending: false });

      let walletIn = 0, walletOut = 0;
      for (const t of (txns ?? []) as Array<{ date: string; type: string; amount: number; description: string | null }>) {
        const day = String(t.date).slice(0, 10);
        if (season && (day < season.start || day > season.end)) continue;
        const amt = Math.abs(Number(t.amount));
        if (t.type === 'deposit' || t.type === 'refund') {
          walletIn += amt;
          lines.push({ date: day, label: t.description || 'Deposit', amount: amt,
                       kind: t.type as 'deposit' | 'refund' });
        } else if (t.type === 'match_fee' || t.type === 'expense') {
          walletOut += amt;
          lines.push({ date: day, label: t.description || 'Match fee', amount: -amt,
                       kind: t.type as 'match_fee' | 'expense' });
        }
      }

      // ── Season fund ───────────────────────────────────────────────────────
      // Deliberately not folded into the wallet: paying for the ground does not
      // put money behind your match fees, and pretending otherwise would show
      // members a balance they cannot spend.
      const { data: sfp } = await supabase
        .from('season_fund_payments')
        .select('date, amount, description').eq('member_id', memberId);
      let seasonFundPaid = 0;
      for (const p of (sfp ?? []) as Array<{ date: string; amount: number; description: string | null }>) {
        const day = String(p.date).slice(0, 10);
        seasonFundPaid += Number(p.amount);
        lines.push({ date: day, label: p.description || 'Season fund — ground booking',
                     amount: Number(p.amount), kind: 'season_fund' });
      }

      const { data: tgt } = await supabase
        .from('season_fund_targets').select('target_amount').eq('member_id', memberId);
      const seasonFundTarget = (tgt ?? []).reduce(
        (s: number, t: { target_amount: number }) => s + Number(t.target_amount), 0);

      // ── Slots they paid for out of pocket ─────────────────────────────────
      const { data: prep } = await supabase
        .from('ground_bookings')
        .select('date, cost, opponent_name').eq('prepaid_by', memberId);
      let prepaidForClub = 0;
      for (const b of (prep ?? []) as Array<{ date: string; cost: number; opponent_name: string | null }>) {
        prepaidForClub += Number(b.cost);
        lines.push({ date: String(b.date).slice(0, 10),
                     label: `Paid for ground — ${b.opponent_name ?? 'session'}`,
                     amount: Number(b.cost), kind: 'prepaid' });
      }

      const { data: mem } = await supabase
        .from('members').select('balance').eq('id', memberId).maybeSingle();

      lines.sort((a, b) => b.date.localeCompare(a.date));

      const stored = Number((mem as { balance?: number } | null)?.balance ?? 0);
      // A stored balance that doesn't match the ledger means money moved
      // without a transaction — an opening balance carried in from before the
      // app, or a balance edited by hand. Neither is wrong on its own; both
      // are things an audit needs told rather than left to discover.
      const balanceFromLedger = walletIn - walletOut;

      setSt({
        walletIn, walletOut,
        balance: stored,
        balanceFromLedger,
        drift: stored - balanceFromLedger,
        seasonFundPaid, seasonFundTarget, prepaidForClub,
        // What an audit asks for: every rupee this member handed the club,
        // whichever pot it went into.
        totalPutIn: walletIn + seasonFundPaid + prepaidForClub,
        lines, loading: false,
      });
    })();
  }, [memberId, season?.start, season?.end]);

  return st;
}
