import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Megaphone, Pin, Trophy, AlertTriangle, Calendar as CalIcon, Plus, X, Trash2, Clock } from 'lucide-react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import { Input, TextArea, Select } from './ui/Input';
import { Button } from './ui/Button';
import { ConfirmModal } from './ui/ConfirmModal';
import type { Announcement } from '../types';

// Countdown badge — auto-updates every minute. Returns null if expiry passed.
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  let label = '';
  let urgent = false;
  if (days >= 1) label = `${days}d ${hours}h left`;
  else if (hours >= 1) { label = `${hours}h ${mins}m left`; urgent = hours < 6; }
  else { label = `${mins}m left`; urgent = true; }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full t-micro font-black ${
      urgent
        ? 'bg-red-500/25 border border-red-400/50 text-red-200 animate-pulse'
        : 'bg-white/10 border border-slate-200 dark:border-white/20 text-slate-500 dark:text-white/80'
    }`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

const TYPE_META: Record<Announcement['type'], { color: string; icon: React.ReactNode; label: string }> = {
  general:  { color: 'text-sky-600 dark:text-sky-300',         icon: <Megaphone className="w-3.5 h-3.5" />,    label: 'NEWS' },
  match:    { color: 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-300', icon: <CalIcon className="w-3.5 h-3.5" />,      label: 'MATCH' },
  congrats: { color: 'text-amber-600 dark:text-amber-600 dark:text-amber-300',     icon: <Trophy className="w-3.5 h-3.5" />,       label: 'CONGRATS' },
  urgent:   { color: 'text-rose-600 dark:text-rose-600 dark:text-rose-300',       icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'URGENT' },
};

// The type used to fill the whole card — navy, green, brown, maroon. A wall of
// those is a wall of slabs; the type is better said by a hairline over the
// house surface, which also lets an urgent one actually stand out from the rest.
const TYPE_RULE: Record<Announcement['type'], string> = {
  general:  'bg-sky-400/70',
  match:    'bg-emerald-400/70',
  congrats: 'bg-amber-400/70',
  urgent:   'bg-rose-400/70',
};

// Compact card with collapse — shows first ~3 lines, "Read more" expands.
function AnnouncementCard({
  a, isAdmin, onDelete,
}: { a: Announcement; isAdmin: boolean; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[a.type] || TYPE_META.general;
  const isLong = a.body.length > 140 || a.body.split('\n').length > 3;

  return (
    <div className="glass r-card relative overflow-hidden p-4 lg:p-5 group">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${TYPE_RULE[a.type] || TYPE_RULE.general}`} />

      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {a.pinned && (
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 t-micro font-black">
            <Pin className="w-2.5 h-2.5" fill="currentColor" />
            PINNED
          </div>
        )}
        {a.expires_at && <ExpiryCountdown expiresAt={a.expires_at} />}
      </div>

      <div className={`flex items-center gap-1.5 mb-2 relative ${meta.color}`}>
        {meta.icon}
        <span className="t-micro font-bold uppercase tracking-[2px]">{meta.label}</span>
      </div>
      <h3 className="text-base lg:text-lg font-black text-slate-900 dark:text-white relative leading-tight pr-16">{a.title}</h3>

      <div className="relative mt-2">
        <p className={`text-sm text-slate-500 dark:text-slate-500 dark:text-white/60 whitespace-pre-line leading-relaxed ${
          !expanded && isLong ? 'line-clamp-3' : ''
        }`}>
          {a.body}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-300 hover:text-emerald-600 dark:text-emerald-200 mt-2"
          >
            {expanded ? '↑ Show less' : '↓ Read more'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 relative">
        <p className="t-micro text-slate-400 dark:text-slate-500 dark:text-white/40">
          {a.created_by ? `${a.created_by} · ` : ''}
          {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
        {isAdmin && (
          <button
            onClick={() => onDelete(a.id)}
            className="p-1 r-control text-red-300 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
            title="Delete announcement"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AnnouncementWall() {
  const { isAdmin } = useAuth();
  const { announcements, loading, addAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'general' as Announcement['type'],
    pinned: false,
    expiry: 'never' as 'never' | '1h' | '6h' | '1d' | '3d' | '7d' | '14d',
  });

  const computeExpiry = (choice: typeof form.expiry): string | null => {
    if (choice === 'never') return null;
    const now = new Date();
    const ms = {
      '1h':  60 * 60 * 1000,
      '6h':  6 * 60 * 60 * 1000,
      '1d':  24 * 60 * 60 * 1000,
      '3d':  3 * 24 * 60 * 60 * 1000,
      '7d':  7 * 24 * 60 * 60 * 1000,
      '14d': 14 * 24 * 60 * 60 * 1000,
    }[choice];
    return new Date(now.getTime() + ms).toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    try {
      await addAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        pinned: form.pinned,
        expires_at: computeExpiry(form.expiry),
        created_by: 'Admin',
      });
      setForm({ title: '', body: '', type: 'general', pinned: false, expiry: 'never' });
      setShowModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  // Hide entirely when no announcements + not admin
  if (announcements.length === 0 && !isAdmin) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="t-meta font-bold text-slate-400 dark:text-slate-500 dark:text-white/45 dark:text-slate-400 dark:text-slate-500 dark:text-white/40 uppercase tracking-[2px] flex items-center gap-2">
          <Megaphone className="w-3.5 h-3.5 text-primary-500" />
          Team Wall
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1 font-semibold hover:text-primary-700"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      {announcements.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-sm text-slate-400 dark:text-slate-500 dark:text-white/45 dark:text-slate-400 dark:text-slate-500 dark:text-white/40">
          {isAdmin ? 'No announcements yet. Click "+ New" to post one.' : 'No announcements yet.'}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {announcements.map(a => (
            <AnnouncementCard key={a.id} a={a} isAdmin={isAdmin} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Announcement">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type"
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as Announcement['type'] })}
            options={[
              { value: 'general',  label: '📣 General News' },
              { value: 'match',    label: '🏏 Match Update' },
              { value: 'congrats', label: '🏆 Congratulations' },
              { value: 'urgent',   label: '⚠️ Urgent Notice' },
            ]}
          />
          <Input
            label="Title *"
            placeholder="e.g. Practice cancelled this Saturday"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <TextArea
            label="Message *"
            placeholder="Details — multiple lines OK"
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            rows={4}
            required
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-600"
            />
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                Pin to top
              </span>
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-white/40 mt-0.5">Pinned announcements stay above newer ones</p>
            </div>
          </label>

          <Select
            label="Auto-expire"
            value={form.expiry}
            onChange={e => setForm({ ...form, expiry: e.target.value as typeof form.expiry })}
            options={[
              { value: 'never', label: 'Never expires (manual delete)' },
              { value: '1h',    label: '⏱️ 1 hour' },
              { value: '6h',    label: '⏱️ 6 hours' },
              { value: '1d',    label: '⏱️ 1 day' },
              { value: '3d',    label: '⏱️ 3 days' },
              { value: '7d',    label: '⏱️ 7 days' },
              { value: '14d',   label: '⏱️ 14 days' },
            ]}
          />
          {form.expiry !== 'never' && (
            <p className="t-meta text-slate-400 dark:text-slate-500 dark:text-white/40 -mt-2">
              Auto-disappears at {new Date(computeExpiry(form.expiry)!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Post
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteAnnouncement(confirmDelete);
          setConfirmDelete(null);
        }}
        title="Delete announcement?"
        message="This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}

export default AnnouncementWall;
