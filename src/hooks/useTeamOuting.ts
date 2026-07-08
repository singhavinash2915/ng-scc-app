import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export type OutingStatus = 'going' | 'maybe' | 'out';
export type FoodPref = 'veg' | 'nonveg' | 'either';
export type DrinkPref = 'beer' | 'whisky' | 'soft' | 'none';

export interface OutingRsvp {
  id: string;
  name: string;
  device_id: string | null;
  member_id: string | null;
  status: OutingStatus;
  food_pref: FoodPref | null;
  drink_pref: DrinkPref | null;
  needs_ride: boolean;
  can_drive: boolean;
  note: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const DEVICE_KEY = 'scc-outing-device-id';

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function useTeamOuting() {
  const [rsvps, setRsvps] = useState<OutingRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const myDevice = deviceId();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('outing_rsvps')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { setTableMissing(true); setRsvps([]); }
    else setRsvps((data as OutingRsvp[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const myRsvp = useMemo(() => rsvps.find(r => r.device_id === myDevice) ?? null, [rsvps, myDevice]);

  const submit = async (input: {
    name: string; status: OutingStatus; food_pref?: FoodPref | null; drink_pref?: DrinkPref | null;
    needs_ride?: boolean; can_drive?: boolean; note?: string | null;
  }) => {
    const name = input.name.trim();
    const fields = {
      device_id: myDevice,
      name,
      status: input.status,
      food_pref: input.food_pref ?? null,
      drink_pref: input.drink_pref ?? null,
      needs_ride: input.needs_ride ?? false,
      can_drive: input.can_drive ?? false,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Claim an existing row: my own device row, else a seeded (device-less) row
    // whose name matches — so the 23 confirmed members update their own entry
    // instead of creating a duplicate.
    const nn = norm(name), first = norm(name.split(' ')[0]);
    const target = rsvps.find(r => r.device_id === myDevice)
      ?? rsvps.find(r => !r.device_id && (norm(r.name) === nn || norm(r.name) === first));

    const { error } = target
      ? await supabase.from('outing_rsvps').update(fields).eq('id', target.id)
      : await supabase.from('outing_rsvps').insert(fields);
    if (error) return { success: false, error: error.message };
    await fetch();
    return { success: true };
  };

  // Add one or more attendees by name (comma-separated) as "going".
  const addPeople = async (namesCsv: string) => {
    const names = namesCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return { success: false, error: 'Enter at least one name' };
    const rows = names.map(name => ({ name, status: 'going' as OutingStatus }));
    const { error } = await supabase.from('outing_rsvps').insert(rows);
    if (error) return { success: false, error: error.message };
    await fetch();
    return { success: true, count: names.length };
  };

  // Remove an attendee (admin).
  const removeAttendee = async (id: string) => {
    const { error } = await supabase.from('outing_rsvps').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    await fetch();
    return { success: true };
  };

  // Tallies
  const going = rsvps.filter(r => r.status === 'going');
  const maybe = rsvps.filter(r => r.status === 'maybe');
  const out = rsvps.filter(r => r.status === 'out');
  const food = {
    veg: rsvps.filter(r => r.status !== 'out' && r.food_pref === 'veg').length,
    nonveg: rsvps.filter(r => r.status !== 'out' && r.food_pref === 'nonveg').length,
    either: rsvps.filter(r => r.status !== 'out' && r.food_pref === 'either').length,
  };
  const drinks = {
    beer: rsvps.filter(r => r.status !== 'out' && r.drink_pref === 'beer').length,
    whisky: rsvps.filter(r => r.status !== 'out' && r.drink_pref === 'whisky').length,
    soft: rsvps.filter(r => r.status !== 'out' && r.drink_pref === 'soft').length,
    none: rsvps.filter(r => r.status !== 'out' && r.drink_pref === 'none').length,
  };
  const needRide = rsvps.filter(r => r.status !== 'out' && r.needs_ride);
  const canDrive = rsvps.filter(r => r.status !== 'out' && r.can_drive);

  return { rsvps, myRsvp, loading, tableMissing, submit, addPeople, removeAttendee, refetch: fetch,
    going, maybe, out, food, drinks, needRide, canDrive };
}
