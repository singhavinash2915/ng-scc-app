import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ymd } from '../hooks/useUnavailability';

// ─── Month calendar with range selection ──────────────────────────────────────
// Tap a start date, tap an end date. One tap on the same date is a single day,
// which is the common case and shouldn't need a mode switch.
//
// While picking, the range under the cursor previews on hover — without it you
// are selecting blind and only find out what you chose after committing.

export interface DayMeta {
  /** Shaded: already blocked by this member. */
  blocked?: boolean;
  /** A fixture is on this date. */
  fixture?: boolean;
  /** How many OTHER members are away — shown as a quiet number, never names. */
  othersAway?: number;
}

interface Props {
  /** Inclusive selection, or null while nothing is being picked. */
  value: { from: string; to: string } | null;
  onChange: (v: { from: string; to: string } | null) => void;
  meta?: (date: string) => DayMeta;
  /** Nothing before today: blocking out last Tuesday helps no one. */
  minDate?: string;
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function RangeCalendar({ value, onChange, meta, minDate }: Props) {
  const today = ymd(new Date());
  const min = minDate ?? today;
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  /** Set once the first tap lands, cleared when the range completes. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // Monday-first: cricket weeks end at the weekend, and a grid that puts
    // Saturday and Sunday together reads far faster for picking match dates.
    const lead = (first.getDay() + 6) % 7;
    const out: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      out.push({ date: ymd(new Date(cursor.getFullYear(), cursor.getMonth(), d)), day: d });
    }
    return out;
  }, [cursor]);

  // While anchored, the preview follows the pointer so the shape of the
  // selection is visible before it's committed.
  const active = anchor
    ? { from: anchor < (hover ?? anchor) ? anchor : (hover ?? anchor),
        to:   anchor < (hover ?? anchor) ? (hover ?? anchor) : anchor }
    : value;

  const inRange = (d: string) => !!active && d >= active.from && d <= active.to;

  const tap = (d: string) => {
    if (d < min) return;
    if (!anchor) { setAnchor(d); setHover(d); return; }
    const from = d < anchor ? d : anchor;
    const to = d < anchor ? anchor : d;
    setAnchor(null); setHover(null);
    onChange({ from, to });
  };

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                     flex items-center justify-center" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="font-display font-extrabold text-slate-900 dark:text-white">{monthLabel}</p>
        <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                     flex items-center justify-center" aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-center t-micro font-black uppercase text-slate-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" onMouseLeave={() => anchor && setHover(anchor)}>
        {days.map((cell, i) => {
          if (!cell) return <div key={`x${i}`} />;
          const m = meta?.(cell.date) ?? {};
          const past = cell.date < min;
          const sel = inRange(cell.date);
          const isToday = cell.date === today;
          return (
            <button key={cell.date} disabled={past}
              onClick={() => tap(cell.date)}
              onMouseEnter={() => anchor && setHover(cell.date)}
              className={`relative aspect-square r-control flex flex-col items-center justify-center
                          transition-colors ${
                past ? 'text-slate-300 dark:text-white/20 cursor-not-allowed'
                : sel ? 'bg-rose-500 text-white font-black'
                : m.blocked ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 font-bold'
                : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white/80'}`}>
              <span className={`t-num text-sm leading-none ${isToday && !sel ? 'underline' : ''}`}>
                {cell.day}
              </span>
              {/* A fixture marker and an others-away count, kept to dots and a
                  number: names would turn a personal screen into a roster. */}
              <span className="flex items-center gap-0.5 h-2 mt-0.5">
                {m.fixture && (
                  <span className={`w-1.5 h-1.5 rounded-full ${sel ? 'bg-white' : 'bg-emerald-500'}`} />
                )}
                {!!m.othersAway && !past && (
                  <span className={`t-micro leading-none ${sel ? 'text-white/80' : 'text-slate-400'}`}>
                    {m.othersAway}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="t-micro text-slate-400 mt-2">
        {anchor
          ? 'Now tap the last day you’re away (tap the same day for one day only)'
          : 'Tap the first day you’re away'}
        {' · '}
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> match day
        </span>
      </p>
    </div>
  );
}
