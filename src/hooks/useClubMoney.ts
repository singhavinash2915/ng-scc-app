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
  owedToMembers: number;    // unsettled member advances
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
              .select('cost, payment_status, prepaid_by, booking_kind').eq('season_id', seasonId)
          : supabase.from('ground_bookings').select('cost, payment_status, prepaid_by, booking_kind'),
        supabase.from('match_bookings').select('amount, payment_status, status'),
      ]);

      const memberCredit = ((mem.data ?? []) as Array<{ balance: number }>)
        .reduce((s, x) => s + Number(x.balance), 0);

      const sessions = (gb.data ?? []) as Array<{
        cost: number; payment_status: string; prepaid_by: string | null;
        booking_kind?: string | null }>;

      // Paid to the ground owner, from the payment ledger.
      //
      // This used to count booking rows whose payment_status said 'paid'. Those
      // flags are a slot-by-slot schedule, and payments are not made slot by
      // slot: ₹150,000 went across in one transfer covering many of them at
      // once, and nobody flipped 27 flags afterwards. The flags therefore still
      // read ₹257,000 while the money that actually left reads ₹407,000 — two
      // answers to one question, ₹150,000 apart, on the same screen.
      //
      // The ledger is what money did; the flags are what was planned. Read the
      // ledger, and derive what's still owed from the contract rather than from
      // the unflipped remainder.
      const { data: payRows } = await supabase.from('ground_payments').select('amount');
      const paidToOwner = ((payRows ?? []) as Array<{ amount: number }>)
        .reduce((s, x) => s + Number(x.amount), 0);

      // The season contract is the season slots the club buys from the owner.
      // Ad-hoc slots (September, while the monsoon decides) are bought outside
      // it: counting them here would show the owner owed money he isn't.
      const contracted = sessions
        .filter(s => !s.prepaid_by && (s.booking_kind ?? 'season') !== 'adhoc')
        .reduce((s, x) => s + Number(x.cost), 0);
      const owedToOwner = Math.max(0, contracted - paidToOwner);
      // What the club owes members now comes from member_advances, which is the
      // one place that answers it. ground_bookings.prepaid_by still marks which
      // slots club cash did not pay for — a different question, and the reason
      // those slots stay out of the owner totals above — but counting the debt
      // from both would have the same rupees owed twice the moment a member
      // fronts something that isn't a whole slot. Avinash's ₹49,000 towards the
      // ₹150,000 Four Star payment is exactly that: a share of a lump sum, which
      // prepaid_by cannot express at all.
      const { data: advRows } = await supabase
        .from('member_advances')
        .select('amount, settled_amount');
      const owedToMembers = ((advRows ?? []) as Array<{ amount: number; settled_amount: number }>)
        .reduce((s, x) => s + (Number(x.amount) - Number(x.settled_amount)), 0);

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

      const cashIn = memberContributions + bookingCash;

      // Ground spending ALREADY includes the slots the club reimbursed a member
      // for — once they're settled they're marked paid like any other session.
      // Adding the reimbursement transaction on top counted the same ₹28,000
      // twice and reported ₹0 in hand when there was ₹28,000. The money left
      // once; the session being paid is the record of it.
      const cashOut = paidToOwner;

      setM({
        memberCredit, cashIn, cashOut,
        cashInHand: cashIn - cashOut,
        owedToOwner, owedToMembers, loading: false,
      });
    })();
  }, []);

  return m;
}
