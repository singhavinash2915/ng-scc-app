import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── The dates the club can actually play ─────────────────────────────────────
// The fixture list is not the calendar. Ground slots are booked and paid for a
// season ahead — 98 of them at the moment — while a `matches` row only appears
// once someone gets round to creating it. Twenty-one of those 98 have a fixture.
//
// So anything that asks "is there cricket on this date" has to read the
// bookings. Asking the fixture list gives the wrong answer for most of the
// season, and silently: a booked slot with no fixture row simply looks like an
// ordinary day.
//
// It also decides WHICH days are playable at all. SCC plays Tuesday, Thursday
// and Saturday mornings, not Sundays — so a scheduling screen that offers
// weekends is offering dates the club has no ground for.

export interface GroundDate {
  id: string;
  date: string;
  venue: string | null;
  time_slot: string | null;
  status: string;
  /** Set when a fixture row has been created for this slot. Usually null. */
  match_id: string | null;
  opponent_name: string | null;
}

export function useGroundDates() {
  const [bookings, setBookings] = useState<GroundDate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDates = useCallback(async () => {
    const { data, error } = await supabase
      .from('ground_bookings')
      .select('id, date, venue, time_slot, status, match_id, opponent_name')
      .order('date', { ascending: true });
    setBookings(error ? [] : ((data ?? []) as GroundDate[]));
    setLoading(false);
  }, []);

  useEffect(() => { void fetchDates(); }, [fetchDates]);

  /** Cancelled slots are not playable; only live bookings count as a play date. */
  const live = useMemo(
    () => bookings.filter(b => b.status !== 'cancelled'), [bookings]);

  const dates = useMemo(() => new Set(live.map(b => b.date)), [live]);

  const byDate = useMemo(() => {
    const m = new Map<string, GroundDate>();
    for (const b of live) if (!m.has(b.date)) m.set(b.date, b);
    return m;
  }, [live]);

  /** Booked slots from today onwards, in order — the club's real calendar. */
  const upcoming = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return live.filter(b => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  }, [live]);

  return { bookings: live, dates, byDate, upcoming, loading, refetch: fetchDates };
}
