import { useState } from 'react';
import { MapPin, Trophy, Loader2, WifiOff, ExternalLink } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useFullScorecard, type InningsData, type BatterRow, type BowlerRow } from '../hooks/useFullScorecard';
import { MatchHeroes } from './MatchHeroes';
import { MatchInsights } from './MatchInsights';

type ModalView = 'heroes' | 'scorecard' | 'insights';

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  chMatchId: string;
  matchLabel?: string;    // e.g. "SCC vs RCB"
  matchDate?:  string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BattingTable({ innings }: { innings: InningsData }) {
  const dismissed = innings.batting.filter(b => b.balls > 0);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[400px]">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-1.5 pl-2 font-semibold text-gray-400 w-[35%]">Batsman</th>
            <th className="text-left py-1.5 font-semibold text-gray-500 w-[30%] hidden sm:table-cell">Dismissal</th>
            <th className="text-right py-1.5 pr-1 font-bold text-white w-10">R</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-400 w-10">B</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-500 w-8 hidden sm:table-cell">4s</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-500 w-8 hidden sm:table-cell">6s</th>
            <th className="text-right py-1.5 pr-2 font-semibold text-gray-500 w-14">SR</th>
          </tr>
        </thead>
        <tbody>
          {dismissed.map((b: BatterRow, i: number) => (
            <tr key={i}
                className={`border-b border-white/5 transition-colors ${
                  b.isNotOut ? 'bg-emerald-900/10' : ''
                }`}>
              <td className="py-1.5 pl-2">
                <span className={`font-medium ${b.isNotOut ? 'text-emerald-400' : 'text-white/80'}`}>
                  {b.name}
                </span>
                {b.isNotOut && (
                  <span className="ml-1 text-[9px] font-bold text-emerald-500 uppercase tracking-wide">not out</span>
                )}
              </td>
              <td className="py-1.5 text-gray-500 text-[11px] hidden sm:table-cell truncate max-w-[140px]">
                {b.isNotOut ? '—' : b.dismissal || 'not out'}
              </td>
              <td className="py-1.5 pr-1 text-right font-black text-white tabular-nums">
                {b.runs}
                {b.isNotOut && <span className="text-emerald-400">*</span>}
              </td>
              <td className="py-1.5 pr-1 text-right text-gray-400 tabular-nums">{b.balls}</td>
              <td className="py-1.5 pr-1 text-right text-gray-500 tabular-nums hidden sm:table-cell">{b.fours}</td>
              <td className="py-1.5 pr-1 text-right text-gray-500 tabular-nums hidden sm:table-cell">{b.sixes}</td>
              <td className="py-1.5 pr-2 text-right text-gray-500 tabular-nums">{b.strikeRate}</td>
            </tr>
          ))}
          {/* Extras + Total */}
          {innings.extrasTotal > 0 && (
            <tr className="border-b border-white/10">
              <td className="py-1.5 pl-2 text-gray-500 italic text-[11px]" colSpan={2}>
                Extras {innings.extrasSummary}
              </td>
              <td className="py-1.5 pr-2 text-right text-gray-400 font-semibold tabular-nums" colSpan={5}>
                {innings.extrasTotal}
              </td>
            </tr>
          )}
          <tr className="bg-white/5">
            <td className="py-2 pl-2 font-black text-white text-sm" colSpan={2}>
              TOTAL
              <span className="ml-2 text-gray-400 font-normal text-xs">{innings.overs}</span>
            </td>
            <td className="py-2 pr-2 text-right font-black text-yellow-400 text-sm tabular-nums" colSpan={5}>
              {innings.score}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BowlingTable({ innings }: { innings: InningsData }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[320px]">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-1.5 pl-2 font-semibold text-gray-400">Bowler</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-400 w-10">O</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-500 w-10 hidden sm:table-cell">M</th>
            <th className="text-right py-1.5 pr-1 font-semibold text-gray-400 w-10">R</th>
            <th className="text-right py-1.5 pr-1 font-bold text-white w-10">W</th>
            <th className="text-right py-1.5 pr-2 font-semibold text-gray-500 w-14">Econ</th>
          </tr>
        </thead>
        <tbody>
          {innings.bowling.map((b: BowlerRow, i: number) => (
            <tr key={i} className="border-b border-white/5">
              <td className="py-1.5 pl-2 font-medium text-white/80 truncate max-w-[120px]">{b.name}</td>
              <td className="py-1.5 pr-1 text-right text-gray-400 tabular-nums">{b.overs}</td>
              <td className="py-1.5 pr-1 text-right text-gray-500 tabular-nums hidden sm:table-cell">{b.maidens}</td>
              <td className="py-1.5 pr-1 text-right text-gray-400 tabular-nums">{b.runs}</td>
              <td className={`py-1.5 pr-1 text-right font-black tabular-nums ${
                b.wickets >= 3 ? 'text-yellow-400' : b.wickets > 0 ? 'text-white' : 'text-gray-600'
              }`}>{b.wickets}</td>
              <td className="py-1.5 pr-2 text-right text-gray-500 tabular-nums">{b.economy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InningsTab({ innings, label }: { innings: InningsData; label: string }) {
  return (
    <div className="space-y-4">
      {/* Innings header */}
      <div className="flex items-baseline justify-between pb-2 border-b border-white/10">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
          <p className="text-base font-black text-white mt-0.5">{innings.teamName}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-yellow-400 tabular-nums">{innings.score}</p>
          <p className="text-[11px] text-gray-500">{innings.overs} · RR {innings.runRate}</p>
        </div>
      </div>

      {/* Batting */}
      <div>
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          🏏 Batting
        </p>
        <BattingTable innings={innings} />
      </div>

      {/* Bowling */}
      <div>
        <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          🎯 Bowling
        </p>
        <BowlingTable innings={innings} />
      </div>

      {/* Fall of wickets */}
      {innings.fallOfWickets && (
        <div className="pt-2 border-t border-white/8">
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-1">
            Fall of Wickets
          </p>
          <p className="text-[11px] text-gray-500 leading-relaxed">{innings.fallOfWickets}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function MatchScorecardModal({ isOpen, onClose, chMatchId, matchLabel, matchDate }: Props) {
  const { data, loading, error } = useFullScorecard(chMatchId, isOpen);
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState<ModalView>('heroes');

  const chUrl = `https://cricheroes.in/scorecard/${chMatchId}/x/x/scorecard`;
  const inn1Name = data?.innings[0]?.teamName;
  const inn2Name = data?.innings[1]?.teamName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Match Centre" size="xl">
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0b0b0b 0%, #0f0f0f 100%)' }}
      >
        {/* Top-level view tabs — Heroes · Scorecard · Insights */}
        <div className="flex gap-1 p-1 m-3 mb-0 bg-white/5 rounded-xl">
          {([['heroes', '🏆 Heroes'], ['scorecard', '📋 Scorecard'], ['insights', '📊 Insights']] as [ModalView, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                view === v ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Heroes panel */}
        {view === 'heroes' && (
          <div className="p-4"><MatchHeroes chMatchId={chMatchId} /></div>
        )}

        {/* Insights panel */}
        {view === 'insights' && (
          <div className="p-4"><MatchInsights chMatchId={chMatchId} innings1Name={inn1Name} innings2Name={inn2Name} /></div>
        )}

        {/* Scorecard panel */}
        {view === 'scorecard' && (<>
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            <p className="text-sm text-gray-500">Fetching scorecard from CricHeroes…</p>
          </div>
        )}

        {/* Error */}
        {error && !data && (
          <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
            <WifiOff className="w-8 h-8 text-gray-700" />
            <p className="text-sm text-gray-500">Scorecard unavailable</p>
            <a href={chUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />
              View on CricHeroes
            </a>
          </div>
        )}

        {/* Data */}
        {data && (
          <div className="p-4 space-y-4">
            {/* Match summary header */}
            <div className="rounded-xl overflow-hidden border border-white/8">
              {/* Result banner */}
              <div className="px-4 py-3 flex items-center justify-between"
                   style={{ background: 'linear-gradient(135deg, #2d1657 0%, #1a0f3a 100%)' }}>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm font-black text-white">{data.matchResult || matchLabel}</p>
                </div>
                {data.mvpName && (
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-[9px] text-purple-300/70 uppercase tracking-widest">MVP</p>
                    <p className="text-xs font-bold text-yellow-400">⭐ {data.mvpName}</p>
                  </div>
                )}
              </div>
              {/* Meta */}
              <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 bg-black/20">
                {data.ground && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {data.ground}{data.city ? `, ${data.city}` : ''}
                  </span>
                )}
                {(data.maxOvers > 0 || data.ballType) && (
                  <span className="text-[11px] text-gray-500">
                    {data.maxOvers > 0 ? `${data.maxOvers} Ov` : ''}
                    {data.ballType ? ` · ${data.ballType}` : ''}
                  </span>
                )}
                {matchDate && (
                  <span className="text-[11px] text-gray-500">{matchDate}</span>
                )}
                <a href={chUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 ml-auto">
                  <ExternalLink className="w-3 h-3" />CricHeroes
                </a>
              </div>
            </div>

            {/* Innings tabs */}
            {data.innings.length > 1 && (
              <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                {data.innings.map((inn, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === i
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {i + 1}st{i === 1 ? '/2nd' : ''} Inn · {inn.teamName.split(' ').pop()}
                  </button>
                ))}
              </div>
            )}

            {/* Active innings */}
            {data.innings[activeTab] && (
              <InningsTab
                innings={data.innings[activeTab]}
                label={activeTab === 0 ? '1st Innings' : '2nd Innings'}
              />
            )}
          </div>
        )}
        </>)}
      </div>
    </Modal>
  );
}
