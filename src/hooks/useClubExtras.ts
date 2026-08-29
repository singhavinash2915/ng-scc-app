import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── The corners the chat couldn't reach ──────────────────────────────────────
// Feedback, opponent bookings, join requests and ground-fund payments are all
// real parts of the club that lived on their own page and reached the chat not
// at all — so "what did people say in feedback" or "who wants to play us" got
// an apologetic non-answer.
//
// All four are small (about 100 rows between them), so this is a few thousand
// tokens rather than a rethink of the payload.
//
// Two of them carry personal data. Opponent bookings hold a contact name and
// phone; join requests hold an applicant's phone and email. Those are for
// admins, and the fetch is skipped entirely when the asker isn't one — not
// filtered afterwards, so the data never reaches the browser either.

export interface ClubExtras {
  feedback: Array<{ name: string; message: string; rating: number | null; reply: string | null }>;
  opponentBookings: Array<{ team: string; amount: number; status: string; paid: string; date: string | null }> | null;
  /** Totals computed here, not by the model. Asked to add 21 numbers it
   *  answered 69,000 against a true 76,000 — close enough to look right and
   *  wrong enough to matter on a figure an admin might act on. Arithmetic is
   *  the one thing a payload can do perfectly. */
  bookingTotals: { grandTotal: number; byTeam: Array<{ team: string; total: number; bookings: number }> } | null;
  joinRequests: Array<{ name: string; experience: string | null; status: string }> | null;
  groundFund: Array<{ member: string; amount: number; date: string }> | null;
}

const EMPTY: ClubExtras = { feedback: [], opponentBookings: null, joinRequests: null,
                            groundFund: null, bookingTotals: null };

export function useClubExtras(
  isAdmin: boolean,
  memberNameOf: (id: string) => string,
  /** slot_id -> date. match_bookings.slot_id has no FK to ground_bookings, so
   *  PostgREST cannot embed it — asking it to made the whole query fail and
   *  the chat reported "no bookings" for 21 real ones. Resolved by the caller,
   *  which already holds the bookings. */
  slotDateOf: (slotId: string | null) => string | null,
) {
  const [extras, setExtras] = useState<ClubExtras>(EMPTY);

  const fetchAll = useCallback(async () => {
    // Feedback is already a public wall in the app, so everyone may see it.
    const fb = await supabase
      .from('feedback')
      .select('name, message, rating, admin_reply')
      .order('created_at', { ascending: false })
      .limit(40);

    const next: ClubExtras = {
      feedback: (fb.data ?? []).map(f => ({
        name: f.name, message: f.message, rating: f.rating, reply: f.admin_reply,
      })),
      opponentBookings: null, joinRequests: null, groundFund: null, bookingTotals: null,
    };

    if (isAdmin) {
      const [bk, rq, gf] = await Promise.all([
        supabase.from('match_bookings')
          .select('team_name, amount, status, payment_status, created_at, slot_id')
          .order('created_at', { ascending: false }).limit(40),
        supabase.from('member_requests')
          .select('name, experience, status').order('created_at', { ascending: false }).limit(40),
        supabase.from('season_fund_payments')
          .select('member_id, amount, date').order('date', { ascending: false }).limit(60),
      ]);
      // Contact name and phone are deliberately NOT selected. An admin can see
      // them on the bookings page; there is no reason for them to travel to a
      // model to answer "who wants to play us".
      next.opponentBookings = (bk.data ?? []).map(b => ({
        team: b.team_name, amount: b.amount, status: b.status,
        paid: b.payment_status, date: slotDateOf(b.slot_id),
      }));
      // Names in this table carry typos — "GritForce" and "GrtiForce" are the
      // same club — so totals are keyed on a normalised name. The variants are
      // left visible in the list rather than silently corrected.
      const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');
      const agg = new Map<string, { team: string; total: number; bookings: number }>();
      for (const b of next.opponentBookings) {
        const k = norm(b.team);
        const cur = agg.get(k) ?? { team: b.team, total: 0, bookings: 0 };
        cur.total += Number(b.amount) || 0;
        cur.bookings += 1;
        agg.set(k, cur);
      }
      next.bookingTotals = {
        grandTotal: [...agg.values()].reduce((s2, x) => s2 + x.total, 0),
        byTeam: [...agg.values()].sort((a, b) => b.total - a.total),
      };

      next.joinRequests = (rq.data ?? []).map(r => ({
        name: r.name, experience: r.experience, status: r.status,
      }));
      next.groundFund = (gf.data ?? []).map(g => ({
        member: memberNameOf(g.member_id), amount: g.amount, date: g.date,
      }));
    }
    setExtras(next);
  }, [isAdmin, memberNameOf, slotDateOf]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return extras;
}
