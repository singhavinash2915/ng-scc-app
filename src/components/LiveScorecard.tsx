import { RefreshCw } from 'lucide-react';
import type { LiveScoreData } from '../hooks/useLiveScore';

interface Props {
  data:          LiveScoreData | null;
  loading:       boolean;
  error:         string | null;
  countdown:     number;
  refetch:       () => void;
  chMatchId:     string;
  matchOpponent?: string | null;
  matchVenue?:   string | null;
  matchDate?:    string | null;   // ISO date string
}

// Colour each ball in the current over
const BALL_STYLE: Record<string, string> = {
  W: 'bg-red-500 text-white',
  '4': 'bg-cyan-400 text-black',
  '6': 'bg-yellow-400 text-black',
  '.': 'bg-gray-600 text-white',
  wd: 'bg-orange-400 text-black',
  nb: 'bg-orange-300 text-black',
};
function ballStyle(ball: string) {
  return BALL_STYLE[ball] ?? 'bg-gray-700 text-white';
}

export function LiveScorecard({
  data, loading, error, countdown, refetch,
  chMatchId, matchOpponent, matchVenue, matchDate,
}: Props) {
  const chUrl = `https://cricheroes.in/scorecard/${chMatchId}/x/x/live`;
  const isLive = !!data && !data.result;           // in-progress
  const isOver = !!data?.result;                   // completed
  const isPreMatch = !data && (error || loading);  // not started yet

  const fmtMatchDate = matchDate
    ? new Date(matchDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: isLive
          ? 'linear-gradient(160deg, #0e0024 0%, #07000f 100%)'
          : 'linear-gradient(140deg, #050f1a 0%, #071525 100%)',
      }}
    >
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        {/* Status badge: LIVE (red pulsing) when in-progress, MATCH DAY (amber) pre-match */}
        {isLive ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black text-red-400 tracking-widest uppercase">Live</span>
          </span>
        ) : isOver ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/20 border border-gray-500/30 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Completed</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Match Day</span>
          </span>
        )}

        {/* Venue */}
        {matchVenue && (
          <span className="text-[11px] text-gray-400/60 truncate hidden sm:block">
            📍 {matchVenue}
          </span>
        )}

        {/* Right side: refresh countdown + CricHeroes link */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-600 tabular-nums">
            {loading ? 'Checking…' : `↻ ${countdown}s`}
          </span>
          <button
            onClick={refetch}
            disabled={loading}
            className="p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={chUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors hidden sm:block"
          >
            CricHeroes →
          </a>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-3">

        {/* ── PRE-MATCH state: match day but not started yet ──────────── */}
        {isPreMatch && (
          <div className="py-2">
            {/* Opponent name + venue */}
            <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest mb-1">
              Today's Match
            </p>
            <p className="text-xl font-black text-white mb-1">
              SCC vs <span className="text-emerald-400">{matchOpponent || 'TBD'}</span>
            </p>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap mb-3">
              {matchVenue && <span>📍 {matchVenue}</span>}
              {fmtMatchDate && <span>🗓 {fmtMatchDate}</span>}
            </div>
            {/* Status strip — adapts based on time of day */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <p className="text-[11px] text-amber-300/70">
                {new Date().getHours() >= 6
                  ? 'Match may be in progress · live score loading automatically…'
                  : 'Waiting for match to start · auto-refreshing every 15s'}
              </p>
            </div>
            <a
              href={chUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Follow live on CricHeroes →</span>
            </a>
          </div>
        )}

        {/* Match-over state */}
        {data?.result && (
          <div className="py-3 text-center space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Match Completed</p>
            <p className="text-base font-black text-yellow-400">{data.result}</p>
            <a href={chUrl} target="_blank" rel="noopener noreferrer"
               className="text-[11px] text-purple-400 hover:underline">Full scorecard →</a>
          </div>
        )}

        {/* In-progress state */}
        {(data && !data.result) && (
          <>
            {/* ── Score row ─────────────────────────────────────── */}
            <div className="flex items-end justify-between mb-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-bold text-white/70 truncate">
                  {data.battingTeam || (matchOpponent ? 'SCC' : '—')}
                </span>
              </div>
              {data.bowlingTeam && (
                <span className="text-[10px] text-gray-500 pb-1 truncate">
                  vs <span className="text-gray-400 font-semibold">{data.bowlingTeam}</span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              {data.score && (
                <span className="text-4xl font-black text-yellow-400 leading-none tabular-nums tracking-tight">
                  {data.score}
                </span>
              )}
              {data.overs && (
                <span className="text-sm font-mono text-cyan-400 font-bold">({data.overs} Ov)</span>
              )}
            </div>

            {/* ── Rates + projected ─────────────────────────────── */}
            <div className="flex items-center gap-3 mb-2 flex-wrap text-[11px]">
              {data.runRate && (
                <span className="text-gray-400">CRR <span className="text-cyan-300 font-mono font-bold">{data.runRate}</span></span>
              )}
              {data.battingFirst && data.projectedScore != null && data.projectedScore > 0 && (
                <span className="text-gray-400">Proj. score <span className="text-emerald-300 font-mono font-bold">{data.projectedScore}</span></span>
              )}
              {!data.battingFirst && data.requiredRunRate && (
                <span className="text-gray-400">RRR <span className="text-orange-400 font-mono font-bold">{data.requiredRunRate}</span></span>
              )}
              {data.partnership && (
                <span className="text-gray-400">P'ship <span className="text-white/80 font-mono font-bold">{data.partnership}</span></span>
              )}
            </div>

            {/* ── Toss strip ─────────────────────────────────────── */}
            {data.tossDetails && (
              <p className="text-[10px] text-amber-400/70 mb-3 truncate">🪙 {data.tossDetails}</p>
            )}

            {/* ── Current over balls ─────────────────────────────── */}
            {data.currentOver.length > 0 && (
              <div className="flex items-center gap-1 mb-3 flex-wrap">
                <span className="text-[9px] text-gray-600 uppercase tracking-widest mr-1">Over</span>
                {data.currentOver.map((ball, i) => (
                  <span
                    key={i}
                    className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${ballStyle(ball)}`}
                  >
                    {ball === '.' ? '•' : ball}
                  </span>
                ))}
              </div>
            )}

            {/* ── Batters table (CricHeroes style) ──────────────── */}
            {data.batters && data.batters.length > 0 && (
              <div className="mt-3 rounded-xl bg-black/30 border border-white/8 overflow-hidden">
                <div className="grid grid-cols-[1fr_36px_36px_28px_28px_44px] gap-1 px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <span>Batters</span>
                  <span className="text-right">R</span>
                  <span className="text-right">B</span>
                  <span className="text-right">4s</span>
                  <span className="text-right">6s</span>
                  <span className="text-right">SR</span>
                </div>
                {data.batters.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_36px_36px_28px_28px_44px] gap-1 px-3 py-2 text-xs items-center">
                    <span className={`truncate ${b.isStriker ? 'text-yellow-300 font-bold' : 'text-white/80 font-semibold'}`}>
                      {b.name}{b.isStriker ? ' *' : ''}
                    </span>
                    <span className={`text-right tabular-nums font-bold ${b.isStriker ? 'text-yellow-300' : 'text-white'}`}>{b.runs}</span>
                    <span className="text-right tabular-nums text-white/70">{b.balls}</span>
                    <span className="text-right tabular-nums text-white/50">{b.fours}</span>
                    <span className="text-right tabular-nums text-white/50">{b.sixes}</span>
                    <span className="text-right tabular-nums text-white/60">{b.sr}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Bowlers table ─────────────────────────────────── */}
            {data.bowlers && data.bowlers.length > 0 && (
              <div className="mt-2 rounded-xl bg-black/30 border border-white/8 overflow-hidden">
                <div className="grid grid-cols-[1fr_36px_28px_36px_28px_44px] gap-1 px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <span>Bowlers</span>
                  <span className="text-right">O</span>
                  <span className="text-right">M</span>
                  <span className="text-right">R</span>
                  <span className="text-right">W</span>
                  <span className="text-right">Eco</span>
                </div>
                {data.bowlers.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_36px_28px_36px_28px_44px] gap-1 px-3 py-2 text-xs items-center">
                    <span className={`truncate ${i === 0 ? 'text-cyan-300 font-bold' : 'text-white/70 font-semibold'}`}>
                      {b.name}{i === 0 ? ' *' : ''}
                    </span>
                    <span className="text-right tabular-nums text-white/80">{b.overs}</span>
                    <span className="text-right tabular-nums text-white/50">{b.maidens}</span>
                    <span className="text-right tabular-nums text-white/80">{b.runs}</span>
                    <span className={`text-right tabular-nums font-bold ${b.wickets > 0 ? 'text-red-400' : 'text-white/50'}`}>{b.wickets}</span>
                    <span className="text-right tabular-nums text-white/60">{b.economy}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Loading skeleton (first load only) */}
        {loading && !data && !error && (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-9 w-32 bg-white/5 rounded-lg" />
            <div className="h-4 w-48 bg-white/5 rounded" />
            <div className="border-t border-white/8 my-2" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-4 w-36 bg-white/5 rounded" />
                <div className="h-4 w-28 bg-white/5 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-4 w-32 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
