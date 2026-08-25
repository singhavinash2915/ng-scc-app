import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Live Stream (YouTube) ─────────────────────────────────────────────────────
// Phase 1 "phone-only": an admin streams from a phone straight to YouTube Live,
// then pastes the video link here. The app shows a LIVE banner + an embedded
// player next to our own live scorecard. YouTube does all the heavy lifting
// (ingest, transcoding, delivery, unlimited viewers) — we just embed it.

const STREAM_KEY = 'live_stream';

export interface LiveStreamSettings {
  is_live: boolean;
  youtube_url: string;      // full watch/live/share URL, or a bare video id
  title: string;            // e.g. "SCC vs Tinsel County"
  ch_match_id: string;      // optional CricHeroes id → pairs the stream with our live scorecard
  channel_url: string;      // channel link, used for the replay archive CTA
}

export const defaultLiveStream: LiveStreamSettings = {
  is_live: false,
  youtube_url: '',
  title: '',
  ch_match_id: '',
  channel_url: '',
};

/**
 * Pull the YouTube video id out of any of the shapes people paste:
 *   https://www.youtube.com/watch?v=ID    youtu.be/ID
 *   https://www.youtube.com/live/ID       /embed/ID       or a bare ID
 * Returns null when nothing usable is found.
 */
export function youtubeVideoId(input: string): string | null {
  const s = (input || '').trim();
  if (!s) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  // Bare id (no slashes / spaces)
  if (/^[A-Za-z0-9_-]{6,}$/.test(s)) return s;
  return null;
}

/** Privacy-friendly embed URL for a video id. */
export function youtubeEmbedUrl(videoId: string, autoplay = false): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    ...(autoplay ? { autoplay: '1', mute: '1' } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function useLiveStream() {
  const [stream, setStream] = useState<LiveStreamSettings>(defaultLiveStream);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStream = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_configs')
      .select('value')
      .eq('key', STREAM_KEY)
      .maybeSingle();
    if (!error && data?.value) {
      setStream({ ...defaultLiveStream, ...(data.value as Partial<LiveStreamSettings>) });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStream(); }, [fetchStream]);

  // Live, not polled. On a 60s interval a member opening the app just after
  // the switch is flipped waited up to a minute to be told there's cricket on,
  // and the banner outlived the match by the same amount. Both are the worst
  // possible minute to be wrong in.
  //
  // The poll is kept as a slow backstop: realtime can silently drop a
  // connection (backgrounded tab, flaky ground wifi) and the banner is not
  // something that should be able to get stuck on because a socket died.
  useEffect(() => {
    const channel = supabase
      .channel('live_stream_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_configs', filter: `key=eq.${STREAM_KEY}` },
        () => { fetchStream(); })
      .subscribe();
    const id = setInterval(() => { fetchStream(); }, 5 * 60_000);
    return () => { supabase.removeChannel(channel); clearInterval(id); };
  }, [fetchStream]);

  const saveStream = useCallback(async (next: LiveStreamSettings) => {
    setSaving(true);
    const { error } = await supabase
      .from('app_configs')
      .upsert({ key: STREAM_KEY, value: next as unknown as Record<string, unknown> }, { onConflict: 'key' });
    setSaving(false);
    if (error) return { success: false, error: error.message };
    setStream(next);
    return { success: true };
  }, []);

  const videoId = youtubeVideoId(stream.youtube_url);
  // Only treat it as live when the switch is on AND we have a usable video.
  const isLive = stream.is_live && !!videoId;

  return { stream, videoId, isLive, loading, saving, saveStream, refetch: fetchStream };
}
