import { useState } from 'react';
import { User, Lock, CheckCircle2, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Input, Select } from './ui/Input';
import { Button } from './ui/Button';
import { useMembers } from '../hooks/useMembers';
import type { Member } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Public "My Profile" modal — any member can update their own cricket profile
 * + contact info. Verifies identity by matching last 4 digits of phone.
 *
 * Cannot change: balance, status, avatar, name (those need admin).
 */
export function MyProfileModal({ isOpen, onClose }: Props) {
  const { members, updateMember } = useMembers();
  const [step, setStep] = useState<'pick' | 'verify' | 'edit' | 'done'>('pick');
  const [pickedMember, setPickedMember] = useState<Member | null>(null);
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    phone: '',
    email: '',
    birthday: '',
    role: '' as '' | 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper',
    batting_style: '' as '' | 'right_hand' | 'left_hand',
    bowling_style: '' as '' | 'right_arm_fast' | 'right_arm_medium' | 'off_spin' | 'leg_spin' | 'left_arm_fast' | 'left_arm_spin' | 'none',
    jersey_number: '',
  });

  const reset = () => {
    setStep('pick');
    setPickedMember(null);
    setPinDigits('');
    setPinError('');
    setForm({ phone: '', email: '', birthday: '', role: '', batting_style: '', bowling_style: '', jersey_number: '' });
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePickMember = (id: string) => {
    const m = members.find(x => x.id === id);
    if (!m) return;
    setPickedMember(m);
    if (!m.phone || m.phone.replace(/\D/g, '').length < 4) {
      // No phone on file — skip verification, go straight to edit (admin-set)
      setForm({
        phone: m.phone || '',
        email: m.email || '',
        birthday: m.birthday || '',
        role: m.role || '',
        batting_style: m.batting_style || '',
        bowling_style: m.bowling_style || '',
        jersey_number: m.jersey_number?.toString() || '',
      });
      setStep('edit');
    } else {
      setStep('verify');
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedMember) return;
    const lastFour = pickedMember.phone?.replace(/\D/g, '').slice(-4) || '';
    if (pinDigits !== lastFour) {
      setPinError('That doesn\'t match the last 4 digits of your phone on file. Try again, or ask the admin to update it for you.');
      return;
    }
    setForm({
      phone: pickedMember.phone || '',
      email: pickedMember.email || '',
      birthday: pickedMember.birthday || '',
      role: pickedMember.role || '',
      batting_style: pickedMember.batting_style || '',
      bowling_style: pickedMember.bowling_style || '',
      jersey_number: pickedMember.jersey_number?.toString() || '',
    });
    setStep('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedMember) return;
    setSubmitting(true);
    try {
      await updateMember(pickedMember.id, {
        phone: form.phone || null,
        email: form.email || null,
        birthday: form.birthday || null,
        role: form.role || null,
        batting_style: form.batting_style || null,
        bowling_style: form.bowling_style || null,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
      });
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="My Profile">

      {/* STEP 1: pick member */}
      {step === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Update your jersey number, role, contact info, etc. — your changes save instantly.
            <br />
            <span className="text-xs">Note: balance & status can only be changed by an admin.</span>
          </p>
          <Select
            label="Who are you?"
            value={pickedMember?.id || ''}
            onChange={(e) => handlePickMember(e.target.value)}
            options={[
              { value: '', label: '— Select your name —' },
              ...members
                .filter(m => m.status === 'active')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => ({ value: m.id, label: m.name })),
            ]}
          />
        </div>
      )}

      {/* STEP 2: verify identity by last 4 digits of phone */}
      {step === 'verify' && pickedMember && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Hi <span className="font-bold">{pickedMember.name.split(' ')[0]}</span>! Confirm it's really you:
            </p>
          </div>
          <Input
            label="Last 4 digits of your phone number"
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pinDigits}
            onChange={(e) => { setPinDigits(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            required
          />
          {pinError && (
            <p className="text-sm text-red-500 -mt-2">{pinError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={reset} className="flex-1">
              Wrong name?
            </Button>
            <Button type="submit" disabled={pinDigits.length !== 4} className="flex-1">
              Verify
            </Button>
          </div>
        </form>
      )}

      {/* STEP 3: edit form */}
      {step === 'edit' && pickedMember && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            {pickedMember.avatar_url ? (
              <img src={pickedMember.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{pickedMember.name}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Updating your own profile</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Jersey #"
              type="number"
              placeholder="7"
              value={form.jersey_number}
              onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Birthday"
            type="date"
            value={form.birthday}
            onChange={(e) => setForm({ ...form, birthday: e.target.value })}
          />

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Cricket Profile</p>
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
              options={[
                { value: '', label: '—' },
                { value: 'batsman', label: '🏏 Batsman' },
                { value: 'bowler', label: '⚡ Bowler' },
                { value: 'all_rounder', label: '🌟 All-rounder' },
                { value: 'wicket_keeper', label: '🧤 Wicket-keeper' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Batting Style"
                value={form.batting_style}
                onChange={(e) => setForm({ ...form, batting_style: e.target.value as typeof form.batting_style })}
                options={[
                  { value: '', label: '—' },
                  { value: 'right_hand', label: 'Right-hand' },
                  { value: 'left_hand', label: 'Left-hand' },
                ]}
              />
              <Select
                label="Bowling Style"
                value={form.bowling_style}
                onChange={(e) => setForm({ ...form, bowling_style: e.target.value as typeof form.bowling_style })}
                options={[
                  { value: '', label: '—' },
                  { value: 'right_arm_fast', label: 'Right-arm Fast' },
                  { value: 'right_arm_medium', label: 'Right-arm Medium' },
                  { value: 'off_spin', label: 'Off-spin' },
                  { value: 'leg_spin', label: 'Leg-spin' },
                  { value: 'left_arm_fast', label: 'Left-arm Fast' },
                  { value: 'left_arm_spin', label: 'Left-arm Spin' },
                  { value: 'none', label: "Doesn't bowl" },
                ]}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Save My Profile
            </Button>
          </div>
        </form>
      )}

      {/* STEP 4: done */}
      {step === 'done' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Profile updated! 🎉</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Your changes are live across the app.
          </p>
          <Button onClick={handleClose} className="mt-4">Done</Button>
        </div>
      )}
    </Modal>
  );
}

export default MyProfileModal;
