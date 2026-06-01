import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { RELEASES, CURRENT_VERSION, STORAGE_KEY } from '../data/releases';

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== CURRENT_VERSION) {
      // Small delay so the page renders first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  if (!open) return null;

  const latest   = RELEASES[0];
  const older    = RELEASES.slice(1);

  const tagColor = (tag?: string) => {
    if (tag === 'new')      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (tag === 'improved') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    if (tag === 'fixed')    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return '';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={dismiss}
      >
        {/* Modal */}
        <div
          className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900"
          onClick={e => e.stopPropagation()}
          style={{ animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Header gradient */}
          <div className="relative overflow-hidden flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)' }}>
            <div className="absolute inset-0 opacity-20"
                 style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-[2px]">
                      What's New · v{latest.version}
                    </p>
                    <h2 className="text-white text-xl font-black leading-tight">{latest.title}</h2>
                    {latest.subtitle && (
                      <p className="text-emerald-200/80 text-xs mt-0.5">{latest.subtitle}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-emerald-300/60 text-[10px] mt-2 font-medium">{latest.date}</p>
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-1">
              {latest.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <span className="text-xl flex-shrink-0 mt-0.5">{n.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
                      {n.tag && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${tagColor(n.tag)}`}>
                          {n.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Older releases collapsible */}
            {older.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowOlder(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <span>Previous releases</span>
                  {showOlder ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showOlder && (
                  <div className="px-4 pb-4 space-y-4">
                    {older.map(r => (
                      <div key={r.version}>
                        <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-2 px-1">
                          {r.title} · {r.date}
                        </p>
                        {r.notes.map((n, i) => (
                          <div key={i} className="flex items-start gap-2.5 py-1.5 px-1">
                            <span className="text-base flex-shrink-0">{n.emoji}</span>
                            <div>
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{n.title}</p>
                              <p className="text-[11px] text-gray-400">{n.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors"
            >
              Got it, let's go! 🏏
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
