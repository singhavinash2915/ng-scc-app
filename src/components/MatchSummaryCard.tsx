import { useState } from 'react';
import { MapPin, Star, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Match } from '../types';
import { MatchScorecardModal } from './MatchScorecardModal';

interface Props {
  match: Match;
}

const RESULT_CONFIG = {
  won: {
    gradient: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40',
    text: 'WON',
    emoji: '🏆',
    scoreColor: 'text-emerald-300',
  },
  lost: {
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
    border: 'border-red-500/30',
    badge: 'bg-red-400/20 text-red-300 border-red-400/40',
    text: 'LOST',
    emoji: '😤',
    scoreColor: 'text-red-300',
  },
  draw: {
    gradient: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
    border: 'border-gray-500/30',
    badge: 'bg-gray-400/20 text-gray-300 border-gray-400/40',
    text: 'DRAW',
    emoji: '🤝',
    scoreColor: 'text-gray-300',
  },
};

export function MatchSummaryCard({ match }: Props) {
  const cfg = RESULT_CONFIG[match.result as 'won' | 'lost' | 'draw'] ?? RESULT_CONFIG.draw;
  const isInternal = match.match_type === 'internal';

  const matchDate = new Date(match.date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const [showScorecard, setShowScorecard] = useState(false);
  const matchLabel = isInternal
    ? 'Dhurandars vs Bazigars'
    : `SCC vs ${match.opponent ?? 'TBD'}`;

  return (
    <div className={`rounded-2xl overflow-hidden border ${cfg.border} shadow-xl`}
         style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #111111 100%)' }}>

      {/* ── Result banner ────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center justify-between"
           style={{ background: cfg.gradient }}>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{cfg.emoji}</span>
          <div>
            <p className="text-[9px] text-white/60 uppercase tracking-widest font-semibold">Last Match</p>
            <p className="text-xl font-black text-white leading-tight">{cfg.text}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/70 font-medium">
            {isInternal ? '🏟️ Internal' : `vs ${match.opponent || 'TBD'}`}
          </p>
          <p className="text-[11px] text-white/50">{matchDate}</p>
        </div>
      </div>

      {/* ── Score ────────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5">
        {isInternal ? (
          /* Internal match: Dhurandars vs Bazigars */
          <div className="flex items-center justify-center gap-5 mb-3">
            <div className="text-center">
              <p className="text-[10px] font-bold text-orange-400 mb-0.5">🦁 Dhurandars</p>
              <p className={`text-2xl font-black tabular-nums ${
                match.winning_team === 'dhurandars' ? 'text-yellow-400' : 'text-white/40'
              }`}>
                {match.our_score || '—'}
              </p>
              {match.winning_team === 'dhurandars' && (
                <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wide">Winners</span>
              )}
            </div>
            <span className="text-gray-600 font-bold text-lg">vs</span>
            <div className="text-center">
              <p className="text-[10px] font-bold text-blue-400 mb-0.5">🐅 Bazigars</p>
              <p className={`text-2xl font-black tabular-nums ${
                match.winning_team === 'bazigars' ? 'text-yellow-400' : 'text-white/40'
              }`}>
                {match.opponent_score || '—'}
              </p>
              {match.winning_team === 'bazigars' && (
                <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wide">Winners</span>
              )}
            </div>
          </div>
        ) : (
          /* External match: SCC vs Opponent */
          <div className="flex items-center justify-center gap-5 mb-3">
            <div className="text-center">
              <p className="text-[10px] font-bold text-emerald-400 mb-0.5">SCC</p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${cfg.scoreColor}`}>
                {match.our_score || '—'}
              </p>
            </div>
            <span className="text-gray-600 font-bold text-lg">vs</span>
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 mb-0.5 truncate max-w-[80px]">
                {match.opponent || 'OPP'}
              </p>
              <p className="text-2xl font-black tabular-nums tracking-tight text-white/40">
                {match.opponent_score || '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Meta row ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-t border-white/8 pt-2.5 flex-wrap">
          {match.venue && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {match.venue}
            </span>
          )}
          {match.man_of_match && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-400 font-semibold ml-auto">
              <Star className="w-3 h-3 fill-yellow-400 flex-shrink-0" />
              MOM: {match.man_of_match.name}
            </span>
          )}
        </div>

        {/* Notes */}
        {match.notes && (
          <p className="text-[11px] text-gray-600 mt-1.5 italic line-clamp-1">
            "{match.notes}"
          </p>
        )}

        {/* Full Scorecard button (only when ch_match_id set) + modal */}
        {match.ch_match_id && (
          <>
            <div className="mt-3 pt-2.5 border-t border-white/8">
              <button
                onClick={() => setShowScorecard(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-600/35 transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                View Full Scorecard
              </button>
            </div>
            <MatchScorecardModal
              isOpen={showScorecard}
              onClose={() => setShowScorecard(false)}
              chMatchId={match.ch_match_id}
              matchLabel={matchLabel}
              matchDate={matchDate}
            />
          </>
        )}

        {/* View all matches link */}
        <div className="mt-2 text-right">
          <Link
            to="/matches"
            className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            All matches →
          </Link>
        </div>
      </div>
    </div>
  );
}
