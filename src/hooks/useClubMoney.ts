import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Member credit vs cash in hand, FOR ONE SEASON ────────────────────────────
//
// Scoped to the active season, and that is the whole point. A lifetime cash
// figure swallows a closed season's spending — last season's ground payments
// at A2Z Lavale were funded by last season's contributions — and produces a
// number that answers no question anyone asks. It read ₹22,000 when the club
// actually had ₹56,000 available this season, which is the difference between
// being able to settle with a member and not.
//
// Once the ground fund became wallet money these stopped being the same number
// and can never be the same number again.
//
//   MEMBER CREDIT  the sum of wallet balances — prepaid cricket members can
//                  still draw on. A LIABILITY: the club owes them the playing.
//   CASH IN HAND   money actually available. An ASSET.
//
// The club collected ₹2,57,000 and paid ₹2,57,000 to the ground owner in June.
// Members hold ₹2,70,000 of credit against slots already bought. Showing only
// the credit figure and calling it "club funds" is how a club convinces itself
// it is rich, three months before it cannot pay a ground bill.

export interface ClubMoney {
  memberCredit: number;     // sum of wallet balances — owed to members
  cashIn: number;           // everything the club has received
  cashOut: number;          // everything it has paid out
  cashInHand: number;
  owedToOwner: number;      // ground sessions still to pay for
  owedToMembers: number;    // slots a member paid for personally
  loading: boolean;
}

const EMPTY: ClubMoney = {
  memberCredit: 0, cashIn: 0, cashOut: 0, cashInHand: 0,
  owedToOwner: 0, owedToMembers: 0, loading: true,
};

export function useClubMoney(): ClubMoney {
  const [m, setM] = useState<ClubMoney>(EMPTY);

  useEffect(() => {
    void (async () => {
      // The active season is the unit. Everything below is filtered to it.
      const { data: seasonRow } = await supabase
        .from('seasons').select('id').eq('status', 'active')
        .order('start_date', { ascending: false }).limit(1).maybeSingle();
      const seasonId = (seasonRow as { id?: string } | null)?.id ?? null;

      const [mem, gb, bk] = await Promise.all([
        supabase.from('members').select('balance'),
        seasonId
          ? supabase.from('ground_bookings')
              .select('cost, payment_status, prepaid_by').eq('season_id', seasonId)
          : supabase.from('ground_bookings').select('cost, payment_status, prepaid_by'),
        supabase.from('match_bookings').select('amount, payment_status, status'),
      ]);

      const memberCredit = ((mem.data ?? []) as Array<{ balance: number }>)
        .reduce((s, x) => s + Number(x.balance), 0);

      const sessions = (gb.data ?? []) as Array<{
        cost: number; payment_status: string; prepaid_by: string | null }>;

      // Paid to the ground owner — club money only. Slots a member covered
      // personally are money the club never spent and still owes.
      const paidToOwner = sessions
        .filter(s => !s.prepaid_by && s.payment_status === 'paid')
        .reduce((s, x) => s + Number(x.cost), 0);
      const owedToOwner = sessions
        .filter(s => !s.prepaid_by && s.payment_status !== 'paid')
        .reduce((s, x) => s + Number(x.cost), 0);
      const owedToMembers = sessions
        .filter(s => s.prepaid_by)
        .reduce((s, x) => s + Number(x.cost), 0);

      // Only verified booking money is cash. A confirmed booking is a promise.
      const bookingCash = ((bk.data ?? []) as Array<{
        amount: number; payment_status: string; status: string }>)
        .filter(b => b.payment_status === 'verified'
          && b.status !== 'cancelled' && b.status !== 'rejected')
        .reduce((s, x) => s + Number(x.amount), 0);

      // What members put in FOR THIS SEASON — the ground fund, not their
      // lifetime wallet history. Season-linked rather than date-filtered,
      // because contributions arrive months before a season starts.
      const { data: sfp } = seasonId
        ? await supabase.from('season_fund_payments')
            .select('amount').eq('season_id', seasonId)
        : { data: [] };
      const memberContributions = ((sfp ?? []) as Array<{ amount: number }>)
        .reduce((s, x) => s + Number(x.amount), 0);

      // Reimbursements to members who paid club costs personally. Tagged in the
      // description so they can be recognised without a schema change.
      const { data: reimb } = await supabase
        .from('transactions').select('amount')
        .eq('type', 'expense').like('description', 'Reimbursed%');
      const reimbursed = ((reimb ?? []) as Array<{ amount: number }>)
        .reduce((s, x) => s + Math.abs(Number(x.amount)), 0);

      const cashIn = memberContributions + bookingCash;
      const cashOut = paidToOwner + reimbursed;

      setM({
        memberCredit, cashIn, cashOut,
        cashInHand: cashIn - cashOut,
        owedToOwner, owedToMembers, loading: false,
      });
    })();
  }, []);

  return m;
}
