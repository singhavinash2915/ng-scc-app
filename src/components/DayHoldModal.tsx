import { useState } from 'react';
import { X, Trash2, CalendarCheck } from 'lucide-react';
import { HOLD_KINDS, type DayHold, type HoldKind } from '../hooks/useDayHolds';

// ─── Book-a-Match: admin day-hold editor ───────────────────────────────────────
// Replaces a confirm() that could only say "internal match, yes/no". The reason
// a day is unavailable matters — most often it's a team who paid the admin
// directly, and that booking needs a name and an amount against it.

/**
 * Why this date is currently off the calendar, when it isn't a hold the admin
 * placed. Each needs a different way out — the one thing they share is that a
 * cancellation shouldn't leave a good Saturday sitting dead on the calendar.
 */
export type DateBlocker =
  | { kind: 'auto' }                                              // league schedule
  | { kind: 'booking'; team: string; status: string; phone?: string }
  | { kind: 'closed' };                                           // slot switched off

interface Props {
  date: string;
  existing?: DayHold;
  /** Set when the date is unavailable for a reason the admin didn't create. */
  blocker?: DateBlocker;
  busy: boolean;
  onSave: (input: {
    kind: HoldKind; teamName?: string; contactPhone?: string;
    amount?: number | null; note?: string;
  }) => void;
  onRelease: () => void;
  /** Put the date back on sale, whatever is holding it. */
  onFree: () => void;
  onClose: () => void;
  formatDate: (d: string) => string;
  suggestedPrice?: number;
}

export function DayHoldModal({
  date, existing, blocker, busy, onSave, onRelease, onFree, onClose,
  formatDate, suggestedPrice,
}: Props) {
  const [kind, setKind] = useState<HoldKind>(existing?.kind ?? 'offline');
  const [teamName, setTeamName] = useState(existing?.team_name ?? '');
  const [phone, setPhone] = useState(existing?.contact_phone ?? '');
  const [amount, setAmount] = useState<string>(
    existing?.amount != null ? String(existing.amount) : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');

  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm ' +
                'focus:outline-none focus:ring-2 focus:ring-violet-400';

  const save = () => onSave({
    kind, teamName, contactPhone: phone,
    amount: amount.trim() === '' ? null : Number(amount),
    note,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl
                      max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="t-micro font-black uppercase tracking-widest text-violet-500">
              {existing ? 'Edit hold' : blocker ? 'Manage this date' : 'Block this date'}
            </p>
            <h3 className="font-black text-lg text-gray-900">{formatDate(date)}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 r-control hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Something other than an admin hold is keeping this date off sale.
              Opponents cancel and fixtures move, so every one of these needs a
              one-tap way back to available. */}
          {blocker && (
            <div className="r-card border-2 border-amber-200 bg-amber-50 p-3.5 space-y-2.5">
              <p className="t-meta font-black uppercase tracking-widest text-amber-700">
                {blocker.kind === 'auto' ? 'Held for the SCC League'
                  : blocker.kind === 'booking' ? `Booked · ${blocker.status}`
                  : 'Closed for bookings'}
              </p>
              {blocker.kind === 'booking' ? (
                <p className="text-sm text-amber-900 leading-snug">
                  <b>{blocker.team}</b> holds this date
                  {blocker.phone ? <span className="text-amber-700"> · {blocker.phone}</span> : null}.
                  Freeing it cancels their booking and puts the date back on sale.
                </p>
              ) : blocker.kind === 'auto' ? (
                <p className="text-sm text-amber-900 leading-snug">
                  The league schedule reserves this day. If the internal match moved,
                  open it up and an external team can book it.
                </p>
              ) : (
                <p className="text-sm text-amber-900 leading-snug">
                  This slot was switched off. Turn it back on to take bookings.
                </p>
              )}
              <button onClick={onFree} disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 r-control
                           bg-emerald-500 text-white font-black py-3 text-sm disabled:opacity-40">
                <CalendarCheck className="w-4 h-4" />
                {busy ? 'Freeing…' : 'Make this date available'}
              </button>
            </div>
          )}

          {blocker && (
            <p className="t-meta font-black uppercase tracking-widest text-gray-400 pt-1">
              …or hold it for something else
            </p>
          )}

          {/* why */}
          <div className="space-y-2">
            {HOLD_KINDS.map(k => (
              <button key={k.key} onClick={() => setKind(k.key)}
                className={`w-full flex items-start gap-3 r-control border-2 p-3 text-left transition-all ${
                  kind === k.key
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-xl leading-none mt-0.5">{k.emoji}</span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${kind === k.key ? 'text-violet-900' : 'text-gray-800'}`}>
                    {k.label}
                  </span>
                  <span className="block t-meta text-gray-500 leading-snug">{k.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          {/* an offline booking is a real booking — capture who and how much */}
          {kind === 'offline' && (
            <div className="space-y-2.5 r-card bg-emerald-50 border border-emerald-200 p-3.5">
              <p className="t-meta font-black uppercase tracking-widest text-emerald-700">
                Who booked it
              </p>
              <input value={teamName} onChange={e => setTeamName(e.target.value)}
                placeholder="Team name" className={input} />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Contact number (optional)" inputMode="tel" className={input} />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={suggestedPrice ? String(suggestedPrice) : 'Amount paid'}
                  inputMode="numeric" className={`${input} pl-7`} />
              </div>
              <p className="t-micro text-emerald-700/70">
                External teams just see this date as <b>Booked</b> — the amount is admin-only.
              </p>
            </div>
          )}

          <div>
            <label className="t-micro font-black uppercase tracking-widest text-gray-400">
              Note (optional)
            </label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder={kind === 'blocked' ? 'e.g. ground maintenance' : 'Anything worth remembering'}
              className={`${input} mt-1`} />
          </div>

          <div className="flex gap-2.5 pt-1">
            {existing && (
              <button onClick={onRelease} disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 r-control border-2
                           border-rose-200 text-rose-600 font-black px-4 py-3 text-sm disabled:opacity-40">
                <Trash2 className="w-4 h-4" /> Release
              </button>
            )}
            <button onClick={save} disabled={busy}
              className="flex-1 r-control bg-gradient-to-r from-violet-600 to-pink-600 text-white
                         font-black py-3 text-sm disabled:opacity-40">
              {busy ? 'Saving…' : existing ? 'Update hold' : 'Block this date'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
