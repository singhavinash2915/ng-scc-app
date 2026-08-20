// ─── send-push ─────────────────────────────────────────────────────────────────
// Fans a web-push notification out to every subscribed device.
//
// Deploy:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//     VAPID_SUBJECT=mailto:sangriacricket@gmail.com
//   supabase functions deploy send-push
//
// Call from the app:
//   supabase.functions.invoke('send-push', { body: { title, body, url } })
//   ...add memberId to reach ONE member instead of the whole club.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // memberId targets ONE person. Without it this broadcasts, which is right
    // for "match day tomorrow" and completely wrong for "Avinash challenged
    // you" — 46 people getting a notification about someone else's challenge
    // is how an app gets muted for good.
    const { title, body, url, tag, memberId } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sangriacricket@gmail.com';
    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    let q = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth');
    if (memberId) q = q.eq('member_id', memberId);
    const { data: subs, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/', tag: tag ?? 'scc' });

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(((subs ?? []) as Sub[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        // 404/410 mean the subscription is dead — prune it.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
      }
    }));

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('id', stale);
    }

    return new Response(
      JSON.stringify({ sent, failed: (subs?.length ?? 0) - sent, pruned: stale.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
