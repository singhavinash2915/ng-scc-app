import { useEffect, useRef, useState } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { useClubChat, type ChatMessage } from '../../hooks/useClubChat';
import { RichText } from './RichText';

// ─── The chat itself ──────────────────────────────────────────────────────────
// Lives behind a lazy boundary. Mounting this mounts useClubChat, which pulls
// most of the club's data — so it must never be rendered until somebody has
// actually opened the chat.

const STARTERS = [
  'Who is the captain of Brahmos?',
  'Who is the captain of Agni?',
  "Who's away in November?",
  'Who has the most wickets this season?',
  'When do we play next?',
];

interface Props { onClose: () => void }

export function ChatPanel({ onClose }: Props) {
  const { ask, left, limit } = useClubChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setBusy(true);
    const answer = await ask(text);
    setMessages(m => [...m, { role: 'ai', text: answer }]);
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div className="w-8 h-8 r-control bg-emerald-500 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black t-body text-slate-900 dark:text-white leading-tight">Ask SCC</p>
          <p className="t-micro text-slate-400">
            {left > 0 ? `${left} of ${limit} questions left today` : 'Back tomorrow'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="w-9 h-9 r-control flex items-center justify-center text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <>
            <p className="t-meta text-slate-500 dark:text-white/50">
              Anything about the club — squads, stats, who's away, what's booked.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STARTERS.map(q => (
                <button key={q} onClick={() => void send(q)}
                  className="t-micro font-bold px-2.5 py-1.5 rounded-full border
                             border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70">
                  {q}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 r-card t-body leading-relaxed
                             break-words ${
              m.role === 'user'
                ? 'bg-emerald-500 text-white rounded-tr-sm whitespace-pre-wrap'
                : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-tl-sm'}`}>
              {m.role === 'ai' ? <RichText text={m.text} /> : m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="px-3.5 py-3 r-card bg-slate-100 dark:bg-white/10 flex gap-1">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-white/10 flex gap-2">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void send(); }}
          placeholder={left > 0 ? 'Ask about SCC…' : 'Daily limit reached'}
          disabled={busy || left <= 0}
          className="flex-1 px-3.5 py-2.5 r-control bg-slate-50 dark:bg-white/5 border
                     border-slate-200 dark:border-white/10 t-body text-slate-900 dark:text-white
                     disabled:opacity-50" />
        <button onClick={() => void send()} disabled={busy || !input.trim() || left <= 0}
          aria-label="Send"
          className="w-11 h-11 r-control bg-emerald-500 text-white flex items-center
                     justify-center shrink-0 disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
