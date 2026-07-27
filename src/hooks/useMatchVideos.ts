import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { youtubeVideoId } from './useLiveStream';

// ─── Match videos: replays + highlight clips ───────────────────────────────────
// A replay is the whole YouTube video; a clip is the SAME video with a start
// timestamp. So "capturing a wicket" costs nothing — just note when it happened.

export type VideoKind = 'replay' | 'clip';

export interface MatchVideo {
  id: string;
  match_id: string;
  video_id: string;
  kind: VideoKind;
  title: string | null;
  start_seconds: number | null;
  member_id: string | null;
  created_at: string;
}

const isMissingTable = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message);

/**
 * Pull a start time out of a pasted YouTube URL.
 *   ...&t=754s   ...&t=754   ...?t=1h2m3s   ...&start=754
 * Returns seconds, or null.
 */
export function parseStartSeconds(url: string): number | null {
  const s = (url || '').trim();
  const m = s.match(/[?&](?:t|start)=([0-9hms]+)/i);
  if (!m) return null;
  const v = m[1];
  if (/^\d+s?$/.test(v)) return parseInt(v, 10);
  const hms = v.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!hms) return null;
  const [, h, mi, se] = hms;
  const total = (parseInt(h || '0', 10) * 3600) + (parseInt(mi || '0', 10) * 60) + parseInt(se || '0', 10);
  return total > 0 ? total : null;
}

/** "12:45" / "1:02:45" / "754" → seconds. For manual entry. */
export function parseTimeInput(input: string): number | null {
  const s = (input || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** seconds → "12:45" */
export function formatTime(sec: number | null): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Watch URL that jumps straight to the moment. */
export function videoWatchUrl(v: Pick<MatchVideo, 'video_id' | 'start_seconds'>): string {
  return `https://www.youtube.com/watch?v=${v.video_id}${v.start_seconds ? `&t=${v.start_seconds}s` : ''}`;
}

/** Embed URL that starts at the moment. */
export function videoEmbedUrl(v: Pick<MatchVideo, 'video_id' | 'start_seconds'>): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (v.start_seconds) params.set('start', String(v.start_seconds));
  return `https://www.youtube-nocookie.com/embed/${v.video_id}?${params}`;
}

/** YouTube's auto-generated thumbnail — free, no storage needed. */
export function videoThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Loads every match video once (the table is small) and exposes helpers to
 * slice by match or by member. Degrades to empty when the table is missing.
 */
export function useMatchVideos() {
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('match_videos')
      .select('*')
      .order('start_seconds', { ascending: true, nullsFirst: true });
    if (error) {
      if (isMissingTable(error)) setTableMissing(true);
      setVideos([]);
    } else {
      setTableMissing(false);
      setVideos((data as MatchVideo[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const byMatch = useMemo(() => {
    const map: Record<string, MatchVideo[]> = {};
    videos.forEach(v => { (map[v.match_id] ||= []).push(v); });
    return map;
  }, [videos]);

  const forMatch = useCallback((matchId: string) => byMatch[matchId] ?? [], [byMatch]);
  const replayFor = useCallback(
    (matchId: string) => (byMatch[matchId] ?? []).find(v => v.kind === 'replay') ?? null,
    [byMatch],
  );
  const clipsFor = useCallback(
    (matchId: string) => (byMatch[matchId] ?? []).filter(v => v.kind === 'clip'),
    [byMatch],
  );
  const forMember = useCallback(
    (memberId: string) => videos.filter(v => v.member_id === memberId && v.kind === 'clip'),
    [videos],
  );

  const addVideo = useCallback(async (input: {
    matchId: string;
    url: string;             // any YouTube link
    kind: VideoKind;
    title?: string;
    startSeconds?: number | null;
    memberId?: string | null;
  }) => {
    const videoId = youtubeVideoId(input.url);
    if (!videoId) return { success: false, error: "Couldn't read a video ID from that link" };
    // Prefer an explicit time, else pull one out of the pasted URL.
    const start = input.kind === 'clip'
      ? (input.startSeconds ?? parseStartSeconds(input.url))
      : null;
    const { error } = await supabase.from('match_videos').insert({
      match_id: input.matchId,
      video_id: videoId,
      kind: input.kind,
      title: input.title?.trim() || null,
      start_seconds: start,
      member_id: input.memberId || null,
    });
    if (error) return { success: false, error: error.message };
    await fetchVideos();
    return { success: true };
  }, [fetchVideos]);

  const deleteVideo = useCallback(async (id: string) => {
    const { error } = await supabase.from('match_videos').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    await fetchVideos();
    return { success: true };
  }, [fetchVideos]);

  return { videos, loading, tableMissing, forMatch, replayFor, clipsFor, forMember, addVideo, deleteVideo, refetch: fetchVideos };
}
