import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, User } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Select } from './ui/Input';
import { Button } from './ui/Button';
import { useMembers } from '../hooks/useMembers';

const STORAGE_KEY = 'scc-my-profile-id';

/**
 * "My Stats" button + member-picker modal.
 *
 * First-time use: opens a "Who are you?" picker, navigates to that
 * member's profile, and remembers the choice in localStorage.
 * Subsequent clicks go directly to the saved profile.
 * A small "Switch" link in the modal lets you change who "you" are.
 */
export function MyStatsButton({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { members } = useMembers();
  const [showModal, setShowModal] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tempId, setTempId] = useState('');

  useEffect(() => {
    setSavedId(localStorage.getItem(STORAGE_KEY));
  }, []);

  const handleClick = () => {
    if (savedId && members.some(m => m.id === savedId)) {
      // Go straight to remembered profile
      navigate(`/profile/${savedId}`);
    } else {
      setShowModal(true);
    }
  };

  const handlePick = (id: string) => {
    if (!id) return;
    localStorage.setItem(STORAGE_KEY, id);
    setSavedId(id);
    setShowModal(false);
    navigate(`/profile/${id}`);
  };

  const handleSwitch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempId('');
    setShowModal(true);
  };

  const savedMember = savedId ? members.find(m => m.id === savedId) : null;

  return (
    <>
      <button
        onClick={handleClick}
        className={compact
          ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-colors"
          : "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-400/30 text-emerald-200 text-sm font-bold transition-all backdrop-blur-sm shadow-lg"
        }
      >
        {savedMember?.avatar_url ? (
          <img src={savedMember.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <BarChart3 className="w-4 h-4" />
        )}
        {savedMember
          ? <span className="truncate max-w-[120px]">{savedMember.name.split(' ')[0]}'s Stats</span>
          : 'My Stats'}
        {savedMember && (
          <span
            onClick={handleSwitch}
            className="text-[10px] opacity-60 hover:opacity-100 underline ml-1"
            title="Switch profile"
          >
            switch
          </span>
        )}
      </button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Who are you?">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Pick your name once
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
                We'll remember it on this device — next click goes straight to your stats.
              </p>
            </div>
          </div>

          <Select
            label="Select your name"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            options={[
              { value: '', label: '— Pick yourself —' },
              ...members
                .filter(m => m.status === 'active')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => ({ value: m.id, label: m.name })),
            ]}
          />

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handlePick(tempId)}
              disabled={!tempId}
              className="flex-1"
            >
              View Stats
            </Button>
          </div>

          {savedId && (
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setSavedId(null);
                setTempId('');
              }}
              className="w-full text-center text-xs text-red-500 hover:text-red-600 font-semibold mt-2"
            >
              Forget my saved profile
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}

export default MyStatsButton;
