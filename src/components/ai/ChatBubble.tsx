import { Suspense, lazy, useState } from 'react';
import { useLocation } from 'react-router-dom';

// ChatPanel pulls most of the club's data through useClubChat. Lazy, so a page
// that nobody opens the chat on never loads it — and, more importantly, never
// runs its queries. This import must stay lazy: making it eager would put ten
// extra requests on every page in the app.
const ChatPanel = lazy(() =>
  import('./ChatPanel').then(m => ({ default: m.ChatPanel })));

// ─── Ask SCC ──────────────────────────────────────────────────────────────────
// The chat used to be a tab inside a page that gets 7 visits a week. Nobody
// navigates to be shown things — so it comes to them instead.
//
// The mounted-everywhere part is deliberately just a button: no hooks, no
// fetches, no cost until somebody taps it.

/** Single-task screens reached from a WhatsApp link. Someone confirming a squad
 *  place has fifteen seconds of patience and one decision to make; a chat bubble
 *  there is an interruption at the worst possible moment. */
const HIDE_ON = [/^\/squad\//, /^\/poll\//, /^\/live\//, /^\/watch/, /^\/book-match/, /^\/score\//];

export function ChatBubble() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  /** Once opened, the panel stays mounted for the session so reopening is
   *  instant rather than re-fetching the club from scratch. */
  const [everOpened, setEverOpened] = useState(false);

  if (HIDE_ON.some(re => re.test(pathname))) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => { setOpen(true); setEverOpened(true); }}
          aria-label="Ask SCC"
          // Above the mobile nav (fixed bottom-0, z-50) so it never covers it.
          // The badge is dark and already circular, so it needs no green disc
          // behind it — a coloured ring would fight the gold it already has.
          className="fixed right-4 bottom-20 lg:bottom-6 z-[55] w-14 h-14 rounded-full
                     overflow-hidden shadow-xl ring-2 ring-white/80 dark:ring-white/25
                     active:scale-95 transition-transform bg-[#0b1020]">
          <img src="/ai-bot.png" alt="" className="w-full h-full object-cover" />
        </button>
      )}

      {everOpened && (
        <div className={`fixed inset-0 z-[60] ${open ? '' : 'hidden'}`}>
          <button aria-label="Close chat" onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40" />
          <div className="absolute right-0 bottom-0 lg:right-6 lg:bottom-6
                          w-full lg:w-[400px] h-[85vh] lg:h-[600px]
                          bg-white dark:bg-slate-900 lg:r-card rounded-t-2xl lg:rounded-2xl
                          shadow-2xl overflow-hidden flex flex-col">
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <p className="t-meta text-slate-400">Getting the club's data…</p>
              </div>
            }>
              <ChatPanel onClose={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
