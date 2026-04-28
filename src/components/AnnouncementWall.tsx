import { useState } from 'react';
import { Megaphone, Pin, Trophy, AlertTriangle, Calendar as CalIcon, Plus, X, Trash2 } from 'lucide-react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import { Input, TextArea, Select } from './ui/Input';
import { Button } from './ui/Button';
import { ConfirmModal } from './ui/ConfirmModal';
import type { Announcement } from '../types';

const TYPE_META: Record<Announcement['type'], { color: string; icon: React.ReactNode; label: string }> = {
  general:  { color: 'text-blue-300',    icon: <Megaphone className="w-3.5 h-3.5" />,        label: 'NEWS' },
  match:    { color: 'text-emerald-300', icon: <CalIcon className="w-3.5 h-3.5" />,           label: 'MATCH' },
  congrats: { color: 'text-amber-300',   icon: <Trophy className="w-3.5 h-3.5" />,            label: 'CONGRATS' },
  urgent:   { color: 'text-red-300',     icon: <AlertTriangle className="w-3.5 h-3.5" />,     label: 'URGENT' },
};

const TYPE_GRADIENT: Record<Announcement['type'], string> = {
  general:  'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)',
  match:    'linear-gradient(135deg, #065f46 0%, #0a1019 100%)',
  congrats: 'linear-gradient(135deg, #78350f 0%, #0a1019 100%)',
  urgent:   'linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)',
};

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
  });

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
        expires_at: null,
        created_by: 'Admin',
      });
      setForm({ title: '', body: '', type: 'general', pinned: false });
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
        <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
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
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No announcements yet. Click "+ New" to post one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {announcements.map(a => {
            const meta = TYPE_META[a.type] || TYPE_META.general;
            return (
              <div key={a.id} className="relative overflow-hidden rounded-2xl p-5 group"
                   style={{ background: TYPE_GRADIENT[a.type] || TYPE_GRADIENT.general }}>
                <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />

                {a.pinned && (
                  <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-black">
                    <Pin className="w-2.5 h-2.5" fill="currentColor" />
                    PINNED
                  </div>
                )}

                <div className={`flex items-center gap-1.5 mb-2 relative ${meta.color}`}>
                  {meta.icon}
                  <span className="text-[10px] font-bold uppercase tracking-[2px]">{meta.label}</span>
                </div>
                <h3 className="text-base lg:text-lg font-black text-white relative leading-tight">{a.title}</h3>
                <p className="text-sm text-gray-300 mt-1 relative whitespace-pre-line">{a.body}</p>
                <p className="text-[10px] text-gray-500 mt-3 relative">
                  {a.created_by ? `${a.created_by} · ` : ''}
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>

                {isAdmin && (
                  <button
                    onClick={() => setConfirmDelete(a.id)}
                    className="absolute bottom-2 right-2 p-1.5 rounded-md text-red-300 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
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
              <p className="text-xs text-gray-500 mt-0.5">Pinned announcements stay above newer ones</p>
            </div>
          </label>
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
