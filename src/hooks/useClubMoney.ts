import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Member credit vs cash in hand ────────────────────────────────────────────
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
      const [mem, gb, bk] = await Promise.all([
        supabase.from('members').select('balance'),
        supabase.from('ground_bookings').select('cost, payment_status, prepaid_by'),
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

      // Wallet deposits are the club receiving money; match fees are internal
      // and move nothing, so they're excluded from both sides.
      const { data: txns } = await supabase
        .from('transactions').select('type, amount');
      let deposits = 0, expenses = 0;
      for (const t of (txns ?? []) as Array<{ type: string; amount: number }>) {
        const a = Math.abs(Number(t.amount));
        if (t.type === 'deposit') deposits += a;
        else if (t.type === 'expense') expenses += a;
      }

      const cashIn = deposits + bookingCash;
      const cashOut = expenses + paidToOwner;

      setM({
        memberCredit, cashIn, cashOut,
        cashInHand: cashIn - cashOut,
        owedToOwner, owedToMembers, loading: false,
      });
    })();
  }, []);

  return m;
}
