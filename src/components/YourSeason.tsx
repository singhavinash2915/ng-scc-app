import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { ChevronRight, LogOut, MapPin, Target } from 'lucide-react';
import { useMe } from '../context/MemberContext';
import { usePersonalAlerts } from '../hooks/usePersonalAlerts';
import { useCardStats } from '../hooks/useCardStats';
import { PlayerCard } from './PlayerCard';
import { Card } from './ui/Card';
import { AvailabilityNudge } from './AvailabilityNudge';
import type { Match } from '../types';

// ─── Your season ──────────────────────────────────────────────────────────────
// The club tab feels premium because ONE thing dominates and the rest support
// it. This tab was three identical grey rows with chevrons — nothing for the
// eye to land on, however correct the data was.
//
// So it now leads with the member's own player card (the app's signature
// object, previously absent from the one screen actually about them), then the
// next match as a hero with a live countdown, then a milestone worth coming
// back for. Balance and fixtures drop to supporting rows, which is what they
// always were.

interface Props {
  matches: Match[];
}

interface Item {
  label: string;
  value: string;
  detail?: string;
  to: string;
  tone: 'green' | 'amber' | 'slate';
}

/** Written out in full: Tailwind can't see an interpolated class name. */
const STAGGER = ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'] as const;
const step = (n: number) => STAGGER[Math.min(n, STAGGER.length - 1)];

/** Milestones a club cricketer actually notices passing. */
const RUN_MARKS = [50, 100, 250, 500, 1000, 1500, 2000, 3000];
const WKT_MARKS = [5, 10, 25, 50, 75, 100, 150];

function useCountdown(date: string | null) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const diff = new Date(date + 'T07:00:00').getTime() - Date.now();
      if (diff <= 0) return setT({ d: 0, h: 0, m: 0, s: 0 });
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);
  return t;
}

export function YourSeason({ matches }: Props) {
  const { me, signOut } = useMe();
  const alerts = usePersonalAlerts(matches);
  const { all, statsFor } = useCardStats();
  const [confirmOut, setConfirmOut] = useState(false);

  const next = useMemo(() => matches
    .filter(m => m.result === 'upcoming')
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null, [matches]);
  const cd = useCountdown(next?.date ?? null);

  /**
   * The nearest number worth chasing. A stat screen becomes personal when it
   * shows something you're MOVING TOWARDS rather than only what you have.
   */
  const milestone = useMemo(() => {
    if (!me) return null;
    const s = statsFor(me.id);
    const nextRun = RUN_MARKS.find(x => x > s.runs);
    const nextWkt = WKT_MARKS.find(x => x > s.wickets);
    const opts = [
      nextRun ? { away: nextRun - s.runs, label: `${nextRun} runs`, pct: (s.runs / nextRun) * 100 } : null,
      nextWkt ? { away: nextWkt - s.wickets, label: `${nextWkt} wickets`, pct: (s.wickets / nextWkt) * 100 } : null,
    ].filter(Boolean) as Array<{ away: number; label: string; pct: number }>;
    // Whichever is closest — the one actually within reach is the motivating one.
    return opts.sort((a, b) => a.away - b.away)[0] ?? null;
  }, [me, statsFor]);

  const items = useMemo<Item[]>(() => {
    if (!me) return [];
    const out: Item[] = [];
    const low = me.balance < 500;
    out.push({
      label: 'Your balance',
      value: `₹${Math.round(me.balance).toLocaleString('en-IN')}`,
      detail: low
        ? 'Running low — hand your top-up to an admin'
        : 'Covered for the next few matches',
      // Their own statement, not the Razorpay page. Online payment costs the
      // club a fee on money members already hand over directly, which is why
      // it's hidden from the nav — linking to it here undid that.
      to: `/profile/${me.id}`,
      tone: low ? 'amber' : 'green',
    });

    const upcoming = matches.filter(m => m.result === 'upcoming');
    out.push({
      label: 'Fixtures ahead',
      value: upcoming.length ? `${upcoming.length} match${upcoming.length > 1 ? 'es' : ''}` : 'None yet',
      detail: upcoming.length ? 'Tap for the full calendar' : 'Dates land here as they’re booked',
      to: '/calendar',
      tone: 'slate',
    });
    return out;
  }, [me, matches]);

  if (!me) return null;

  const first = me.name.split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const picked = next?.players?.some(p => p.member_id === me.id);

  return (
    <div className="space-y-3">
      {/* ── Greeting + sign out ── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="t-micro font-black uppercase tracking-[2px] text-slate-400">{greet}</p>
          <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white">{first}</p>
        </div>
        <button onClick={() => (confirmOut ? signOut() : setConfirmOut(true))}
          onBlur={() => setConfirmOut(false)}
          className="t-meta font-bold text-slate-400 inline-flex items-center gap-1 px-2 py-1">
          <LogOut className="w-3.5 h-3.5" />{confirmOut ? 'Sure?' : ''}
        </button>
      </div>

      {/* ── 1. YOUR CARD — the app's signature object, on the one screen
             that's actually about you. ── */}
      <PlayerCard member={me} stats={statsFor(me.id)} all={all} />

      {/* ── 2. NEXT MATCH — a hero, not a row. Same data the club tab gets
             a countdown for; there's no reason yours shouldn't. ── */}
      {next && (
        <div className="relative overflow-hidden r-card text-white shadow-2xl p-5"
          style={{ background: 'linear-gradient(150deg,#064e3b,#022c22)' }}>
          <div className="flex items-center gap-2">
            <span className="t-micro font-black uppercase tracking-[2px] text-emerald-300">
              Next match
            </span>
            {picked && (
              <span className="t-micro font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                               bg-emerald-400/25 text-emerald-100">You're picked</span>
            )}
          </div>
          <p className="font-display text-2xl font-extrabold mt-1.5 leading-tight">
            {next.opponent || 'SCC'}
          </p>
          {next.venue && (
            <p className="text-white/60 t-meta mt-1 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {next.venue}
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[['DAYS', cd.d], ['HRS', cd.h], ['MIN', cd.m], ['SEC', cd.s]].map(([l, v]) => (
              <div key={l as string} className="r-control bg-white/10 py-2 text-center">
                <p className="t-num text-2xl leading-none">{String(v).padStart(2, '0')}</p>
                <p className="t-micro text-white/50 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. MILESTONE — something to come back for. ── */}
      {milestone && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="t-meta font-bold text-slate-600 dark:text-white/70 inline-flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              {milestone.away} to {milestone.label}
            </p>
            <p className="t-num text-sm text-slate-400">{Math.round(milestone.pct)}%</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, milestone.pct)}%` }} />
          </div>
        </Card>
      )}

      {/* ── Ask about the festive weeks ── */}
      <AvailabilityNudge />

      {/* ── Alerts ── */}
      {alerts.map((a, n) => (
        <Link key={a.id} to={a.to}
          className={`block r-card px-3.5 py-2.5 border m-enter ${step(n)} ${
            a.tone === 'urgent' ? 'border-rose-200 dark:border-rose-400/25 bg-rose-50/70 dark:bg-rose-500/10'
            : a.tone === 'good' ? 'border-emerald-200 dark:border-emerald-400/25 bg-emerald-50/70 dark:bg-emerald-500/10'
            : 'border-slate-200 dark:border-white/10'}`}>
          <p className="font-black t-body text-slate-900 dark:text-white">{a.title}</p>
          <p className="t-meta text-slate-500 dark:text-white/55">{a.body}</p>
        </Link>
      ))}

      {/* ── Supporting rows ── */}
      {items.map((it, n) => (
        <Link key={it.label} to={it.to}
          className={`flex items-center gap-3 r-card px-3.5 py-3 border group m-enter ${step(n)} ${
            it.tone === 'green' ? 'border-emerald-200 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-500/10'
            : it.tone === 'amber' ? 'border-amber-200 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-500/10'
            : 'border-slate-200 dark:border-white/10'}`}>
          <div className="flex-1 min-w-0">
            <p className="t-micro font-black uppercase tracking-wider text-slate-400">{it.label}</p>
            <p className="font-black t-lead text-slate-900 dark:text-white truncate">{it.value}</p>
            {it.detail && <p className="t-meta text-slate-500 dark:text-white/50 truncate">{it.detail}</p>}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ))}
    </div>
  );
}
