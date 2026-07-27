import { useState } from 'react';
import { Play, Film, X, Trash2, Plus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import {
  useMatchVideos, formatTime, parseTimeInput, videoEmbedUrl, videoThumb,
  type MatchVideo, type VideoKind,
} from '../hooks/useMatchVideos';
import type { Member } from '../types';

interface Props {
  matchId: string;
  isAdmin: boolean;
  members: Member[];
  /** Shared hook instance so the whole list refreshes together. */
  api: ReturnType<typeof useMatchVideos>;
}

/**
 * Per-match videos: a full-replay button plus a scrollable strip of highlight
 * clips. Clips are just the replay video with a start time, so they're free to
 * create — a wicket "clip" is one paste + one timestamp.
 */
export function MatchVideos({ matchId, isAdmin, members, api }: Props) {
  const replay = api.replayFor(matchId);
  const clips = api.clipsFor(matchId);
  const [playing, setPlaying] = useState<MatchVideo | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (api.tableMissing) return null;
  if (!replay && clips.length === 0 && !isAdmin) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        {replay && (
          <button
            onClick={() => setPlaying(replay)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <Play className="w-3 h-3" fill="currentColor" /> Watch full match
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3 h-3" /> Video
          </button>
        )}
      </div>

      {/* Clip strip */}
      {clips.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Film className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Highlights · {clips.length}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {clips.map(c => (
              <button
                key={c.id}
                onClick={() => setPlaying(c)}
                className="group relative flex-shrink-0 w-32 rounded-lg overflow-hidden bg-gray-900 text-left"
              >
                <img
                  src={videoThumb(c.video_id)}
                  alt=""
                  loading="lazy"
                  className="w-full h-[72px] object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-gray-900 ml-0.5" fill="currentColor" />
                  </span>
                </span>
                {c.start_seconds != null && (
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {formatTime(c.start_seconds)}
                  </span>
                )}
                <span className="block px-1.5 py-1 text-[10px] font-semibold text-gray-200 bg-gray-900 truncate">
                  {c.title || 'Highlight'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Player modal */}
      {playing && (
        <Modal isOpen onClose={() => setPlaying(null)} title={playing.title || (playing.kind === 'replay' ? 'Full match' : 'Highlight')} size="lg">
          <div className="space-y-3">
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={videoEmbedUrl(playing)}
                title={playing.title || 'Match video'}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            {isAdmin && (
              <button
                onClick={async () => { await api.deleteVideo(playing.id); setPlaying(null); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove this video
              </button>
            )}
          </div>
        </Modal>
      )}

      {addOpen && (
        <AddVideoModal
          matchId={matchId}
          members={members}
          api={api}
          existingReplay={replay}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Admin: add a replay or a clip ─────────────────────────────────────────────
function AddVideoModal({ matchId, members, api, existingReplay, onClose }: {
  matchId: string;
  members: Member[];
  api: ReturnType<typeof useMatchVideos>;
  existingReplay: MatchVideo | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<VideoKind>(existingReplay ? 'clip' : 'replay');
  const [url, setUrl] = useState(existingReplay ? `https://youtu.be/${existingReplay.video_id}` : '');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [memberId, setMemberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await api.addVideo({
      matchId,
      url,
      kind,
      title,
      startSeconds: kind === 'clip' ? parseTimeInput(time) : null,
      memberId: memberId || null,
    });
    setSaving(false);
    if (res.success) onClose(); else setMsg(res.error ?? 'Could not save');
  };

  return (
    <Modal isOpen onClose={onClose} title="Add match video" size="md">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['replay', 'clip'] as const).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
                kind === k ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {k === 'replay' ? '🎬 Full replay' : '✂️ Highlight clip'}
            </button>
          ))}
        </div>

        <Input
          label="YouTube link"
          placeholder="https://youtu.be/… (paste with &t= to auto-fill the time)"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />

        {kind === 'clip' && (
          <>
            <Input
              label="Start time (mm:ss)"
              placeholder="e.g. 12:45 — leave blank if the link already has &t="
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            <Input
              label="Label"
              placeholder="e.g. Avinash bowls him middle stump 🔥"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <Select
              label="Featuring (optional — shows on their profile)"
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              options={[
                { value: '', label: 'Nobody in particular' },
                ...[...members]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(m => ({ value: m.id, label: m.name })),
              ]}
            />
          </>
        )}

        {kind === 'replay' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 Tip: after a stream ends, YouTube saves the whole match on your channel automatically. Paste that link here —
            then add clips from the same video by noting when each wicket happened.
          </p>
        )}

        {msg && <p className="text-xs font-semibold text-red-500">{msg}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            <X className="w-4 h-4" /> Cancel
          </Button>
          <Button onClick={save} disabled={saving || !url.trim()} className="flex-1">
            {saving ? 'Saving…' : 'Add video'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
