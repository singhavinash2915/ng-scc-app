import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem('scc-pwa-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Android / Chrome: Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: Detect Safari on iOS (not standalone)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isInStandaloneMode) {
      setShowIOSPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('scc-pwa-dismissed', 'true');
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50 animate-fade-in-up">
      <div className="bg-primary-600 text-white rounded-xl shadow-lg p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <Download className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install SCC App</p>

          {/* Android prompt */}
          {deferredPrompt && (
            <>
              <p className="text-xs text-primary-100 mt-1">
                Add to your home screen for quick access
              </p>
              <button
                onClick={handleInstall}
                className="mt-2 px-4 py-1.5 bg-white text-primary-700 text-xs font-semibold rounded-lg hover:bg-primary-50 transition-colors"
              >
                Install Now
              </button>
            </>
          )}

          {/* iOS prompt */}
          {showIOSPrompt && !deferredPrompt && (
            <div className="text-xs text-primary-100 mt-1 space-y-1">
              <p className="flex items-center gap-1">
                1. Tap the <Share className="w-3.5 h-3.5 inline" /> Share button
              </p>
              <p className="flex items-center gap-1">
                2. Tap <PlusSquare className="w-3.5 h-3.5 inline" /> Add to Home Screen
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
