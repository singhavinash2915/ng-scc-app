import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayPoint } from './AvailabilityChart';

// ─── Booked slots, on a month grid ────────────────────────────────────────────
// The list view answers "what about the 12th" only by scrolling to it. A month
// reads as a shape — a red block across two weeks is a travel season, and that
// is the thing an admin is actually looking for.
//
// Only booked dates are coloured. Days with no ground are left blank rather
// than scored, because a date the club cannot play is not a scheduling option
// however many people are free.

interface Props {
  points: DayPoint[];
  minTeam?: number;
  minPerSide?: number;
  onPick?: (date: string) => void;
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ymd = (d: Date) => d.toLocaleDateString('en-CA');

export function AvailabilityHeatmap({ points, minTeam = 11, minPerSide = 8, onPick }: Props) {
  const byDate = useMemo(() => new Map(points.map(p => [p.date, p])), [points]);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  /** Once the admin moves month themselves, stop repositioning under them. */
  const touched = useRef(false);

  // Open on the first month that actually has cricket in it. This can't be a
  // useState initialiser: that runs on the first render, when the bookings are
  // usually still in flight, and the calendar then opens on whatever month it
  // guessed — landing a month off the data with no way to tell.
  const firstMonth = points[0]?.date.slice(0, 7);
  useEffect(() => {
    if (touched.current || !firstMonth) return;
    const [y, m] = firstMonth.split('-').map(Number);
    setCursor(new Date(y, m - 1, 1));
  }, [firstMonth]);

  const move = (delta: number) => {
    touched.current = true;
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const cells = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const lead = (firstDay.getDay() + 6) % 7;          // Monday-first
    const out: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      out.push({ date: ymd(new Date(cursor.getFullYear(), cursor.getMonth(), d)), day: d });
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  /** Colour is decided by the WORSE of the two constraints, not the total. */
  const toneFor = (p: DayPoint) => {
    const side = Math.min(p.brahmos, p.agni);
    if (p.total < minTeam) return 'bg-rose-500 text-white';
    if (side < minPerSide) return 'bg-amber-400 text-amber-950';
    return 'bg-emerald-500 text-white';
  };

  const monthPoints = points.filter(p => p.date.slice(0, 7) === ymd(cursor).slice(0, 7));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => move(-1)}
          className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                     flex items-center justify-center" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="font-display font-extrabold text-slate-900 dark:text-white">{monthLabel}</p>
        <button onClick={() => move(1)}
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

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={`x${i}`} />;
          const p = byDate.get(c.date);
          if (!p) {
            return (
              <div key={c.date} className="aspect-square r-control flex items-start justify-center pt-1">
                <span className="t-micro text-slate-300 dark:text-white/20">{c.day}</span>
              </div>
            );
          }
          return (
            <button key={c.date} onClick={() => onPick?.(c.date)}
              title={`${p.label} · ${p.total} free · Brahmos ${p.brahmos}, Agni ${p.agni}`}
              className={`aspect-square r-control flex flex-col items-center justify-center
                          ${toneFor(p)} transition-transform active:scale-95`}>
              <span className="t-micro font-black leading-none opacity-80">{c.day}</span>
              <span className="t-num text-base leading-none mt-0.5">{p.total}</span>
              <span className="t-micro leading-none opacity-80">
                {p.brahmos}/{p.agni}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {[['bg-emerald-500', 'Good'], ['bg-amber-400', `Under ${minPerSide} a side`],
          ['bg-rose-500', `Under ${minTeam} total`]].map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5 t-micro text-slate-500">
            <span className={`w-3 h-3 rounded ${cls}`} /> {label}
          </span>
        ))}
      </div>
      {monthPoints.length === 0 && (
        <p className="t-meta text-slate-400 mt-3">No ground booked this month.</p>
      )}
    </div>
  );
}
