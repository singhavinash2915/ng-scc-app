import { useMemo } from 'react';
import { MapPin, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { normalizeVenue } from '../utils/normalizeVenue';
import type { Match } from '../types';

interface Props {
  matches: Match[];
  compact?: boolean; // true = dashboard compact view
}

export function GroundOpponentInsights({ matches, compact = false }: Props) {
  const completed = useMemo(
    () => matches.filter(m => ['won', 'lost', 'draw'].includes(m.result) && m.match_type !== 'internal'),
    [matches]
  );

  // ── Ground stats ────────────────────────────────────────────────────────────
  const groundStats = useMemo(() => {
    const byGround: Record<string, { name: string; played: number; won: number; lost: number; draw: number }> = {};
    for (const m of completed) {
      if (!m.venue?.trim()) continue;
      const name = normalizeVenue(m.venue);
      if (!byGround[name]) byGround[name] = { name, played: 0, won: 0, lost: 0, draw: 0 };
      byGround[name].played++;
      if (m.result === 'won')  byGround[name].won++;
      if (m.result === 'lost') byGround[name].lost++;
      if (m.result === 'draw') byGround[name].draw++;
    }
    return Object.values(byGround)
      .map(g => ({ ...g, winRate: (g.won + g.lost) > 0 ? Math.round((g.won / (g.won + g.lost)) * 100) : 0 }))
      .sort((a, b) => b.played - a.played)
      .slice(0, compact ? 5 : 20);
  }, [completed, compact]);

  // ── Opponent stats ───────────────────────────────────────────────────────────
  const opponentStats = useMemo(() => {
    const byOpp: Record<string, { name: string; played: number; won: number; lost: number }> = {};
    for (const m of completed) {
      if (!m.opponent?.trim()) continue;
      const name = m.opponent.trim();
      if (!byOpp[name]) byOpp[name] = { name, played: 0, won: 0, lost: 0 };
      byOpp[name].played++;
      if (m.result === 'won')  byOpp[name].won++;
      if (m.result === 'lost') byOpp[name].lost++;
    }
    const all = Object.values(byOpp)
      .filter(o => (o.won + o.lost) >= 3) // min 3 decisive results
      .map(o => ({ ...o, winRate: Math.round((o.won / (o.won + o.lost)) * 100) }))
      .sort((a, b) => b.winRate - a.winRate || b.played - a.played);

    return {
      best:  all.slice(0, 5),
      worst: [...all].sort((a, b) => a.winRate - b.winRate || b.played - a.played).slice(0, 5),
    };
  }, [completed]);

  if (groundStats.length === 0) return null;

  const WinRateBar = ({ won, lost, draw }: { won: number; lost: number; draw: number }) => {
    const total = won + lost + draw;
    return (
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
        {won  > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(won/total)*100}%` }} />}
        {draw > 0 && <div className="h-full bg-amber-400"   style={{ width: `${(draw/total)*100}%` }} />}
        {lost > 0 && <div className="h-full bg-red-500"     style={{ width: `${(lost/total)*100}%` }} />}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Grounds */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mb-2">
            <MapPin className="w-3 h-3" /> Ground Win Rates
          </p>
          <div className="space-y-2">
            {groundStats.slice(0, 5).map(g => (
              <div key={g.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{g.name}</span>
                  <span className={`text-xs font-black tabular-nums ${g.winRate >= 60 ? 'text-emerald-500' : g.winRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                    {g.winRate}% <span className="text-[10px] font-normal text-gray-400">({g.played})</span>
                  </span>
                </div>
                <WinRateBar won={g.won} lost={g.lost} draw={g.draw} />
              </div>
            ))}
          </div>
        </div>

        {/* Opponents */}
        {(opponentStats.best.length > 0 || opponentStats.worst.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[2px] text-emerald-500 flex items-center gap-1 mb-1.5">
                <TrendingUp className="w-3 h-3" /> Strong vs
              </p>
              {opponentStats.best.slice(0, 5).map(o => (
                <div key={o.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1 mr-1">{o.name}</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">{o.winRate}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[2px] text-red-500 flex items-center gap-1 mb-1.5">
                <TrendingDown className="w-3 h-3" /> Tough vs
              </p>
              {opponentStats.worst.slice(0, 5).map(o => (
                <div key={o.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1 mr-1">{o.name}</span>
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 tabular-nums flex-shrink-0">{o.winRate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Full view (Analytics page) ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Ground-wise */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Ground-wise Performance</h3>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full font-medium">
            {groundStats.length} grounds
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {groundStats.map((g, idx) => (
            <div key={g.name} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-amber-400 text-white'
                    : idx === 1 ? 'bg-gray-400 text-white'
                    : idx === 2 ? 'bg-orange-400 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{g.name}</p>
                    <p className="text-[10px] text-gray-500">{g.played} matches · W{g.won} L{g.lost}{g.draw > 0 ? ` NR${g.draw}` : ''}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xl font-black tabular-nums ${
                    g.winRate >= 60 ? 'text-emerald-500' : g.winRate >= 40 ? 'text-amber-500' : 'text-red-500'
                  }`}>{g.winRate}%</p>
                </div>
              </div>
              <WinRateBar won={g.won} lost={g.lost} draw={g.draw} />
            </div>
          ))}
        </div>
      </div>

      {/* Opponent analysis */}
      {(opponentStats.best.length > 0 || opponentStats.worst.length > 0) && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Opponent Analysis</h3>
            <span className="text-xs text-gray-400 ml-auto">Min. 3 decisive results</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
            {/* Best */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-bold text-sm text-gray-800 dark:text-white">Best Win Rate vs</p>
              </div>
              <div className="space-y-3">
                {opponentStats.best.map((o, i) => (
                  <div key={o.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 w-4">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-gray-400">{o.played}P · {o.won}W{o.lost}L</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{o.winRate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${o.winRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Worst */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="font-bold text-sm text-gray-800 dark:text-white">Toughest Opponents</p>
              </div>
              <div className="space-y-3">
                {opponentStats.worst.map((o, i) => (
                  <div key={o.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 w-4">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-gray-400">{o.played}P · {o.won}W{o.lost}L</span>
                        <span className="text-sm font-black text-red-600 dark:text-red-400 tabular-nums">{o.winRate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - o.winRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
