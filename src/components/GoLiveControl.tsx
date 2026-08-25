import { useState } from 'react';
import { Radio, Youtube, X } from 'lucide-react';
import { useLiveStream, youtubeVideoId } from '../hooks/useLiveStream';

// ─── Go live, from where you already are ──────────────────────────────────────
// Starting a stream meant opening Settings, scrolling a long page, pasting a
// URL and ticking a box — on a phone, at a ground, with a match about to start.
// That friction is the whole reason a built feature never got used once.
//
// So the control lives on the match-day card instead: the screen an admin is
// already looking at on the only day it applies. Same stored settings, same
// switch — just reachable in one tap instead of six.

interface Props {
  /** Prefills the stream title so nobody has to type it at the ground. */
  matchTitle: string;
  /** Pairs the stream with our live scorecard when we have a CricHeroes id. */
  chMatchId?: string | null;
}

export function GoLiveControl({ matchTitle, chMatchId }: Props) {
  const { stream, isLive, saving, saveStream } = useLiveStream();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    const id = youtubeVideoId(url);
    // Checked before saving, not after. Saving is_live with an unusable URL is
    // how you get a LIVE banner over a player that shows nothing.
    if (!id) { setErr("That doesn't look like a YouTube link — paste the whole share URL."); return; }
    setErr(null);
    const res = await saveStream({
      ...stream,
      is_live: true,
      youtube_url: url.trim(),
      title: matchTitle || stream.title,
      ch_match_id: chMatchId || stream.ch_match_id || '',
    });
    if (res.success) { setOpen(false); setUrl(''); }
    else setErr(res.error ?? 'Could not save.');
  };

  const stop = async () => {
    await saveStream({ ...stream, is_live: false });
  };

  if (isLive) {
    return (
      <button onClick={() => void stop()} disabled={saving}
        className="w-full mt-3 py-2.5 r-control bg-white/20 text-white t-meta font-black
                   inline-flex items-center justify-center gap-2 disabled:opacity-40">
        <span className="w-2 h-2 rounded-full bg-rose-300 animate-pulse" />
        {saving ? 'Ending…' : 'End the stream'}
      </button>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mt-3 py-2.5 r-control bg-white/20 text-white t-meta font-black
                   inline-flex items-center justify-center gap-2">
        <Radio className="w-4 h-4" /> Go live
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 r-control bg-black/25">
      <div className="flex items-center justify-between">
        <p className="t-micro font-black uppercase tracking-wider text-white/80
                      inline-flex items-center gap-1.5">
          <Youtube className="w-3.5 h-3.5" /> Paste the YouTube link
        </p>
        <button onClick={() => { setOpen(false); setErr(null); }} className="text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        value={url} onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void start(); }}
        placeholder="youtube.com/live/… or youtu.be/…"
        autoFocus inputMode="url"
        className="w-full mt-2 px-3 py-2 r-control bg-white/15 text-white placeholder:text-white/45
                   t-body border border-white/20" />
      {err && <p className="t-micro font-bold text-rose-200 mt-1.5">{err}</p>}
      <button onClick={() => void start()} disabled={saving || !url.trim()}
        className="w-full mt-2 py-2.5 r-control bg-white text-red-700 t-meta font-black
                   disabled:opacity-40">
        {saving ? 'Starting…' : 'Start the stream'}
      </button>
      <p className="t-micro text-white/50 mt-1.5">
        Start it on YouTube first, then paste the share link here.
      </p>
    </div>
  );
}
