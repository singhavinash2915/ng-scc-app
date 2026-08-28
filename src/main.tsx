import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';

async function init() {
  const isNative = Capacitor.isNativePlatform();

  // Register PWA service worker only on web — not inside Capacitor WebView.
  // The import('virtual:pwa-register') is guarded by VITE_PLATFORM so Rollup
  // doesn't try to resolve it during native builds (where VitePWA is disabled).
  if (!isNative && import.meta.env.VITE_PLATFORM !== 'native') {
    // One-time purge of the v1 Supabase API cache that used a 1-hour TTL.
    // Users still running the old SW will hit this before the new SW activates,
    // so they immediately stop seeing stale match / member data.
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => k === 'supabase-api-cache' || k.startsWith('workbox-'))
            .map(k => caches.delete(k))
        );
      } catch {
        /* ignore — best-effort cleanup */
      }
    }

    const { registerSW } = await import('virtual:pwa-register');
    // Silent auto-update. Members should never have to "refresh twice" to see
    // something we just shipped — critical for the LIVE banner reaching phones
    // mid-match. We poll for a new build and reload as soon as one is ready.
    const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => {
          // Don't fight the network while offline or while the tab is hidden.
          if (navigator.onLine && document.visibilityState === 'visible') {
            registration.update().catch(() => { /* best-effort */ });
          }
        };
        setInterval(check, UPDATE_INTERVAL);
        // Also check the moment someone returns to the tab.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
      onNeedRefresh() {
        // A new build is waiting — activate and reload straight away.
        updateSW(true).catch(() => { /* best-effort */ });
      },
    });
  }

  // Native-only: status bar + Android back button
  if (isNative) {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { App: CapApp } = await import('@capacitor/app');

    // Match the app's primary green colour
    StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      StatusBar.setBackgroundColor({ color: '#064e3b' });
    }

    // Android back button: go back in history or exit app
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Clear the boot splash once React has actually painted. Two frames, not a
  // timer: the first commits the tree, the second is after the browser has
  // drawn it — removing it any earlier flashes white between the splash going
  // and the app appearing, which is worse than the wait it replaced.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const splash = document.getElementById('scc-splash');
    if (!splash) return;
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 320);   // after the fade
  }));
}

init();
