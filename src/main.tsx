import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';

async function init() {
  const isNative = Capacitor.isNativePlatform();

  // Register PWA service worker only on web — not inside Capacitor WebView
  if (!isNative) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
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
}

init();
