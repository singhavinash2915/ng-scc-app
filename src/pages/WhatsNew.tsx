import { useEffect } from 'react';
import { Sparkles, Zap, Wrench, CheckCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { RELEASES, CURRENT_VERSION, STORAGE_KEY } from '../data/releases';

const TAG_CONFIG = {
  new:      { label: 'New',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: Sparkles },
  improved: { label: 'Improved', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',            Icon: Zap },
  fixed:    { label: 'Fixed',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         Icon: Wrench },
};

export function WhatsNew() {
  // Mark as seen when this page is visited
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
  }, []);

  return (
    <div>
      <Header title="What's New" subtitle="Latest updates, features & fixes" />

      <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-8 pb-16">

        {RELEASES.map((release, ri) => (
          <div key={release.version} className="relative">

            {/* Timeline connector */}
            {ri < RELEASES.length - 1 && (
              <div className="absolute left-4 top-12 bottom-0 w-px bg-gray-200 dark:bg-gray-800 -mb-8" />
            )}

            {/* Release header */}
            <div className="flex items-start gap-3 mb-4">
              <div className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                ri === 0
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                {ri === 0
                  ? <Sparkles className="w-4 h-4 text-white" />
                  : <CheckCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                }
                {ri === 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-base font-black ${ri === 0 ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {release.title}
                  </h2>
                  {ri === 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-full">
                      Latest
                    </span>
                  )}
                </div>
                {release.subtitle && (
                  <p className="text-xs text-gray-500 mt-0.5">{release.subtitle}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                  {release.date} · v{release.version}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className={`ml-11 rounded-2xl overflow-hidden border ${
              ri === 0
                ? 'border-emerald-200 dark:border-emerald-900/50'
                : 'border-gray-100 dark:border-gray-800'
            }`}>
              {release.notes.map((note, ni) => {
                const tagCfg = note.tag ? TAG_CONFIG[note.tag] : null;
                return (
                  <div
                    key={ni}
                    className={`flex items-start gap-3 p-3.5 ${
                      ni < release.notes.length - 1
                        ? 'border-b border-gray-100 dark:border-gray-800'
                        : ''
                    } hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{note.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{note.title}</p>
                        {tagCfg && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${tagCfg.cls}`}>
                            <tagCfg.Icon className="w-2.5 h-2.5" />
                            {tagCfg.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{note.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pt-4">
          🏏 Sangria Cricket Club App · Built with ❤️ for the team
        </p>
      </div>
    </div>
  );
}
