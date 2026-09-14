import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useSeasonImpact } from '../hooks/useSeasonImpact';
import { useMembers } from '../hooks/useMembers';
import { seasonLabel } from '../config/season';

// ─── Season impact: the board, and one player's line ──────────────────────────
// Both render nothing until the season has a match with balls — a table of
// zeros would suggest everyone had no impact, rather than that it isn't measured.

function useNames() {
  const { members } = useMembers();
  return (id: string) => members.find(m => m.id === id)?.name ?? 'Guest';
}

export function SeasonImpactBoard({ season }: { season: string }) {
  const { rows, matchCount, loading } = useSeasonImpact(season);
  const name = useNames();
  if (loading || !rows.length) return null;

  const max = Math.max(1, ...rows.map(r => Math.abs(r.total)));
  return (
    <div className="glass r-card relative overflow-hidden p-4 mx-4 sm:mx-0">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-rose-400 to-purple-500" />
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 r-control bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center">
          <Zap className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="font-black text-slate-900 dark:text-white">Impact leaders · {seasonLabel(season)}</p>
          <p className="t-meta text-slate-500 dark:text-white/50">
            {matchCount} match{matchCount === 1 ? '' : 'es'} · base points for the scorecard + swing for moving results
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 8).map((r, i) => (
          <Link key={r.playerId} to={`/profile/${r.playerId}`} className="flex items-center gap-3 group">
            <span className={`w-5 text-center t-num text-sm ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white/90 truncate group-hover:underline">{name(r.playerId)}</p>
                <p className="t-num text-sm text-slate-900 dark:text-white flex-shrink-0">
                  {r.total > 0 ? '+' : ''}{r.total.toFixed(1)}
                  <span className="t-micro text-slate-400 font-bold ml-1.5">{r.perMatch.toFixed(1)}/m</span>
                </p>
              </div>
              <p className="t-micro text-slate-400 tabular-nums">
                base {r.base.toFixed(1)} · swing {r.swing > 0 ? '+' : ''}{r.swing.toFixed(1)} · {r.matches} m
              </p>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div className={`h-full rounded-full ${r.total >= 0 ? 'bg-gradient-to-r from-amber-400 to-rose-400' : 'bg-slate-300'}`}
                  style={{ width: `${Math.max(2, (Math.max(0, r.total) / max) * 100)}%` }} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SeasonImpactLine({ memberId, season }: { memberId: string; season: string }) {
  const { rows, loading } = useSeasonImpact(season);
  if (loading) return null;
  const idx = rows.findIndex(r => r.playerId === memberId);
  if (idx < 0) return null;
  const r = rows[idx];

  return (
    <div className="glass r-card relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-rose-400 to-purple-500" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 r-control bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-500 dark:text-white/50">Impact · {seasonLabel(season)}</p>
            <p className="font-black text-slate-900 dark:text-white">
              #{idx + 1} in the club <span className="text-slate-400 font-bold text-sm">of {rows.length}</span>
            </p>
          </div>
        </div>
        <p className="t-num text-3xl text-slate-900 dark:text-white">{r.total > 0 ? '+' : ''}{r.total.toFixed(1)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[['Base', r.base], ['Swing', r.swing], ['Per match', r.perMatch], ['Batting', r.batting], ['Bowling', r.bowling], ['Fielding', r.fielding]].map(([l, v]) => (
          <div key={l as string} className="r-control bg-slate-50 dark:bg-white/5 py-2">
            <p className="t-num text-base text-slate-900 dark:text-white">{v}</p>
            <p className="t-micro text-slate-500 dark:text-white/50">{l}</p>
          </div>
        ))}
      </div>
      {r.best && (
        <p className="t-meta text-slate-500 dark:text-white/50 mt-2">
          Best: <b className="text-slate-800 dark:text-white/85">+{r.best.total.toFixed(1)} ({r.best.grade})</b> v {r.best.opponent}
        </p>
      )}
    </div>
  );
}
