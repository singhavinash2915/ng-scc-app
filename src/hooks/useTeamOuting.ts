import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export type OutingStatus = 'going' | 'maybe' | 'out';
export type FoodPref = 'veg' | 'nonveg' | 'either';

export interface OutingRsvp {
  id: string;
  name: string;
  device_id: string | null;
  member_id: string | null;
  status: OutingStatus;
  food_pref: FoodPref | null;
  needs_ride: boolean;
  can_drive: boolean;
  note: string | null;
}

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
    name: string; status: OutingStatus; food_pref?: FoodPref | null;
    needs_ride?: boolean; can_drive?: boolean; note?: string | null;
  }) => {
    const row = {
      device_id: myDevice,
      name: input.name.trim(),
      status: input.status,
      food_pref: input.food_pref ?? null,
      needs_ride: input.needs_ride ?? false,
      can_drive: input.can_drive ?? false,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('outing_rsvps')
      .upsert(row, { onConflict: 'device_id' });
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
  const needRide = rsvps.filter(r => r.status !== 'out' && r.needs_ride);
  const canDrive = rsvps.filter(r => r.status !== 'out' && r.can_drive);

  return { rsvps, myRsvp, loading, tableMissing, submit, refetch: fetch,
    going, maybe, out, food, needRide, canDrive };
}
