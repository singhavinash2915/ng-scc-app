import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── What opponents actually paid, by date ────────────────────────────────────
// The two systems never talked. Match Bookings had ₹56,000 of confirmed
// bookings; the season page showed OPPONENT ₹0 and a ground cost with nothing
// offsetting it — so members were reading a bigger hole than exists.
//
// The join isn't direct: a booking points at a SLOT, and the slot carries the
// date. Ground bookings are keyed by date. So slot → date → session.

export interface OpponentDay {
  date: string;
  team: string;
  amount: number;
  /** Money actually in hand, not merely agreed. */
  paid: number;
  status: string;
}

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useOpponentIncome() {
  const [byDate, setByDate] = useState<Map<string, OpponentDay>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('match_bookings')
        .select('team_name, amount, status, payment_status, slot:match_slots(date)')
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
      if (isMissing(error) || error) { setLoading(false); return; }

      // PostgREST hands an embedded many-to-one back as an object, though the
      // generated types say array. Accept either — assuming one shape here
      // silently matched nothing once already.
      type Row = {
        team_name: string; amount: number; status: string; payment_status: string;
        slot: { date: string } | Array<{ date: string }> | null;
      };
      const rows = (data ?? []) as unknown as Row[];

      const m = new Map<string, OpponentDay>();
      for (const r of rows) {
        const s = Array.isArray(r.slot) ? r.slot[0] : r.slot;
        if (!s?.date) continue;
        const amount = Number(r.amount) || 0;
        // "Verified" is money in hand. Confirmed-but-unverified is a promise,
        // and a season page that counts promises as income is how a club
        // discovers a shortfall in May.
        const paid = r.payment_status === 'verified' ? amount : 0;
        const cur = m.get(s.date);
        if (cur) {
          cur.amount += amount; cur.paid += paid;
          if (!cur.team.includes(r.team_name)) cur.team += `, ${r.team_name}`;
        } else {
          m.set(s.date, { date: s.date, team: r.team_name, amount, paid, status: r.status });
        }
      }
      setByDate(m);
      setLoading(false);
    })();
  }, []);

  return { byDate, loading };
}
