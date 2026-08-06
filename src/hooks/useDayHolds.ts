import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── Book-a-Match: admin day holds ─────────────────────────────────────────────
// A day can be taken off the public calendar for three reasons. The important
// one is 'offline': teams routinely pay the admin directly rather than booking
// through the app, and before this there was nowhere to record that — the date
// looked free, and the money left no trace.

/**
 * 'open' is the odd one out: it doesn't hold a day, it FREES one. Some dates are
 * held automatically by the league schedule, and when a fixture moves or an
 * opponent pulls out the admin needs to put that Saturday back on sale. An
 * override row is the only way to remember that decision — the auto rule would
 * otherwise re-hold the date on every page load.
 */
export type HoldKind = 'internal' | 'offline' | 'blocked' | 'open';

export interface DayHold {
  id: string;
  date: string;
  kind: HoldKind;
  team_name: string | null;
  contact_phone: string | null;
  amount: number | null;
  note: string | null;
}

export const HOLD_KINDS: Array<{
  key: HoldKind; label: string; emoji: string;
  /** What outsiders are told. An offline booking is just "booked" to them. */
  publicLabel: string;
  blurb: string;
  cls: string;
}> = [
  {
    key: 'offline', label: 'Booked offline', emoji: '💰', publicLabel: 'Booked',
    blurb: 'A team paid you directly. Records who and how much.',
    cls: 'text-emerald-600',
  },
  {
    key: 'internal', label: 'SCC League match', emoji: '🏏', publicLabel: 'SCC League',
    blurb: 'Brahmos vs Agni. Shown to members as a league day.',
    cls: 'text-violet-600',
  },
  {
    key: 'blocked', label: 'Ground unavailable', emoji: '🚧', publicLabel: 'Unavailable',
    blurb: 'Maintenance, festival, weather — nobody can book it.',
    cls: 'text-slate-600',
  },
];

export const holdMeta = (kind: HoldKind) =>
  HOLD_KINDS.find(k => k.key === kind) ?? HOLD_KINDS[1];

/** Reopening a date the league schedule holds by default. */
export const OPEN_KIND: HoldKind = 'open';

const isMissingTable = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

/** True when add_day_hold_kinds.sql hasn't run yet. */
const isMissingColumn = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204');

export function useDayHolds() {
  const [holds, setHolds] = useState<DayHold[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const fetchHolds = useCallback(async () => {
    let res = await supabase.from('scc_internal_match_days')
      .select('id,date,kind,team_name,contact_phone,amount,note');

    // Before the migration only date/note exist — still show those days as
    // league holds rather than letting the whole calendar lose its reservations.
    if (isMissingColumn(res.error)) {
      setNeedsMigration(true);
      res = await supabase.from('scc_internal_match_days')
        .select('id,date,note') as typeof res;
    } else if (!res.error) {
      setNeedsMigration(false);
    }

    if (isMissingTable(res.error)) { setTableMissing(true); return; }
    setTableMissing(false);
    setHolds(((res.data ?? []) as Partial<DayHold>[]).map(h => ({
      id: h.id!, date: h.date!, kind: (h.kind ?? 'internal') as HoldKind,
      team_name: h.team_name ?? null, contact_phone: h.contact_phone ?? null,
      amount: h.amount ?? null, note: h.note ?? null,
    })));
  }, []);

  useEffect(() => { fetchHolds(); }, [fetchHolds]);

  const byDate = useMemo(
    () => Object.fromEntries(holds.map(h => [h.date, h])) as Record<string, DayHold>,
    [holds],
  );

  /** Days actually taken off the calendar (an 'open' row does the opposite). */
  const blocking = useMemo(() => holds.filter(h => h.kind !== OPEN_KIND), [holds]);

  /** Days the admin has forced back on sale despite the league auto-hold. */
  const openDates = useMemo(
    () => new Set(holds.filter(h => h.kind === OPEN_KIND).map(h => h.date)),
    [holds],
  );

  /** Put a day on hold, or update the hold already on it. */
  const holdDay = useCallback(async (input: {
    date: string; kind: HoldKind; teamName?: string;
    contactPhone?: string; amount?: number | null; note?: string;
  }) => {
    setBusyDate(input.date);
    const full = {
      date: input.date,
      kind: input.kind,
      team_name: input.teamName?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      amount: input.amount ?? null,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('scc_internal_match_days')
      .upsert(full, { onConflict: 'date' });

    // Migration not run? Keep the hold working with just the old columns
    // rather than refusing to reserve the day at all.
    if (isMissingColumn(error)) {
      setNeedsMigration(true);
      ({ error } = await supabase.from('scc_internal_match_days').upsert(
        { date: input.date, note: full.note ?? holdMeta(input.kind).label },
        { onConflict: 'date' },
      ));
    }
    await fetchHolds();
    setBusyDate(null);
    return error?.message ?? null;
  }, [fetchHolds]);

  /** Release a day back to the public calendar. */
  const releaseDay = useCallback(async (date: string) => {
    setBusyDate(date);
    const { error } = await supabase.from('scc_internal_match_days').delete().eq('date', date);
    await fetchHolds();
    setBusyDate(null);
    return error?.message ?? null;
  }, [fetchHolds]);

  /** Put a league-held day back on sale — the fixture moved, or SCC pulled out. */
  const openDay = useCallback(
    (date: string, note?: string) => holdDay({ date, kind: OPEN_KIND, note }),
    [holdDay],
  );

  /** What the offline bookings have brought in — money the app never saw. */
  const offlineTotal = useMemo(
    () => holds.filter(h => h.kind === 'offline').reduce((n, h) => n + (h.amount ?? 0), 0),
    [holds],
  );

  return {
    holds, blocking, openDates, byDate, tableMissing, needsMigration, busyDate,
    holdDay, releaseDay, openDay, offlineTotal, refetch: fetchHolds,
  };
}
