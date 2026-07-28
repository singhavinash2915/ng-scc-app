import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Live add-ons: clip marks + "watching now" presence ────────────────────────

const DEVICE_KEY = 'scc-live-device-id';
const VIEWER_WINDOW_MS = 2 * 60 * 1000;  // seen within 2 min = still watching
const HEARTBEAT_MS = 30 * 1000;

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const isMissingTable = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message);

export interface ClipMark {
  id: string;
  video_id: string;
  match_id: string | null;
  seconds: number;
  label: string | null;
  marked_by: string | null;
  member_id: string | null;
  converted: boolean;
  created_at: string;
}

/**
 * "Watching now" presence. Sends a heartbeat while the page is open and
 * reports how many devices have been seen recently. Degrades to 0 silently
 * if the table hasn't been created.
 */
export function useLiveViewers(videoId: string | null, name?: string) {
  const [count, setCount] = useState(0);
  const [names, setNames] = useState<string[]>([]);
  const myDevice = useRef(deviceId()).current;

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      await supabase.from('live_viewers').upsert(
        { device_id: myDevice, name: name || null, video_id: videoId, last_seen: new Date().toISOString() },
        { onConflict: 'device_id' },
      );
      const since = new Date(Date.now() - VIEWER_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('live_viewers')
        .select('name')
        .eq('video_id', videoId)
        .gte('last_seen', since);
      if (cancelled) return;
      if (error) { setCount(0); return; }
      const rows = data || [];
      setCount(rows.length);
      setNames(rows.map(r => (r as { name: string | null }).name).filter(Boolean) as string[]);
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [videoId, name, myDevice]);

  return { count, names };
}

/**
 * "Clip that!" — members mark moments during the stream; an admin converts the
 * marks into real clips afterwards.
 */
export function useClipMarks(videoId: string | null) {
  const [marks, setMarks] = useState<ClipMark[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const myDevice = useRef(deviceId()).current;

  const fetchMarks = useCallback(async () => {
    if (!videoId) { setMarks([]); return; }
    const { data, error } = await supabase
      .from('live_clip_marks')
      .select('*')
      .eq('video_id', videoId)
      .order('seconds', { ascending: true });
    if (error) {
      if (isMissingTable(error)) setTableMissing(true);
      setMarks([]);
    } else {
      setTableMissing(false);
      setMarks((data as ClipMark[]) || []);
    }
  }, [videoId]);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  /** Mark the current moment. `seconds` = time since the stream started. */
  const markMoment = useCallback(async (seconds: number, opts?: {
    label?: string; matchId?: string | null; name?: string; memberId?: string | null;
  }) => {
    if (!videoId) return { success: false, error: 'No stream' };
    const { error } = await supabase.from('live_clip_marks').insert({
      video_id: videoId,
      match_id: opts?.matchId ?? null,
      seconds: Math.max(0, Math.round(seconds)),
      label: opts?.label?.trim() || null,
      marked_by: opts?.name || myDevice.slice(0, 8),
      member_id: opts?.memberId ?? null,
    });
    if (error) return { success: false, error: error.message };
    await fetchMarks();
    return { success: true };
  }, [videoId, myDevice, fetchMarks]);

  const deleteMark = useCallback(async (id: string) => {
    const { error } = await supabase.from('live_clip_marks').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    await fetchMarks();
    return { success: true };
  }, [fetchMarks]);

  const markConverted = useCallback(async (id: string) => {
    await supabase.from('live_clip_marks').update({ converted: true }).eq('id', id);
    await fetchMarks();
  }, [fetchMarks]);

  return { marks, tableMissing, markMoment, deleteMark, markConverted, refetch: fetchMarks };
}
