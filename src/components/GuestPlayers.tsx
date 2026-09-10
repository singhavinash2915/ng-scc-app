import { useState } from 'react';
import { UserPlus, X, IndianRupee, Check } from 'lucide-react';
import { Card } from './ui/Card';
import { useGuests } from '../hooks/useGuests';
import type { Match, Member } from '../types';

// ─── Guests in the squad ──────────────────────────────────────────────────────
// A friend filling in when the club is short. They pay the same fee as everyone
// else and that is all the app records — no wallet, no stats, no leaderboard.
//
// Shown wherever the XI is picked, so the squad is a true list of who played
// rather than only the members among them.

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Props {
  match: Match;
  members: Member[];
  /** Fee tracking wants the paid/unpaid toggle; squad picking does not. */
  showFees?: boolean;
}

export function GuestPlayers({ match, members, showFees = false }: Props) {
  const G = useGuests(match.id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fee = Number(match.match_fee ?? 0);

  if (G.missing) return null;   // migration not run yet — say nothing rather than break the page

  const add = async (guestId?: string) => {
    setErr(null); setAdding(true);
    let id = guestId;
    if (!id) {
      const { error, guest } = await G.findOrCreateGuest(name, phone);
      if (error || !guest) { setErr(error ?? 'Could not add that guest.'); setAdding(false); return; }
      id = guest.id;
    }
    const e = await G.addToMatch(id, match.id, fee, invitedBy || null);
    setAdding(false);
    if (e) return setErr(e);
    setName(''); setPhone(''); setOpen(false);
  };

  // Guests already used this season, minus anyone already in this match — the
  // same friend fills in repeatedly, and retyping a name invites two spellings
  // of one person.
  const inMatch = new Set(G.appearances.map(a => a.guest_id));
  const previous = G.guests.filter(g => !inMatch.has(g.id));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-400" />
          <p className="t-micro font-black uppercase tracking-widest text-slate-500">
            Guest players
          </p>
        </div>
        {G.appearances.length > 0 && (
          <span className="t-meta text-slate-400">
            {G.appearances.length} · {rupees(G.appearances.reduce((s, a) => s + a.fee_amount, 0))}
          </span>
        )}
      </div>

      {G.appearances.length === 0 && !open && (
        <p className="t-body text-slate-400 mb-2">
          Nobody from outside the club in this match.
        </p>
      )}

      <div className="space-y-1.5">
        {G.appearances.map(a => {
          const gname = a.guest?.name ?? 'Guest';
          const inviter = members.find(m => m.id === a.invited_by)?.name;
          return (
            <div key={a.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-white/90 truncate">{gname}</p>
                <p className="t-micro text-slate-400 truncate">
                  {rupees(a.fee_amount)}{inviter ? ` · invited by ${inviter}` : ''}
                </p>
              </div>

              {showFees ? (
                <button
                  onClick={() => G.setFeePaid(a, !a.fee_paid, gname, match.date)}
                  className={`r-control px-2.5 py-1 t-meta font-black border ${
                    a.fee_paid
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-400/60 text-amber-700 dark:text-amber-300'}`}>
                  {a.fee_paid ? <><Check className="w-3 h-3 inline mr-1" />Paid</> : 'Mark paid'}
                </button>
              ) : (
                <button onClick={() => G.removeFromMatch(a.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500" title="Remove from this match">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!showFees && (
        open ? (
          <div className="mt-3 space-y-2">
            {previous.length > 0 && (
              <div>
                <p className="t-micro font-black uppercase tracking-wider text-slate-400 mb-1">
                  Played before
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previous.map(g => (
                    <button key={g.id} disabled={adding} onClick={() => add(g.id)}
                      className="r-control px-2.5 py-1 t-meta font-bold border border-slate-200
                                 dark:border-white/10 text-slate-600 dark:text-white/70">
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                className="flex-1 r-control px-2 py-1.5 text-sm border border-slate-200
                           dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)"
                className="flex-1 r-control px-2 py-1.5 text-sm border border-slate-200
                           dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>

            <select value={invitedBy} onChange={e => setInvitedBy(e.target.value)}
              className="w-full r-control px-2 py-1.5 text-sm border border-slate-200
                         dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="">Invited by… (optional)</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            {err && <p className="t-micro text-rose-600">{err}</p>}

            <div className="flex gap-2">
              <button disabled={adding || !name.trim()} onClick={() => add()}
                className="flex-1 r-control py-1.5 text-sm font-black bg-primary-500 text-white disabled:opacity-50">
                {adding ? 'Adding…' : `Add at ${rupees(fee)}`}
              </button>
              <button onClick={() => { setOpen(false); setErr(null); }}
                className="r-control px-3 py-1.5 text-sm font-bold text-slate-500">Cancel</button>
            </div>
            <p className="t-micro text-slate-400">
              <IndianRupee className="w-3 h-3 inline" /> Same fee as members. Guests never appear
              in stats, the leaderboard or anyone's wallet.
            </p>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="mt-2 w-full r-control py-1.5 text-sm font-bold border border-dashed
                       border-slate-300 dark:border-white/15 text-slate-500">
            + Add a guest
          </button>
        )
      )}
    </Card>
  );
}

export default GuestPlayers;
