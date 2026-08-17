import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/Card';
import { Scissors, Eye, MessageSquare, Check, Trash2 } from 'lucide-react';
import { useLiveViewers, useClipMarks } from '../hooks/useLiveAddons';
import { formatTime } from '../hooks/useMatchVideos';

interface Props {
  videoId: string;
  matchId?: string | null;
  /** Display name for presence + who marked a moment. */
  name?: string;
  memberId?: string | null;
  isAdmin?: boolean;
}

/**
 * Everything that sits under the live player: "watching now" presence, a
 * "Clip that!" button that timestamps the moment, and YouTube's own live chat.
 *
 * Clip marks are seconds-since-the-page-opened-the-stream. That's close enough
 * for finding the moment in the replay afterwards — an admin nudges the exact
 * time when converting the mark into a real clip.
 */
export function LiveAddons({ videoId, matchId, name, memberId, isAdmin }: Props) {
  const { count, names } = useLiveViewers(videoId, name);
  const { marks, tableMissing, markMoment, deleteMark } = useClipMarks(videoId);
  const [justMarked, setJustMarked] = useState(false);
  const [label, setLabel] = useState('');
  const [showChat, setShowChat] = useState(false);
  const startedAt = useRef(Date.now());

  // Reset the stopwatch if the stream changes
  useEffect(() => { startedAt.current = Date.now(); }, [videoId]);

  const clipIt = async () => {
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    const res = await markMoment(seconds, { label, matchId, name, memberId });
    if (res.success) {
      setJustMarked(true);
      setLabel('');
      setTimeout(() => setJustMarked(false), 2200);
    }
  };

  const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;

  return (
    <div className="space-y-3">
      {/* Watching now + Clip that */}
      <div className="flex items-center gap-2 flex-wrap">
        {count > 0 && (
          <span
            title={names.length ? names.join(', ') : undefined}
            className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-xs font-bold text-white"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Eye className="w-3.5 h-3.5" />
            {count} watching
          </span>
        )}

        {!tableMissing && (
          <button
            onClick={clipIt}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition-transform active:scale-95 ${
              justMarked ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
            }`}
          >
            {justMarked ? <><Check className="w-3.5 h-3.5" /> Marked!</> : <><Scissors className="w-3.5 h-3.5" /> Clip that!</>}
          </button>
        )}

        <button
          onClick={() => setShowChat(s => !s)}
          className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" /> {showChat ? 'Hide chat' : 'Live chat'}
        </button>
      </div>

      {!tableMissing && (
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Optional: what happened? (e.g. Avinash bowls him 🔥)"
          className="w-full r-control bg-white/90 text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      )}

      {/* Marked moments */}
      {marks.length > 0 && (
        <Card className="bg-white/5 border-white/10 p-3">
          <p className="t-micro font-bold uppercase tracking-wider text-white/50 mb-2">
            ✂️ Marked moments · {marks.length}
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {marks.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className="t-num text-amber-300 w-12">{formatTime(m.seconds)}</span>
                <span className="flex-1 truncate text-white/80">{m.label || 'Moment'}</span>
                <span className="text-white/40 t-micro truncate max-w-[70px]">{m.marked_by}</span>
                {m.converted && <span className="text-emerald-400 t-micro font-bold">✓ clipped</span>}
                {isAdmin && (
                  <button onClick={() => deleteMark(m.id)} className="text-white/30 hover:text-rose-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <p className="t-micro text-white/40 mt-2">
              💡 After the match, add these as clips from the match card using the replay link + these times.
            </p>
          )}
        </Card>
      )}

      {/* YouTube's own live chat */}
      {showChat && (
        <div className="r-card overflow-hidden border border-white/10 bg-black" style={{ height: 380 }}>
          <iframe
            src={chatUrl}
            title="Live chat"
            className="w-full h-full"
            frameBorder="0"
          />
        </div>
      )}
    </div>
  );
}
