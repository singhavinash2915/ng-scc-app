import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── What was paid to the ground, and who is still owed ───────────────────────
// "Paid to the owner" used to be inferred by counting booking rows flagged paid.
// That is a schedule of slots, not a record of payments — it cannot say when
// money moved, how much moved at once, or where it came from. This reads the
// payment ledger instead, and the member advances that funded part of it.

export interface GroundPaymentSource {
  id: string;
  source: 'member_fund' | 'opponent' | 'member_advance' | 'club_wallet';
  amount: number;
  member_id: string | null;
  notes: string | null;
}

export interface GroundPayment {
  id: string;
  date: string;
  amount: number;
  paid_to: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  sources: GroundPaymentSource[];
}

export interface MemberAdvance {
  id: string;
  member_id: string;
  date: string;
  amount: number;
  purpose: string;
  settled_amount: number;
  notes: string | null;
  /** What's still owed on this advance. */
  outstanding: number;
}

export interface AdvanceRepayment {
  id: string;
  advance_id: string;
  date: string;
  amount: number;
  funded_by: 'opponent' | 'member_fund' | 'club_wallet';
  notes: string | null;
}

/** Money collected minus money already committed, per pot. Money spent on the
 *  ground cannot also repay a member, so a debt is only clearable to the extent
 *  something is actually free. */
export interface PotAvailability {
  pot: 'opponent' | 'member_fund';
  collected: number;
  spent_on_ground: number;
  spent_on_repayments: number;
  available: number;
}

export interface GroundLedger {
  payments: GroundPayment[];
  advances: MemberAdvance[];
  totalPaid: number;
  /** Unsettled advances, by member — who the club still has to pay back. */
  owedByMember: Array<{ member_id: string; outstanding: number }>;
  totalOwedToMembers: number;
  /** Money put in, grouped by where it came from. */
  fundedBy: Record<string, number>;
  /** A payment whose sources don't add up is a split someone didn't finish. */
  unallocated: Array<{ id: string; date: string; amount: number; shortfall: number }>;
  repayments: AdvanceRepayment[];
  availability: PotAvailability[];
  /** Total free across every pot — what could be repaid today. */
  availableToRepay: number;
  /** The owner's contract: his slots only, so slots bought from another club
   *  never appear as money he is owed. */
  contracted: number;
  /** Contract less what has actually been paid. */
  outstandingToOwner: number;
  loading: boolean;
  missing: boolean;
  refresh: () => Promise<void>;
}

/** The ledger tables land in a migration; until it runs, say so rather than
 *  rendering an empty ledger that reads as "nothing has been paid". */
const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useGroundLedger(): GroundLedger {
  const [payments, setPayments] = useState<GroundPayment[]>([]);
  const [advances, setAdvances] = useState<MemberAdvance[]>([]);
  const [repayments, setRepayments] = useState<AdvanceRepayment[]>([]);
  const [availability, setAvailability] = useState<PotAvailability[]>([]);
  const [contracted, setContracted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: pays, error: pErr }, { data: srcs }, { data: advs },
           { data: reps }, { data: avail }, { data: slots }] = await Promise.all([
      supabase.from('ground_payments')
        .select('id, date, amount, paid_to, method, reference, notes')
        .order('date', { ascending: true }),
      supabase.from('ground_payment_sources')
        .select('id, payment_id, source, amount, member_id, notes'),
      supabase.from('member_advances')
        .select('id, member_id, date, amount, purpose, settled_amount, notes')
        .order('date', { ascending: true }),
      supabase.from('member_advance_repayments')
        .select('id, advance_id, date, amount, funded_by, notes')
        .order('date', { ascending: false }),
      supabase.from('v_scc_funds_available').select('*'),
      supabase.from('ground_bookings').select('cost, prepaid_by, status'),
    ]);

    if (isMissing(pErr)) { setMissing(true); setLoading(false); return; }
    setMissing(false);

    const byPayment = new Map<string, GroundPaymentSource[]>();
    for (const s of (srcs ?? []) as Array<GroundPaymentSource & { payment_id: string }>) {
      const list = byPayment.get(s.payment_id) ?? [];
      list.push({ id: s.id, source: s.source, amount: Number(s.amount), member_id: s.member_id, notes: s.notes });
      byPayment.set(s.payment_id, list);
    }

    setPayments(((pays ?? []) as GroundPayment[]).map(p => ({
      ...p, amount: Number(p.amount), sources: byPayment.get(p.id) ?? [],
    })));

    setAdvances(((advs ?? []) as MemberAdvance[]).map(a => ({
      ...a,
      amount: Number(a.amount),
      settled_amount: Number(a.settled_amount),
      outstanding: Number(a.amount) - Number(a.settled_amount),
    })));
    setRepayments(((reps ?? []) as AdvanceRepayment[]).map(r => ({ ...r, amount: Number(r.amount) })));
    setAvailability(((avail ?? []) as PotAvailability[]).map(a => ({
      ...a,
      collected: Number(a.collected),
      spent_on_ground: Number(a.spent_on_ground),
      spent_on_repayments: Number(a.spent_on_repayments),
      available: Number(a.available),
    })));
    setContracted(((slots ?? []) as Array<{ cost: number; prepaid_by: string | null; status: string }>)
      .filter(b => !b.prepaid_by && b.status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.cost), 0));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const fundedBy: Record<string, number> = {};
  for (const p of payments) {
    for (const s of p.sources) fundedBy[s.source] = (fundedBy[s.source] ?? 0) + s.amount;
  }

  const owedMap = new Map<string, number>();
  for (const a of advances) {
    if (a.outstanding <= 0) continue;
    owedMap.set(a.member_id, (owedMap.get(a.member_id) ?? 0) + a.outstanding);
  }
  const owedByMember = [...owedMap.entries()]
    .map(([member_id, outstanding]) => ({ member_id, outstanding }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const unallocated = payments
    .map(p => ({
      id: p.id, date: p.date, amount: p.amount,
      shortfall: p.amount - p.sources.reduce((s, x) => s + x.amount, 0),
    }))
    .filter(p => Math.abs(p.shortfall) > 0.005);

  return {
    payments, advances, repayments, availability,
    availableToRepay: availability.reduce((s, a) => s + Math.max(0, a.available), 0),
    totalPaid, owedByMember,
    totalOwedToMembers: owedByMember.reduce((s, x) => s + x.outstanding, 0),
    contracted,
    outstandingToOwner: Math.max(0, contracted - totalPaid),
    fundedBy, unallocated, loading, missing, refresh,
  };
}
