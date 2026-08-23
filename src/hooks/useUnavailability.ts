import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── Who's away, and when ─────────────────────────────────────────────────────
// Squad polling answers "can you play on the 4th". This answers the question
// that comes before it — "which dates are worth booking at all" — which is the
// one that matters when half the club is travelling for Diwali.
//
// Stored as ranges rather than a row per day: people are away "12th to 20th",
// and changing their mind about the return date should be one edit, not a
// delete and re-entry.

export interface Unavailability {
  id: string;
  member_id: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Local YYYY-MM-DD. toISOString() would shift the date in IST after 18:30. */
export const ymd = (d: Date) => d.toLocaleDateString('en-CA');

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useUnavailability() {
  const [rows, setRows] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('scc_member_unavailability')
      .select('*')
      .order('from_date', { ascending: true });
    if (error) {
      // Before the migration is run the page should explain itself, not crash.
      if (isMissing(error)) setTableMissing(true);
      setRows([]);
    } else {
      setRows((data ?? []) as Unavailability[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const add = useCallback(async (
    memberId: string, from: string, to: string, reason: string | null,
  ) => {
    const { error } = await supabase.from('scc_member_unavailability')
      .insert({ member_id: memberId, from_date: from, to_date: to, reason });
    if (!error) await fetchRows();
    return !error;
  }, [fetchRows]);

  const edit = useCallback(async (
    id: string, from: string, to: string, reason: string | null,
  ) => {
    const { error } = await supabase.from('scc_member_unavailability')
      .update({ from_date: from, to_date: to, reason, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchRows();
    return !error;
  }, [fetchRows]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('scc_member_unavailability').delete().eq('id', id);
    if (!error) await fetchRows();
    return !error;
  }, [fetchRows]);

  /**
   * date -> the members away on it. Built once rather than scanned per cell:
   * the heat map asks this for ~70 dates against every row on the table, and
   * doing it live turns a calendar render into a nested loop.
   */
  const awayIndex = useMemo(() => {
    const idx = new Map<string, Set<string>>();
    for (const r of rows) {
      // Iterating the range is safe because these are days, not years — a
      // range long enough to matter is someone who has left the club.
      const d = new Date(r.from_date + 'T00:00:00');
      const end = new Date(r.to_date + 'T00:00:00');
      while (d <= end) {
        const k = ymd(d);
        if (!idx.has(k)) idx.set(k, new Set());
        idx.get(k)!.add(r.member_id);
        d.setDate(d.getDate() + 1);
      }
    }
    return idx;
  }, [rows]);

  const awayOn = useCallback(
    (date: string): Set<string> => awayIndex.get(date) ?? new Set(), [awayIndex]);

  const mine = useCallback(
    (memberId: string | null | undefined) =>
      memberId ? rows.filter(r => r.member_id === memberId) : [], [rows]);

  return { rows, loading, tableMissing, add, edit, remove, awayOn, mine, refetch: fetchRows };
}
