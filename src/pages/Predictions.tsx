import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Trophy, Target, TrendingUp, ChevronRight, ChevronDown, Sparkles, Medal,
  Shield, Eye, EyeOff,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';
import { usePredictionLeaderboard, usePredictions } from '../hooks/usePredictions';
import { supabase } from '../lib/supabase';
import { deriveOutcome, PREDICTION_POINTS } from '../lib/predictionScorer';
import { PredictMatchModal } from '../components/PredictMatchModal';
import type { Match } from '../types';
import type { MatchScorecard } from '../hooks/useMatchScorecard';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function Predictions() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const { isAdmin } = useAuth();
  const { leaderboard } = usePredictionLeaderboard();
  const { predictions: allPredictions } = usePredictions();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [adminViewOpen, setAdminViewOpen] = useState(false);

  // Auto-score any unscored predictions whose match has settled and has a scorecard
  const [scoring, setScoring] = useState(false);
  const [scoredCount, setScoredCount] = useState<number | null>(null);

  const scoreSettledPredictions = async () => {
    setScoring(true);
    let scoredHere = 0;
    try {
      // Find matches that are settled (won/lost/draw)
      const settledMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
      if (settledMatches.length === 0) { setScoredCount(0); return; }

      // Fetch any unscored predictions for those matches
      const unscored = allPredictions.filter(p =>
        p.points_earned === null &&
        settledMatches.some(m => m.id === p.match_id)
      );
      if (unscored.length === 0) { setScoredCount(0); return; }

      // For each match with unscored predictions, fetch its scorecard once
      const matchIds = [...new Set(unscored.map(p => p.match_id))];
      const { data: cards } = await supabase
        .from('match_scorecards')
        .select('*')
        .in('match_id', matchIds);
      const cardByMatch: Record<string, MatchScorecard> = {};
      (cards || []).forEach((c: MatchScorecard) => { cardByMatch[c.match_id] = c; });

      // Score each prediction
      for (const p of unscored) {
        const match = settledMatches.find(m => m.id === p.match_id);
        if (!match) continue;
        const outcome = deriveOutcome(match, cardByMatch[p.match_id] || null, members);
        if (!outcome) continue;

        let points = 0;
        if (p.winner === outcome.winner) points += PREDICTION_POINTS.winner;
        if (p.top_scorer_id && p.top_scorer_id === outcome.top_scorer_id) points += PREDICTION_POINTS.top_scorer;
        if (p.top_wicket_taker_id && p.top_wicket_taker_id === outcome.top_wicket_taker_id) points += PREDICTION_POINTS.top_wicket_taker;
        if (p.mom_id && p.mom_id === outcome.mom_id) points += PREDICTION_POINTS.mom;

        const { error } = await supabase
          .from('match_predictions')
          .update({ points_earned: points, scored_at: new Date().toISOString() })
          .eq('id', p.id);
        if (!error) scoredHere++;
      }
      setScoredCount(scoredHere);
      // Force a re-fetch by reloading the page if anything was scored
      if (scoredHere > 0) {
        setTimeout(() => window.location.reload(), 800);
      }
    } finally {
      setScoring(false);
    }
  };

  // Auto-trigger scoring once on page load
  useEffect(() => {
    if (matches.length === 0 || allPredictions.length === 0) return;
    const unscored = allPredictions.filter(p => p.points_earned === null);
    if (unscored.length === 0) return;
    scoreSettledPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length, allPredictions.length]);

  // Upcoming matches available for prediction
  const upcomingMatches = useMemo(() =>
    matches
      .filter(m => m.result === 'upcoming')
      .sort((a, b) => a.date.localeCompare(b.date))
  , [matches]);

  // Recent settled matches with predictions
  const settledWithPredictions = useMemo(() => {
    const settled = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    return settled
      .map(m => ({
        match: m,
        predictions: allPredictions.filter(p => p.match_id === m.id),
      }))
      .filter(x => x.predictions.length > 0);
  }, [matches, allPredictions]);

  const memberById = useMemo(() => {
    const m: Record<string, typeof members[0]> = {};
    members.forEach(x => { m[x.id] = x; });
    return m;
  }, [members]);

  const [predictMatch, setPredictMatch] = useState<Match | null>(null);

  return (
    <div>
      <Header title="Predictions Game" subtitle="Pre-match predictions · Season 2025–26" />

      <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">

        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl p-6 lg:p-7 shadow-xl"
             style={{ background: 'radial-gradient(500px circle at 0% 0%, rgba(168,85,247,0.3), transparent 50%), linear-gradient(135deg, #2e1065 0%, #1a0b3d 60%, #0f0820 100%)' }}>
          <div className="absolute inset-0 border border-purple-500/30 rounded-3xl pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-purple-400/20 border-2 border-purple-400/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-8 h-8 text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl lg:text-3xl font-black text-white">Predict & Win</h2>
              <p className="text-purple-200/70 text-sm mt-1">
                Before each match: who wins? top scorer? top wicket-taker? MOM?
                Earn up to <span className="font-bold text-amber-300">+30 points</span> per match.
              </p>
            </div>
          </div>
        </div>

        {scoredCount !== null && scoredCount > 0 && (
          <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 text-sm text-emerald-700 dark:text-emerald-300 font-semibold text-center">
            ✓ Scored {scoredCount} prediction{scoredCount > 1 ? 's' : ''} · refreshing…
          </div>
        )}
        {scoring && scoredCount === null && (
          <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300 text-center">
            ⏳ Scoring predictions…
          </div>
        )}

        {/* SCORING RULES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Trophy className="w-4 h-4 text-amber-400" />, label: 'Winner', points: PREDICTION_POINTS.winner, color: 'text-amber-300' },
            { icon: <TrendingUp className="w-4 h-4 text-blue-400" />, label: 'Top Scorer', points: PREDICTION_POINTS.top_scorer, color: 'text-blue-300' },
            { icon: <Target className="w-4 h-4 text-red-400" />, label: 'Top Wicket-Taker', points: PREDICTION_POINTS.top_wicket_taker, color: 'text-red-300' },
            { icon: <Crown className="w-4 h-4 text-amber-400" />, label: 'MOM', points: PREDICTION_POINTS.mom, color: 'text-amber-300' },
          ].map(r => (
            <div key={r.label} className="rounded-xl p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1">{r.icon}<span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{r.label}</span></div>
              <p className={`text-xl font-black tabular-nums ${r.color}`}>+{r.points} pts</p>
            </div>
          ))}
        </div>

        {/* PREDICT NEXT MATCHES */}
        {upcomingMatches.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Predict the Next Match
            </h3>
            <div className="space-y-3">
              {upcomingMatches.slice(0, 3).map(m => {
                const predictionCount = allPredictions.filter(p => p.match_id === m.id).length;
                return (
                  <div key={m.id} className="rounded-2xl p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500">{fmtDate(m.date)}</p>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                          {m.match_type === 'internal'
                            ? 'Dhurandars vs Bazigars'
                            : <>SCC vs <span className="text-emerald-600 dark:text-emerald-400">{m.opponent || 'TBD'}</span></>
                          }
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          📍 {m.venue} · 🎰 {predictionCount} predicted
                        </p>
                      </div>
                      <Button onClick={() => setPredictMatch(m)} className="flex-shrink-0">
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        Predict
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {leaderboard.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
              Season Predictor Leaderboard
            </h3>
            <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">Predictor</th>
                    <th className="text-right px-3 py-3">Matches</th>
                    <th className="text-right px-3 py-3">Correct</th>
                    <th className="text-right px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {leaderboard.map((row, i) => {
                    const m = memberById[row.member_id];
                    if (!m) return null;
                    return (
                      <tr key={row.member_id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i === 0 ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                        <td className="px-4 py-3">
                          {i === 0 ? <span className="text-lg">👑</span>
                          : i === 1 ? <Medal className="w-5 h-5 text-gray-400" />
                          : i === 2 ? <Medal className="w-5 h-5 text-orange-400" />
                          : <span className="text-sm font-bold text-gray-400">{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/profile/${m.id}`} className="flex items-center gap-2.5 hover:text-primary-600">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{m.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className="font-bold text-gray-900 dark:text-white">{m.name}</span>
                          </Link>
                        </td>
                        <td className="text-right px-3 py-3 text-gray-600 dark:text-gray-300 tabular-nums">{row.matches}</td>
                        <td className="text-right px-3 py-3 text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">{row.correct}</td>
                        <td className="text-right px-4 py-3 font-black text-lg text-amber-600 dark:text-amber-400 tabular-nums">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RECENT MATCHES PREDICTION SUMMARY */}
        {settledWithPredictions.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              Recent Match Predictions
            </h3>
            <div className="space-y-3">
              {settledWithPredictions.slice(0, 5).map(({ match, predictions }) => {
                const correctWinner = predictions.filter(p => {
                  const actual = match.result === 'won' ? 'scc' : match.result === 'lost' ? 'opponent' : 'draw';
                  return p.winner === actual;
                }).length;
                return (
                  <Link to={`/profile/${memberById[predictions[0]?.member_id]?.id || ''}`} key={match.id}>
                    <div className="rounded-xl p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {fmtDate(match.date)} · {match.result.toUpperCase()}
                        </p>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                          vs {match.opponent || 'TBD'}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          🎰 {predictions.length} predicted · ✓ {correctWinner} got the winner right
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {leaderboard.length === 0 && upcomingMatches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No predictions yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Once an upcoming match is scheduled, members can predict and earn points.
            </p>
          </div>
        )}

        {/* ── ADMIN-ONLY: ALL PREDICTIONS ───────────────────────── */}
        {isAdmin && allPredictions.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-900/10 dark:to-orange-900/5">
            <button
              onClick={() => setAdminViewOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition-colors text-left"
            >
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-700 dark:text-amber-400">
                  Admin View · All Predictions
                </p>
                <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mt-0.5">
                  {allPredictions.length} total prediction{allPredictions.length === 1 ? '' : 's'} across {new Set(allPredictions.map(p => p.match_id)).size} match{new Set(allPredictions.map(p => p.match_id)).size === 1 ? '' : 'es'} · only you can see this
                </p>
              </div>
              {adminViewOpen
                ? <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                : <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              }
            </button>

            {adminViewOpen && (
              <div className="bg-white dark:bg-gray-900 border-t border-amber-200 dark:border-amber-800">
                {(() => {
                  // Group predictions by match, newest match first
                  const matchIds = [...new Set(allPredictions.map(p => p.match_id))];
                  const matchWithPicks = matchIds
                    .map(mid => ({
                      match: matches.find(m => m.id === mid),
                      picks: allPredictions.filter(p => p.match_id === mid),
                    }))
                    .filter(x => x.match)
                    .sort((a, b) => (b.match!.date || '').localeCompare(a.match!.date || ''));

                  return matchWithPicks.map(({ match, picks }) => {
                    if (!match) return null;
                    const isExpanded = expandedMatchId === match.id;
                    const settled = ['won', 'lost', 'draw'].includes(match.result);
                    return (
                      <div key={match.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                        <button
                          onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                            !settled ? 'bg-purple-500'
                            : match.result === 'won' ? 'bg-emerald-500'
                            : match.result === 'lost' ? 'bg-red-500'
                            : 'bg-amber-500'
                          }`}>
                            {!settled ? '?' : match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'D'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {match.match_type === 'internal' ? 'Dhurandars vs Bazigars' : `vs ${match.opponent || 'TBD'}`}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {fmtDate(match.date)} · 🎰 {picks.length} prediction{picks.length === 1 ? '' : 's'}
                              {settled && ` · scored: ${picks.filter(p => p.points_earned !== null).length}/${picks.length}`}
                            </p>
                          </div>
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          }
                        </button>

                        {isExpanded && (
                          <div className="bg-gray-50 dark:bg-gray-800/30 px-4 py-3 space-y-2">
                            {picks
                              .sort((a, b) => (b.points_earned ?? -1) - (a.points_earned ?? -1))
                              .map(p => {
                                const predictor = memberById[p.member_id];
                                if (!predictor) return null;
                                const winnerLabel =
                                  p.winner === 'scc' ? 'SCC'
                                  : p.winner === 'opponent' ? (match.opponent || 'Opponent')
                                  : p.winner === 'draw' ? 'Draw'
                                  : '—';
                                const topScorer = p.top_scorer_id ? memberById[p.top_scorer_id]?.name : null;
                                const topWkt = p.top_wicket_taker_id ? memberById[p.top_wicket_taker_id]?.name : null;
                                const mom = p.mom_id ? memberById[p.mom_id]?.name : null;
                                return (
                                  <div key={p.id} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <Link to={`/profile/${predictor.id}`} className="flex items-center gap-2 hover:text-primary-600">
                                        {predictor.avatar_url ? (
                                          <img src={predictor.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">{predictor.name.charAt(0)}</span>
                                          </div>
                                        )}
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{predictor.name}</span>
                                      </Link>
                                      {p.points_earned !== null ? (
                                        <span className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-full ${
                                          p.points_earned > 0
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                        }`}>
                                          {p.points_earned > 0 ? `+${p.points_earned}` : '0'} pts
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 font-medium">Unscored</span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                      <PickRow label="Winner" value={winnerLabel} />
                                      <PickRow label="Top Scorer" value={topScorer || '—'} />
                                      <PickRow label="Top Wkt" value={topWkt || '—'} />
                                      <PickRow label="MOM" value={mom || '—'} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1.5">
                                      Locked {new Date(p.locked_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

      </div>

      {predictMatch && (
        <PredictMatchModal
          isOpen={!!predictMatch}
          onClose={() => setPredictMatch(null)}
          match={predictMatch}
        />
      )}
    </div>
  );
}

function PickRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 flex-shrink-0">{label}</span>
      <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">{value}</span>
    </div>
  );
}

export default Predictions;
