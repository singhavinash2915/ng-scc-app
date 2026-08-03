import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { Member } from '../types';
import type { Ballot, Candidate } from '../hooks/useLeagueResult';

// ─── Vote race ─────────────────────────────────────────────────────────────────
// The count replayed against the clock: bars grow and swap places as ballots
// land. Deliberately shows CANDIDATE TOTALS ONLY — never who cast which vote —
// so it can be projected to the whole club without breaking the secret ballot.

interface Props {
  ballots: Ballot[];              // valid ballots, any order
  candidates: Candidate[];        // final standings, used for colour + tie-break
  memberById: Record<string, Member>;
}

const ROW_H = 38;
const GAP = 8;
const STEP_MS = 420;

const istClock = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

export function VoteRace({ ballots, candidates, memberById }: Props) {
  const steps = useMemo(
    () => [...ballots].sort((a, b) => a.at.localeCompare(b.at)),
    [ballots],
  );

  const [idx, setIdx] = useState(steps.length);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const atEnd = idx >= steps.length;
  // Derived rather than stored, so reaching the end doesn't need a setState
  // inside the effect (which would cascade an extra render every tick).
  const running = playing && !atEnd;

  useEffect(() => {
    if (!running) return;
    timer.current = window.setTimeout(() => setIdx(i => i + 1), STEP_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [running, idx]);

  const finalRank = useMemo(
    () => Object.fromEntries(candidates.map((c, i) => [c.id, i])) as Record<string, number>,
    [candidates],
  );

  /** Running totals at the current point in time, ordered like a live table. */
  const rows = useMemo(() => {
    const tally = new Map<string, number>();
    steps.slice(0, idx).forEach(b => tally.set(b.captainId, (tally.get(b.captainId) || 0) + 1));
    return candidates
      .map(c => ({ id: c.id, votes: tally.get(c.id) || 0 }))
      .sort((a, b) => b.votes - a.votes || (finalRank[a.id] ?? 99) - (finalRank[b.id] ?? 99));
  }, [steps, idx, candidates, finalRank]);

  const max = Math.max(1, ...rows.map(r => r.votes));
  const lastAt = idx > 0 ? steps[Math.min(idx, steps.length) - 1].at : null;
  const leader = rows[0];
  const colourFor = (id: string) =>
    finalRank[id] === 0 ? 'var(--vr-1)' : finalRank[id] === 1 ? 'var(--vr-2)' : 'var(--vr-muted)';

  const toggle = () => {
    if (atEnd) { setIdx(0); setPlaying(true); return; }
    setPlaying(p => !p);
  };

  return (
    <div className="vr-root">
      <style>{`
        .vr-root { --vr-1:#2a78d6; --vr-2:#eb6834; --vr-muted:#b8b6ae;
                   --vr-track:#f0efea; --vr-ink:#0b0b0b; --vr-ink-2:#52514e; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vr-root {
            --vr-1:#3987e5; --vr-2:#d95926; --vr-muted:#6b6a63;
            --vr-track:rgba(255,255,255,.08); --vr-ink:#fff; --vr-ink-2:#c3c2b7; }
        }
        :root[data-theme="dark"] .vr-root {
          --vr-1:#3987e5; --vr-2:#d95926; --vr-muted:#6b6a63;
          --vr-track:rgba(255,255,255,.08); --vr-ink:#fff; --vr-ink-2:#c3c2b7; }
        .vr-row  { position:absolute; left:0; right:0; display:flex; align-items:center; gap:10px;
                   transition: transform .5s cubic-bezier(.22,1,.36,1); }
        .vr-fill { height:10px; border-radius:5px; transition: width .45s cubic-bezier(.22,1,.36,1); }
        @media (prefers-reduced-motion: reduce) {
          .vr-row, .vr-fill { transition: none; }
        }
      `}</style>

      {/* transport */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <button onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-white
                     text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-black">
          {atEnd ? <RotateCcw className="w-3.5 h-3.5" />
            : running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {atEnd ? 'Replay' : running ? 'Pause' : 'Play'}
        </button>

        <input
          type="range" min={0} max={steps.length} value={idx}
          onChange={e => { setPlaying(false); setIdx(Number(e.target.value)); }}
          className="flex-1 min-w-[120px] accent-slate-900 dark:accent-white"
          aria-label="Scrub through the vote timeline"
        />

        <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-white/60">
          {idx}/{steps.length}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-bold text-slate-500 dark:text-white/60">
          {lastAt ? istClock(lastAt) : 'Before the first ballot'}
        </p>
        {leader && leader.votes > 0 && (
          <p className="text-xs font-black text-slate-900 dark:text-white">
            Leading: {memberById[leader.id]?.name?.split(' ')[0] ?? '?'}
          </p>
        )}
      </div>

      {/* the race */}
      <div className="relative" style={{ height: rows.length * (ROW_H + GAP) }}>
        {rows.map((r, i) => (
          <div key={r.id} className="vr-row" style={{ transform: `translateY(${i * (ROW_H + GAP)}px)` }}>
            <span className="text-[11px] font-black w-4 text-right tabular-nums text-slate-400">
              {i + 1}
            </span>
            <span className="text-xs font-bold w-24 sm:w-32 truncate text-slate-700 dark:text-white/80">
              {memberById[r.id]?.name?.split(' ')[0] ?? '?'}
            </span>
            <div className="flex-1 rounded-full" style={{ background: 'var(--vr-track)', height: 10 }}>
              <div className="vr-fill"
                style={{ width: `${(r.votes / max) * 100}%`, background: colourFor(r.id) }} />
            </div>
            <span className="text-xs font-black tabular-nums w-5 text-right text-slate-900 dark:text-white">
              {r.votes}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-white/60 mt-3">
        Totals only — the race never shows who cast which ballot 🤐
      </p>
    </div>
  );
}
