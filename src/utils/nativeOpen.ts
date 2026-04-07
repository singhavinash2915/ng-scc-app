import { Capacitor } from '@capacitor/core';

/**
 * Opens a URL. Uses @capacitor/browser on native (SFSafariViewController on iOS,
 * Chrome Custom Tab on Android) and window.open on web.
 */
export async function openUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}
