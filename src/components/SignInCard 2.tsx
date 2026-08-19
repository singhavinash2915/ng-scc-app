import { useState } from 'react';
import { Card } from './ui/Card';
import { ArrowRight } from 'lucide-react';
import { useMe } from '../context/MemberContext';

// ─── Sign in ──────────────────────────────────────────────────────────────────
// Shown in place of "Your season" until a member identifies themselves. Two
// fields and no account to create: the phone number is already on the members
// list, so signing in is recognition rather than registration.
//
// Deliberately not a gate. Everything below it on the Dashboard still works
// signed out — this only unlocks the personal block, and a member who ignores
// it loses nothing they had before.

export function SignInCard() {
  const { signIn } = useMe();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await signIn(phone);
    if (!res.ok) setError(res.error ?? 'Could not sign in.');
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <p className="t-micro font-black uppercase tracking-[2px] text-emerald-600 dark:text-emerald-400">
        Make it yours
      </p>
      <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1">
        Sign in to see your season
      </p>
      <p className="t-body text-slate-500 dark:text-white/50 mt-1">
        Your squad place, your balance, your form. No password — just the number
        the club already has for you.
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="tel" inputMode="numeric" placeholder="Your phone number"
            value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            className="flex-1 px-4 py-3 r-control bg-slate-50 dark:bg-white/5 border border-slate-200
                       dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400
                       t-lead font-semibold" />
          <button onClick={() => void submit()} disabled={busy}
            className="px-5 r-control bg-emerald-500 text-white font-black text-sm
                       disabled:opacity-40 inline-flex items-center gap-1.5">
            {busy ? '…' : <>Go <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
        {error && <p className="t-body font-semibold text-rose-500 pt-0.5">{error}</p>}
      </div>
    </Card>
  );
}
