import { useMemo, useState } from 'react';
import { BarChart3, Loader2, Zap } from 'lucide-react';
import { useMatchInsights, type InningInsight, type PhaseStat } from '../hooks/useMatchAnalysis';

const SCC_TEAM_ID = 7927431;

function teamShort(name: string) {
  return name.length > 16 ? name.split(' ').slice(0, 2).join(' ') : name;
}

// Colour a ball pill in a turning-point over.
function ballStyle(b: string) {
  if (b === 'W') return 'bg-red-500 text-white';
  if (b === '4') return 'bg-cyan-500 text-white';
  if (b === '6') return 'bg-yellow-400 text-black';
  if (b === '0') return 'bg-white/10 text-gray-300';
  if (b === 'wd' || b === 'nb') return 'bg-orange-400/80 text-black';
  return 'bg-white/15 text-gray-100';
}

interface Props {
  chMatchId: string;
  innings1Name?: string;
  innings2Name?: string;
}

export function MatchInsights({ chMatchId, innings1Name, innings2Name }: Props) {
  const { data, loading, error } = useMatchInsights(chMatchId);
  const innings = data?.innings ?? null;
  const [tpView, setTpView] = useState<'batting' | 'bowling'>('batting');

  // Identify SCC innings vs opponent innings.
  const { scc, opp } = useMemo(() => {
    if (!innings) return { scc: null as InningInsight | null, opp: null as InningInsight | null };
    const s = innings.find(i => i.teamId === SCC_TEAM_ID) ?? innings[0];
    const o = innings.find(i => i !== s) ?? null;
    return { scc: s, opp: o };
  }, [innings]);

  const nameFor = (inn: InningInsight | null) =>
    !inn ? '' : inn.teamName || (inn.teamId === SCC_TEAM_ID ? 'Sangria Cricket Club'
      : (inn.inning === 1 ? innings1Name : innings2Name) || 'Opponent');

  // Phases won (by runs scored in each phase). Computed before any early return
  // so hook order stays stable.
  const phasesWon = useMemo(() => {
    let sccW = 0, oppW = 0, shared = 0;
    const n = Math.max(scc?.phases.length ?? 0, opp?.phases.length ?? 0);
    for (let i = 0; i < n; i++) {
      const sr = scc?.phases[i]?.runs ?? 0, or = opp?.phases[i]?.runs ?? 0;
      if (sr > or) sccW++; else if (or > sr) oppW++; else shared++;
    }
    return { sccW, oppW, shared };
  }, [scc, opp]);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>;
  }
  if (error || !scc) {
    return <p className="text-center text-sm text-gray-500 py-8">Insights unavailable for this match.</p>;
  }

  // We only show whole-innings totals (reconciled to the authoritative
  // scorecard). Per-over phase splits were dropped — the ball-by-ball feed is
  // unreliable on quick-scored matches.
  const sStat = scc?.total ?? null, oStat = opp?.total ?? null;

  const rows: Array<{ label: string; get: (s: PhaseStat) => string | number }> = [
    { label: 'Runs scored',   get: s => s.runs },
    { label: 'Wickets lost',  get: s => s.wickets },
    { label: 'Dots played',   get: s => s.dots },
    { label: 'Runs in 4s/6s', get: s => s.boundaryRuns },
    { label: 'Run rate',      get: s => s.runRate.toFixed(2) },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-white flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-purple-400" /> Phases of Play
      </h3>

      {/* Comparison table — whole-innings totals */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-3 px-3 py-2 bg-white/5 text-center">
          <p className="text-xs font-black text-emerald-400 truncate">{teamShort(nameFor(scc))}</p>
          <p className="text-[10px] text-gray-500 self-center">vs</p>
          <p className="text-xs font-black text-gray-300 truncate">{teamShort(nameFor(opp))}</p>
        </div>
        {sStat && rows.map(({ label, get }) => (
          <div key={label} className="grid grid-cols-3 px-3 py-2 text-center border-t border-white/5 items-center">
            <p className="text-sm font-black text-white tabular-nums">{get(sStat)}</p>
            <p className="text-[11px] text-gray-500">{label}</p>
            <p className="text-sm font-black text-white tabular-nums">{oStat ? get(oStat) : '–'}</p>
          </div>
        ))}
      </div>

      {/* CricHeroes insight one-liners (accurate) */}
      {data && data.insightStatements.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
          {data.insightStatements.slice(0, 4).map((s, i) => (
            <p key={i} className="text-[11px] text-gray-400 flex gap-2"><span className="text-purple-400">•</span>{s}</p>
          ))}
        </div>
      )}

      {/* Phases won bar */}
      {opp && (
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-emerald-400 font-bold">{phasesWon.sccW} phase{phasesWon.sccW !== 1 ? 's' : ''}</span>
            <span className="text-gray-500">Phases won</span>
            <span className="text-gray-300 font-bold">{phasesWon.oppW} phase{phasesWon.oppW !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
            <div className="bg-emerald-500" style={{ flex: phasesWon.sccW || 0.001 }} />
            <div className="bg-gray-500/40" style={{ flex: phasesWon.shared || 0.001 }} />
            <div className="bg-gray-400" style={{ flex: phasesWon.oppW || 0.001 }} />
          </div>
        </div>
      )}

      {/* Turning-point overs — Batting (SCC's innings) / Bowling (opp innings) */}
      {(() => {
        // Batting = SCC's own innings; Bowling = the innings SCC bowled (opponent's).
        const inn = tpView === 'batting' ? scc : opp;
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Turning-Point Overs
              </h3>
              <div className="flex rounded-full bg-white/10 p-0.5 text-[11px] font-bold">
                {(['batting', 'bowling'] as const).map(v => (
                  <button key={v} onClick={() => setTpView(v)}
                    className={`px-3 py-1 rounded-full capitalize transition ${tpView === v ? 'bg-emerald-500 text-white' : 'text-gray-300'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {inn ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] font-bold text-gray-400 mb-2">
                  Sangria Cricket Club — {tpView}{tpView === 'bowling' ? ` (vs ${teamShort(nameFor(opp))})` : ''}
                </p>
                <div className="space-y-2">
                  {inn.turning.slice(0, 3).map((t) => (
                    <div key={t.over} className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-gray-500 w-16 shrink-0">Over {t.over} · {t.runs}r{t.wickets ? `/${t.wickets}w` : ''}</span>
                      <div className="flex gap-1 flex-wrap">
                        {t.seq.map((b, i) => (
                          <span key={i} className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${ballStyle(b)}`}>{b}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">No {tpView} data for this match.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
