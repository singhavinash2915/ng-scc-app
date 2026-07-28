import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { VAPID_PUBLIC_KEY } from '../config/push';

// ─── Web push notifications ────────────────────────────────────────────────────
// Members opt in once; we store their push endpoint and the send-push Edge
// Function delivers "🔴 SCC is LIVE", match reminders and so on.
//
// iOS note: Safari only allows push for apps ADDED TO THE HOME SCREEN. We detect
// that and show the right guidance instead of a button that can't work.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

export type PushStatus =
  | 'unsupported'      // browser can't do push at all
  | 'needs-install'    // iOS Safari, not added to home screen yet
  | 'default'          // supported, not yet asked
  | 'granted'          // subscribed
  | 'denied';          // user blocked notifications

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

  useEffect(() => {
    if (!supported) {
      setStatus(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    if (isIos() && !isStandalone()) { setStatus('needs-install'); return; }
    setStatus(Notification.permission as PushStatus);
  }, [supported]);

  const subscribe = useCallback(async (opts?: { memberId?: string | null; name?: string }) => {
    setBusy(true); setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission as PushStatus);
        return { success: false, error: 'Permission not granted' };
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Could not read the push subscription');
      }

      const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        member_id: opts?.memberId ?? null,
        name: opts?.name ?? null,
        user_agent: navigator.userAgent.slice(0, 200),
        last_seen: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (dbErr) throw new Error(dbErr.message);

      setStatus('granted');
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not enable notifications';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('default');
      return { success: true };
    } finally {
      setBusy(false);
    }
  }, []);

  /** Admin: fan a notification out to everyone who opted in. */
  const sendToAll = useCallback(async (payload: { title: string; body: string; url?: string; tag?: string }) => {
    const { data, error: fnErr } = await supabase.functions.invoke('send-push', { body: payload });
    if (fnErr) return { success: false, error: fnErr.message };
    return { success: true, result: data as { sent?: number; failed?: number } };
  }, []);

  return { status, supported, busy, error, subscribe, unsubscribe, sendToAll };
}
