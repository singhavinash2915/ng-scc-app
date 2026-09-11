import { supabase } from './supabase';

// ─── Paying back a member who fronted an ad-hoc slot ─────────────────────────
// In September Avinash pays the Four Star owner each slot in full; the opponent
// pays him half, and the SCC side's half comes out of the match fees. The
// database works out what each side has paid and records whatever repayment
// isn't recorded yet — see supabase/migrations/add_adhoc_slot_advances.sql.
//
// Called at the two moments money actually lands: when a match's fees are
// charged, and when an opponent's payment is marked received. It is idempotent,
// so calling it again — or from both places — never repays anything twice.

export async function settleAdhocSlot(date: string | null | undefined): Promise<void> {
  if (!date) return;
  const { error } = await supabase.rpc('scc_settle_adhoc_slot', { p_date: date });
  // Missing function = the migration hasn't been run here; nothing to settle.
  if (error && error.code !== 'PGRST202' && error.code !== '42883') {
    console.error('settleAdhocSlot', date, error);
  }
}
