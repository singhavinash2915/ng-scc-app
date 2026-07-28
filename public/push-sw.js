/* eslint-env serviceworker */
/* global self, clients */
// ─── SCC push notification handlers ────────────────────────────────────────────
// Imported into the Workbox-generated service worker (see vite.config.ts →
// workbox.importScripts). Keeping this separate means vite-plugin-pwa can keep
// generating the precache SW while we own the push behaviour.

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Sangria CC', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Sangria Cricket Club';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/scc-logo.jpg',
    badge: '/scc-logo.jpg',
    tag: payload.tag || 'scc',
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url || '/' },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus an open SCC tab and route it, else open a new one.
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    }),
  );
});
