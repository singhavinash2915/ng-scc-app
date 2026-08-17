import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { commentaryFor, winProbability, chaseLine, keyMoments, overByOver } from '../lib/liveMatch';
import type { Ball, MatchFormat } from '../lib/cricketRules';

// ─── Live viewer ──────────────────────────────────────────────────────────────
// What everyone not at the ground sees. Deliberately source-agnostic: it takes
// balls, a score and a target, and does not care whether those came from our own
// scoring pad or from CricHeroes.
//
// That separation is the point. The whole reason for building in-app scoring was
// that CricHeroes stalls; a viewer that only understood CricHeroes would fall
// over in exactly the situation the scoring module exists to survive, and a
// viewer that only understood our pad would go dark whenever we score there
// instead. One screen, either source, no member needing to know which.

export interface LiveView {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  target: number | null;
  /** Empty when the source can't provide them — CricHeroes gives totals only. */
  balls: Ball[];
  /** Where the numbers came from, shown so nobody has to guess. */
  source: 'app' | 'cricheroes';
}

export function LiveViewer({ view, format, name }: {
  view: LiveView;
  format: MatchFormat;
  name: (id: string | null) => string;
}) {
  const chase = view.target != null ? {
    target: view.target, runs: view.runs, wickets: view.wickets,
    legalBalls: view.legalBalls,
    oversPerInnings: format.oversPerInnings, playersPerSide: format.playersPerSide,
  } : null;

  const pct = chase ? Math.round(winProbability(chase) * 100) : null;
  const overs = `${Math.floor(view.legalBalls / 6)}.${view.legalBalls % 6}`;

  // Newest first — a live feed is read from the top.
  const feed = useMemo(() => [...view.balls].reverse().slice(0, 40), [view.balls]);
  const moments = useMemo(() => keyMoments(view.balls).reverse().slice(0, 8), [view.balls]);
  const overs2 = useMemo(() => overByOver(view.balls), [view.balls]);
  const maxOver = Math.max(6, ...overs2.map(o => o.runs));

  return (
    <div className="space-y-3">
      {/* ── Score ── */}
      <div className="relative overflow-hidden r-card text-white shadow-2xl"
        style={{ background: 'linear-gradient(150deg,#052e16,#020617)' }}>
        <div className="p-6 text-center">
          <span className="inline-flex items-center gap-1.5 t-micro font-black uppercase tracking-[2px] text-emerald-300">
            <Radio className="w-3 h-3" /> Live · {view.battingTeam}
          </span>
          <p className="font-display text-6xl font-extrabold tabular-nums mt-2 leading-none">
            {view.runs}<span className="text-white/40">/</span>{view.wickets}
          </p>
          <p className="text-white/60 text-sm mt-1.5">
            {overs} / {format.oversPerInnings} ov · v {view.bowlingTeam}
          </p>
          {chase && (
            <p className="text-emerald-300 font-bold text-sm mt-1">{chaseLine(chase)}</p>
          )}

          {pct != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between t-micro font-black uppercase tracking-wider text-white/70">
                <span>{view.battingTeam} {pct}%</span>
                <span>{100 - pct}% {view.bowlingTeam}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="t-micro text-white/40 mt-1.5">
                A rough guide from the run rate and wickets in hand — not a betting line.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CricHeroes gives us totals, not deliveries. Rather than fake a feed,
          say plainly what this source can and can't show. */}
      {view.source === 'cricheroes' && (
        <div className="r-card border border-amber-200 dark:border-amber-400/20
                        bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <p className="t-body font-semibold text-amber-800 dark:text-amber-200">
            Scored on CricHeroes — live score only
          </p>
          <p className="t-meta text-amber-700/80 dark:text-amber-200/60 mt-0.5">
            Ball-by-ball commentary needs the match to be scored in the app.
          </p>
        </div>
      )}

      {view.balls.length > 0 && (
        <>
          {/* ── Over by over ── */}
          <div className="r-card border border-slate-200 dark:border-white/10 p-4">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-3">
              Over by over
            </p>
            <div className="flex items-end gap-1 h-20">
              {overs2.map(o => (
                <div key={o.over} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className={`w-full rounded-t ${o.wickets ? 'bg-rose-400' : 'bg-emerald-400'}`}
                    style={{ height: `${Math.max(6, (o.runs / maxOver) * 100)}%` }} />
                  <span className="t-micro font-bold text-slate-400 tabular-nums">{o.over + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Key moments ── */}
          {moments.length > 0 && (
            <div className="r-card border border-slate-200 dark:border-white/10 p-4">
              <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
                Key moments
              </p>
              <div className="space-y-1.5">
                {moments.map(b => (
                  <p key={b.seq} className="t-body text-slate-700 dark:text-white/75">
                    <span className={`inline-block w-9 text-center mr-2 rounded font-black t-micro py-0.5 ${
                      b.wicket_type ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                      {b.wicket_type ? 'W' : b.runs_off_bat}
                    </span>
                    {commentaryFor(b, name)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── Commentary ── */}
          <div className="r-card border border-slate-200 dark:border-white/10 p-4">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
              Commentary
            </p>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {feed.map(b => (
                <p key={b.seq} className="t-body text-slate-600 dark:text-white/60 leading-snug">
                  <span className="font-black text-slate-400 tabular-nums mr-2">
                    {b.over_no}.{b.ball_no + 1}
                  </span>
                  {commentaryFor(b, name)}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
