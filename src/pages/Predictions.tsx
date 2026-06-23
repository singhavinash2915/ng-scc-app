import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Trophy, Target, TrendingUp, ChevronRight, ChevronDown, Sparkles, Medal,
  Eye, EyeOff, Gift, Pencil, Check, X, User, BarChart2, Zap, Star,
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
  const [myMemberId, setMyMemberId] = useState<string>(() =>
    localStorage.getItem('scc-my-prediction-id') || ''
  );

  // ── Prizes (admin-configurable, stored in localStorage) ──
  const PRIZES_KEY = 'scc-prediction-prizes';
  const defaultPrizes = [
    { rank: 1, emoji: '🥇', label: '1st Place', prize: 'Gift Hamper 🎁' },
    { rank: 2, emoji: '🥈', label: '2nd Place', prize: 'Gift Voucher' },
    { rank: 3, emoji: '🥉', label: '3rd Place', prize: 'Surprise Gift' },
  ];
  type Prize = typeof defaultPrizes[0];
  const [prizes, setPrizes] = useState<Prize[]>(() => {
    try { return JSON.parse(localStorage.getItem(PRIZES_KEY) || 'null') || defaultPrizes; }
    catch { return defaultPrizes; }
  });
  const [editingPrize, setEditingPrize] = useState<number | null>(null); // rank being edited
  const [editText, setEditText] = useState('');

  const savePrize = (rank: number, text: string) => {
    const updated = prizes.map(p => p.rank === rank ? { ...p, prize: text } : p);
    setPrizes(updated);
    localStorage.setItem(PRIZES_KEY, JSON.stringify(updated));
    setEditingPrize(null);
  };

  // Auto-score any unscored predictions whose match has settled and has a scorecard
  const [scoring, setScoring] = useState(false);
  const [scoredCount, setScoredCount] = useState<number | null>(null);
  // Scorecards for settled matches with predictions — used to reveal the ACTUAL
  // result (correct answers) alongside each member's picks.
  const [scorecards, setScorecards] = useState<Record<string, MatchScorecard>>({});

  const scoreSettledPredictions = async () => {
    setScoring(true);
    let scoredHere = 0;
    try {
      // Find matches that are settled (won/lost/draw)
      const settledMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
      if (settledMatches.length === 0) { setScoredCount(0); return; }

      // Candidates to score: unscored predictions PLUS predictions that were
      // scored before the scorecard arrived (e.g. when the result syncs first
      // and scorecards come in a later cron run — first-pass scoring would
      // award 0 because top_scorer/top_wkt/MOM had no source data).
      const candidateMatchIds = [...new Set(allPredictions
        .filter(p => settledMatches.some(m => m.id === p.match_id))
        .map(p => p.match_id))];
      if (candidateMatchIds.length === 0) { setScoredCount(0); return; }
      const { data: cards } = await supabase
        .from('match_scorecards')
        .select('*')
        .in('match_id', candidateMatchIds);
      const cardFetchedAt: Record<string, string> = {};
      (cards || []).forEach((c: MatchScorecard & { fetched_at?: string }) => {
        if (c.fetched_at) cardFetchedAt[c.match_id] = c.fetched_at;
      });
      const unscored = allPredictions.filter(p => {
        if (!settledMatches.some(m => m.id === p.match_id)) return false;
        if (p.points_earned === null) return true;
        // Was the scorecard fetched AFTER we scored? → rescore.
        const cf = cardFetchedAt[p.match_id];
        return !!(cf && p.scored_at && new Date(cf).getTime() > new Date(p.scored_at).getTime());
      });
      if (unscored.length === 0) { setScoredCount(0); return; }

      // For each match with predictions to (re)score, the scorecard is already in cards.
      const matchIds = [...new Set(unscored.map(p => p.match_id))];
      void matchIds; // (cards already fetched above)
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
        if (p.score_range && p.score_range === outcome.score_range) points += PREDICTION_POINTS.score_range;
        if (p.fifty_scored && p.fifty_scored === outcome.fifty_scored) points += PREDICTION_POINTS.fifty_scored;
        if (p.three_wicket_haul && p.three_wicket_haul === outcome.three_wicket_haul) points += PREDICTION_POINTS.three_wicket_haul;
        if (p.internal_most_sixes && p.internal_most_sixes === outcome.internal_most_sixes) points += PREDICTION_POINTS.internal_most_sixes;
        if (p.internal_margin && p.internal_margin === outcome.internal_margin) points += PREDICTION_POINTS.internal_margin;
        if (p.internal_milestone && p.internal_milestone === outcome.internal_milestone) points += PREDICTION_POINTS.internal_milestone;
        if (p.internal_highest_team && p.internal_highest_team === outcome.internal_highest_team) points += PREDICTION_POINTS.internal_highest_team;
        if (p.internal_duck && p.internal_duck === outcome.internal_duck) points += PREDICTION_POINTS.internal_duck;
        if (p.int_dhur_top_scorer_id && p.int_dhur_top_scorer_id === outcome.int_dhur_top_scorer_id) points += PREDICTION_POINTS.int_team_top_scorer;
        if (p.int_baz_top_scorer_id && p.int_baz_top_scorer_id === outcome.int_baz_top_scorer_id) points += PREDICTION_POINTS.int_team_top_scorer;
        if (p.int_dhur_top_wicket_id && p.int_dhur_top_wicket_id === outcome.int_dhur_top_wicket_id) points += PREDICTION_POINTS.int_team_top_wicket;
        if (p.int_baz_top_wicket_id && p.int_baz_top_wicket_id === outcome.int_baz_top_wicket_id) points += PREDICTION_POINTS.int_team_top_wicket;

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

  // Auto-trigger scoring once on page load. Runs whenever predictions exist;
  // scoreSettledPredictions is a no-op if nothing's actually unscored or stale.
  useEffect(() => {
    if (matches.length === 0 || allPredictions.length === 0) return;
    scoreSettledPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length, allPredictions.length]);

  // Load scorecards for settled matches that have predictions, so we can show the
  // ACTUAL result (correct answers) next to everyone's picks.
  useEffect(() => {
    if (matches.length === 0 || allPredictions.length === 0) return;
    const settledIds = new Set(matches.filter(m => ['won', 'lost', 'draw'].includes(m.result)).map(m => m.id));
    const ids = [...new Set(allPredictions.map(p => p.match_id))].filter(id => settledIds.has(id));
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('match_scorecards').select('*').in('match_id', ids);
      if (cancelled || !data) return;
      const byId: Record<string, MatchScorecard> = {};
      (data as MatchScorecard[]).forEach(c => { byId[c.match_id] = c; });
      setScorecards(byId);
    })();
    return () => { cancelled = true; };
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

  // ── My Predictions Stats ──────────────────────────────────────────────────
  const myStats = useMemo(() => {
    if (!myMemberId) return null;
    const mine = allPredictions.filter(p => p.member_id === myMemberId);
    if (!mine.length) return null;
    const scored = mine.filter(p => p.points_earned !== null);
    const totalPoints = scored.reduce((s, p) => s + (p.points_earned ?? 0), 0);
    const correct = scored.filter(p => (p.points_earned ?? 0) > 0).length;
    const hitRate = scored.length > 0 ? Math.round((correct / scored.length) * 100) : 0;
    const best = scored.reduce((b, p) => ((p.points_earned ?? 0) > (b.points_earned ?? 0) ? p : b), scored[0]);
    const bestMatch = best ? matches.find(m => m.id === best.match_id) : null;
    // Last 5 settled predictions with match info
    const history = scored
      .sort((a, b) => new Date(b.scored_at!).getTime() - new Date(a.scored_at!).getTime())
      .slice(0, 5)
      .map(p => ({ p, match: matches.find(m => m.id === p.match_id) }))
      .filter(x => x.match);
    return { totalPoints, correct, hitRate, matchesPredicted: mine.length, scoredCount: scored.length, best, bestMatch, history };
  }, [myMemberId, allPredictions, matches]);

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
                Plus bonus questions! Earn up to <span className="font-bold text-amber-300">+55 points</span> per match.
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

        {/* ── SEASON PRIZES ── */}
        <div className="relative overflow-hidden rounded-2xl p-5"
             style={{ background: 'radial-gradient(400px circle at 0% 100%, rgba(251,191,36,0.2), transparent 60%), linear-gradient(135deg, #1a1306 0%, #0f0d1a 100%)' }}>
          <div className="absolute inset-0 rounded-2xl pointer-events-none border border-amber-500/25" />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl" />
          <div className="relative flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <h3 className="text-sm font-black text-amber-300 uppercase tracking-[2px]">Season Prizes</h3>
            <span className="text-[10px] text-amber-400/60 font-medium">Top predictors at season end</span>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
            {prizes.map(p => (
              <div key={p.rank} className={`rounded-xl p-4 border ${
                p.rank === 1 ? 'bg-amber-400/10 border-amber-400/30'
                : p.rank === 2 ? 'bg-gray-400/10 border-gray-400/20'
                : 'bg-orange-400/10 border-orange-400/20'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{p.emoji}</span>
                  {isAdmin && editingPrize !== p.rank && (
                    <button onClick={() => { setEditingPrize(p.rank); setEditText(p.prize); }}
                            className="text-gray-500 hover:text-amber-400 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{p.label}</p>
                {editingPrize === p.rank ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') savePrize(p.rank, editText); if (e.key === 'Escape') setEditingPrize(null); }}
                      className="flex-1 text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white outline-none focus:border-amber-400"
                    />
                    <button onClick={() => savePrize(p.rank, editText)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingPrize(null)} className="text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <p className="text-sm font-black text-white">{p.prize}</p>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <p className="relative text-[10px] text-amber-400/50 mt-3 text-center">
              ✏️ Click the pencil icon on any prize to edit it
            </p>
          )}
        </div>

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

        {/* MY PREDICTIONS STATS */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 px-4 py-3.5 flex items-center gap-2.5 border-b border-gray-200 dark:border-gray-700">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[2px] text-gray-700 dark:text-gray-300 flex-1">My Predictions</p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 space-y-4">
            {/* Member selector */}
            <select
              value={myMemberId}
              onChange={e => {
                setMyMemberId(e.target.value);
                localStorage.setItem('scc-my-prediction-id', e.target.value);
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">— Select your name —</option>
              {members.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            {/* Stats grid */}
            {myMemberId && !myStats && (
              <p className="text-center text-sm text-gray-400 py-4">No predictions yet — predict the next match to get started! 🎯</p>
            )}

            {myStats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: <BarChart2 className="w-4 h-4 text-indigo-400" />, label: 'Total Points', value: `${myStats.totalPoints}`, color: 'text-indigo-600 dark:text-indigo-400' },
                    { icon: <Target className="w-4 h-4 text-emerald-400" />, label: 'Hit Rate', value: `${myStats.hitRate}%`, color: 'text-emerald-600 dark:text-emerald-400' },
                    { icon: <TrendingUp className="w-4 h-4 text-amber-400" />, label: 'Predicted', value: `${myStats.matchesPredicted}`, color: 'text-amber-600 dark:text-amber-400' },
                    { icon: <Zap className="w-4 h-4 text-rose-400" />, label: 'Correct', value: `${myStats.correct}/${myStats.scoredCount}`, color: 'text-rose-600 dark:text-rose-400' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">{s.icon}<span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{s.label}</span></div>
                      <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Best match */}
                {myStats.bestMatch && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-4 py-3 flex items-center gap-3">
                    <Star className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Best Prediction</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                        vs {myStats.bestMatch.opponent} · {fmtDate(myStats.bestMatch.date)}
                      </p>
                    </div>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">+{myStats.best.points_earned}pts</span>
                  </div>
                )}

                {/* Last 5 history */}
                {myStats.history.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-2">Recent Predictions</p>
                    <div className="space-y-1.5">
                      {myStats.history.map(({ p, match }) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${
                            (p.points_earned ?? 0) >= 20 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : (p.points_earned ?? 0) > 0  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {(p.points_earned ?? 0) > 0 ? '+' : '0'}
                          </div>
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">vs {match!.opponent}</span>
                          <span className="text-xs text-gray-400">{fmtDate(match!.date)}</span>
                          <span className={`text-sm font-bold tabular-nums ${(p.points_earned ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                            {(p.points_earned ?? 0) > 0 ? `+${p.points_earned}` : '0'} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

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
                  const actual = match.match_type === 'internal'
                    ? (match.winning_team || 'draw')
                    : match.result === 'won' ? 'scc' : match.result === 'lost' ? 'opponent' : 'draw';
                  return p.winner === actual;
                }).length;
                return (
                  <Link to={`/matches?focus=${match.id}`} key={match.id}>
                    <div className="rounded-xl p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {fmtDate(match.date)} · {match.result.toUpperCase()}
                        </p>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                          {match.match_type === 'internal' ? '🔴 Dhurandars vs Bazigars 🔵' : `vs ${match.opponent || 'TBD'}`}
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

        {/* ── ALL PREDICTIONS (settled matches — visible to everyone) ── */}
        {allPredictions.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setAdminViewOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
            >
              <Trophy className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-[2px] text-gray-700 dark:text-gray-300">
                  Prediction Results
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Who predicted what · revealed after each match
                </p>
              </div>
              {adminViewOpen
                ? <EyeOff className="w-4 h-4 text-gray-400" />
                : <Eye className="w-4 h-4 text-gray-400" />
              }
            </button>

            {adminViewOpen && (
              <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                {(() => {
                  // Only show settled matches so upcoming predictions stay hidden
                  const settledMatchIds = new Set(
                    matches.filter(m => ['won', 'lost', 'draw'].includes(m.result)).map(m => m.id)
                  );
                  const matchIds = [...new Set(allPredictions.map(p => p.match_id))]
                    .filter(id => settledMatchIds.has(id));
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
                    const isInternal = match.match_type === 'internal';
                    // Actual outcome (correct answers) — needs the scorecard
                    const outcome = settled ? deriveOutcome(match, scorecards[match.id] || null, members) : null;
                    const nameOf = (id: string | null | undefined) => (id ? memberById[id]?.name || '—' : '—');
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
                            {/* ACTUAL RESULT — the correct answers, so picks below can be judged */}
                            {outcome && (
                              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 p-3">
                                <p className="text-[10px] font-black uppercase tracking-[2px] text-emerald-700 dark:text-emerald-300 mb-1.5 flex items-center gap-1">
                                  <Trophy className="w-3 h-3" /> Actual Result
                                </p>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                  {isInternal ? (
                                    <>
                                      <PickRow label="Winner" value={teamPickLabel(outcome.winner)} />
                                      <PickRow label="MOM" value={nameOf(outcome.mom_id)} />
                                      <PickRow label="🔴 Top Run" value={nameOf(outcome.int_dhur_top_scorer_id)} />
                                      <PickRow label="🔵 Top Run" value={nameOf(outcome.int_baz_top_scorer_id)} />
                                      <PickRow label="🔴 Top Wkt" value={nameOf(outcome.int_dhur_top_wicket_id)} />
                                      <PickRow label="🔵 Top Wkt" value={nameOf(outcome.int_baz_top_wicket_id)} />
                                      <PickRow label="Most 6s" value={teamPickLabel(outcome.internal_most_sixes)} />
                                      <PickRow label="Margin" value={marginPickLabel(outcome.internal_margin)} />
                                      <PickRow label="Top Knock" value={teamPickLabel(outcome.internal_highest_team)} />
                                      <PickRow label="Any 30+" value={ynLabel(outcome.internal_milestone)} />
                                      <PickRow label="Duck?" value={ynLabel(outcome.internal_duck)} />
                                    </>
                                  ) : (
                                    <>
                                      <PickRow label="Winner" value={
                                        outcome.winner === 'scc' ? 'SCC'
                                        : outcome.winner === 'opponent' ? (match.opponent || 'Opponent')
                                        : 'No Result'
                                      } />
                                      <PickRow label="MOM" value={nameOf(outcome.mom_id)} />
                                      <PickRow label="Top Scorer" value={nameOf(outcome.top_scorer_id)} />
                                      <PickRow label="Top Wkt" value={nameOf(outcome.top_wicket_taker_id)} />
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                            {picks
                              .sort((a, b) => (b.points_earned ?? -1) - (a.points_earned ?? -1))
                              .map(p => {
                                const predictor = memberById[p.member_id];
                                if (!predictor) return null;
                                const winnerLabel =
                                  p.winner === 'scc' ? 'SCC'
                                  : p.winner === 'opponent' ? (match.opponent || 'Opponent')
                                  : p.winner === 'draw' ? 'No Result'
                                  : p.winner === 'dhurandars' ? '🔴 Dhurandars'
                                  : p.winner === 'bazigars' ? '🔵 Bazigars'
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
                                      {isInternal ? (
                                        <>
                                          <PickRow label="Winner" value={winnerLabel} />
                                          <PickRow label="MOM" value={mom || '—'} />
                                          <PickRow label="🔴 Top Run" value={nameOf(p.int_dhur_top_scorer_id)} />
                                          <PickRow label="🔵 Top Run" value={nameOf(p.int_baz_top_scorer_id)} />
                                          <PickRow label="🔴 Top Wkt" value={nameOf(p.int_dhur_top_wicket_id)} />
                                          <PickRow label="🔵 Top Wkt" value={nameOf(p.int_baz_top_wicket_id)} />
                                          <PickRow label="Most 6s" value={teamPickLabel(p.internal_most_sixes)} />
                                          <PickRow label="Margin" value={marginPickLabel(p.internal_margin)} />
                                          <PickRow label="Top Knock" value={teamPickLabel(p.internal_highest_team)} />
                                          <PickRow label="Any 30+" value={ynLabel(p.internal_milestone)} />
                                          <PickRow label="Duck?" value={ynLabel(p.internal_duck)} />
                                        </>
                                      ) : (
                                        <>
                                          <PickRow label="Winner" value={winnerLabel} />
                                          <PickRow label="Top Scorer" value={topScorer || '—'} />
                                          <PickRow label="Top Wkt" value={topWkt || '—'} />
                                          <PickRow label="MOM" value={mom || '—'} />
                                        </>
                                      )}
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

// ── Internal-match label helpers (shared by picks + actual-result display) ──
const teamPickLabel = (t: string | null | undefined): string =>
  t === 'dhurandars' ? '🔴 Dhurandars'
  : t === 'bazigars' ? '🔵 Bazigars'
  : t === 'tie' ? '🤝 Tie'
  : '—';
const marginPickLabel = (m: string | null | undefined): string =>
  m === 'thriller' ? '😮 Thriller'
  : m === 'comfortable' ? '👍 Comfy'
  : m === 'dominant' ? '💪 Dominant'
  : '—';
const ynLabel = (v: string | null | undefined): string =>
  v === 'yes' ? '✅ Yes' : v === 'no' ? '❌ No' : '—';

function PickRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 flex-shrink-0">{label}</span>
      <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">{value}</span>
    </div>
  );
}

export default Predictions;
