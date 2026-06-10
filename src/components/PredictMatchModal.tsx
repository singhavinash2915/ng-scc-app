import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Lock, Crown, Trophy, Zap, TrendingUp, Target, Flame, BarChart2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Input';
import { usePredictions, type PredictionInput, type PredictionWinner } from '../hooks/usePredictions';
import { useMembers } from '../hooks/useMembers';
import type { Match } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

// Predictions stay open until 6 AM on match day (most matches start 7:00 AM+,
// so this gives members a full 30-min buffer to lock in their picks at the
// last minute on match morning).
const PREDICT_LOCK_HOUR = 6; // 06:00 local time on match date

/**
 * Predict-the-match modal.
 *
 * Flow:
 *   1. Pick "Who are you?" — verify with last 4 digits of phone
 *   2. Pick winner, top scorer, top wicket-taker, MOM (SCC members)
 *   3. Submit → locked in, can be updated until cutoff time
 */
export function PredictMatchModal({ isOpen, onClose, match }: Props) {
  const { members } = useMembers();
  const { predictions, submitPrediction } = usePredictions(match.id);

  const [step, setStep] = useState<'pick' | 'verify' | 'predict' | 'done'>('pick');
  const [memberId, setMemberId] = useState<string>('');
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PredictionInput>({
    winner: match.match_type === 'internal' ? 'dhurandars' : 'scc',
    top_scorer_id: null,
    top_wicket_taker_id: null,
    mom_id: null,
    score_range: null,
    fifty_scored: null,
    three_wicket_haul: null,
    internal_most_sixes: null,
    internal_margin: null,
    internal_milestone: null,
    internal_highest_team: null,
    internal_duck: null,
    int_dhur_top_scorer_id: null,
    int_baz_top_scorer_id: null,
    int_dhur_top_wicket_id: null,
    int_baz_top_wicket_id: null,
  });

  // Restore existing prediction when member is picked
  const existing = useMemo(() =>
    predictions.find(p => p.member_id === memberId)
  , [predictions, memberId]);

  useEffect(() => {
    if (existing) {
      setForm({
        winner: (existing.winner as 'scc' | 'opponent' | 'draw') || 'scc',
        top_scorer_id: existing.top_scorer_id,
        top_wicket_taker_id: existing.top_wicket_taker_id,
        mom_id: existing.mom_id,
        score_range: existing.score_range,
        fifty_scored: existing.fifty_scored,
        three_wicket_haul: existing.three_wicket_haul,
        internal_most_sixes: existing.internal_most_sixes,
        internal_margin: existing.internal_margin,
        internal_milestone: existing.internal_milestone,
        internal_highest_team: existing.internal_highest_team,
        internal_duck: existing.internal_duck,
        int_dhur_top_scorer_id: existing.int_dhur_top_scorer_id,
        int_baz_top_scorer_id: existing.int_baz_top_scorer_id,
        int_dhur_top_wicket_id: existing.int_dhur_top_wicket_id,
        int_baz_top_wicket_id: existing.int_baz_top_wicket_id,
      });
    }
  }, [existing]);

  // Predictions lock at 06:00 local time on match day, or whenever the match
  // result is set (whichever comes first).
  const isLocked = useMemo(() => {
    // match.date is an ISO date string like "2026-06-09". Build a Date at 06:00
    // local time on that date.
    const [y, m, d] = match.date.split('-').map(Number);
    const cutoff = new Date(y, (m || 1) - 1, d || 1, PREDICT_LOCK_HOUR, 0, 0);
    return Date.now() > cutoff.getTime() || ['won', 'lost', 'draw'].includes(match.result);
  }, [match]);

  const matchDate = new Date(match.date);
  const isInternal = match.match_type === 'internal';

  const handleReset = () => {
    setStep('pick');
    setMemberId('');
    setPinDigits('');
    setPinError('');
    setForm({ winner: isInternal ? 'dhurandars' : 'scc', top_scorer_id: null, top_wicket_taker_id: null, mom_id: null, score_range: null, fifty_scored: null, three_wicket_haul: null, internal_most_sixes: null, internal_margin: null, internal_milestone: null, internal_highest_team: null, internal_duck: null, int_dhur_top_scorer_id: null, int_baz_top_scorer_id: null, int_dhur_top_wicket_id: null, int_baz_top_wicket_id: null });
  };

  const handleClose = () => { handleReset(); onClose(); };

  const handlePickMember = (id: string) => {
    setMemberId(id);
    const m = members.find(x => x.id === id);
    if (!m) return;
    if (!m.phone || m.phone.replace(/\D/g, '').length < 4) {
      setStep('predict');
    } else {
      setStep('verify');
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const m = members.find(x => x.id === memberId);
    if (!m) return;
    const lastFour = m.phone?.replace(/\D/g, '').slice(-4) || '';
    if (pinDigits !== lastFour) {
      setPinError("That doesn't match the last 4 digits of your phone on file.");
      return;
    }
    setStep('predict');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    setSubmitting(true);
    try {
      await submitPrediction(memberId, match.id, form);
      setStep('done');
    } catch (err) {
      console.error(err);
      alert('Could not save your prediction. The Predictions table might not exist yet — admin needs to run the SQL migration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Eligible SCC members for top-scorer / top-wicket / MOM picks.
  // For internal matches, all selected players are eligible.
  // ⚠️ Self-selection is restricted — members cannot bet on themselves to keep
  // the game honest (and to make predictions more fun).
  const eligibleMembers = useMemo(() => {
    const base = isInternal && match.players
      ? (() => {
          const ids = new Set(match.players!.map(p => p.member_id));
          return members.filter(m => ids.has(m.id));
        })()
      : members.filter(m => m.status === 'active');
    // Exclude the predicting member
    return base.filter(m => m.id !== memberId);
  }, [members, match.players, isInternal, memberId]);

  const memberOptions = useMemo(() => [
    { value: '', label: '— Skip / not sure —' },
    ...eligibleMembers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(m => ({ value: m.id, label: m.name })),
  ], [eligibleMembers]);

  // Per-team options for internal matches. If the squad has been assigned
  // (match.players with a `team` field), filter to that team. Otherwise the
  // squad isn't set yet → fall back to all active members so prediction still works.
  const teamOptions = useMemo(() => {
    const buildFor = (team: 'dhurandars' | 'bazigars') => {
      const assigned = (match.players || []).filter(p => p.team === team).map(p => p.member_id);
      const pool = assigned.length > 0
        ? members.filter(m => assigned.includes(m.id))
        : members.filter(m => m.status === 'active');
      return [
        { value: '', label: '— Skip / not sure —' },
        ...pool
          .filter(m => m.id !== memberId)         // keep the no-self-prediction rule
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(m => ({ value: m.id, label: m.name })),
      ];
    };
    return { dhurandars: buildFor('dhurandars'), bazigars: buildFor('bazigars') };
  }, [members, match.players, memberId]);

  // Aggregate of others' predictions for social signal
  const tally = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of predictions) {
      if (p.winner) t[p.winner] = (t[p.winner] || 0) + 1;
    }
    return t;
  }, [predictions]);

  // Winner options depend on match type
  const winnerOptions: Array<{ value: PredictionWinner; label: string; color: string }> = isInternal
    ? [
        { value: 'dhurandars', label: '🔴 Dhurandars', color: 'text-red-600 dark:text-red-400' },
        { value: 'draw',        label: 'DRAW',           color: 'text-gray-500' },
        { value: 'bazigars',   label: '🔵 Bazigars',    color: 'text-blue-600 dark:text-blue-400' },
      ]
    : [
        { value: 'scc',      label: 'SCC',                                                       color: 'text-emerald-600 dark:text-emerald-400' },
        { value: 'draw',     label: 'DRAW',                                                      color: 'text-gray-500' },
        { value: 'opponent', label: (match.opponent?.split(' ')[0] || 'OPP').toUpperCase(),       color: 'text-red-600 dark:text-red-400' },
      ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Predict the Match" size="lg">

      {/* Closed banner */}
      {isLocked && step !== 'done' && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-center">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1.5" />
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
            Predictions are closed for this match
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Predictions lock at 6:00 AM on match day.
          </p>
        </div>
      )}

      {/* Match context strip */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Next Match</p>
        <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
          {isInternal
            ? 'Dhurandars vs Bazigars'
            : <>SCC vs <span className="text-emerald-600 dark:text-emerald-400">{match.opponent || 'TBD'}</span></>
          }
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          📍 {match.venue} · 🗓️ {matchDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {predictions.length > 0 && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
            🎰 {predictions.length} {predictions.length === 1 ? 'person has' : 'people have'} predicted
          </p>
        )}
      </div>

      {/* STEP 1: pick member */}
      {step === 'pick' && (
        <div className="space-y-4">
          <Select
            label="Who are you?"
            value={memberId}
            onChange={(e) => handlePickMember(e.target.value)}
            options={[
              { value: '', label: '— Select your name —' },
              ...members
                .filter(m => m.status === 'active')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => ({ value: m.id, label: m.name })),
            ]}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pick your name to make predictions for this match. Earn points after the match settles.
          </p>
          {isLocked && (
            <p className="text-xs text-red-500 font-semibold">
              ⚠️ Predictions are closed — you can still view but can't change.
            </p>
          )}
        </div>
      )}

      {/* STEP 2: verify */}
      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Confirm it's really you — enter the <span className="font-bold">last 4 digits of your phone</span>:
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pinDigits}
            onChange={(e) => { setPinDigits(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            className="w-full text-center text-2xl tracking-[10px] font-black py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:border-primary-500"
            required
          />
          {pinError && <p className="text-sm text-red-500 -mt-2 text-center">{pinError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleReset} className="flex-1">Back</Button>
            <Button type="submit" disabled={pinDigits.length !== 4} className="flex-1">Verify</Button>
          </div>
        </form>
      )}

      {/* STEP 3: predictions */}
      {step === 'predict' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {existing && (
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold">
                ✏️ Updating your existing prediction
              </p>
            </div>
          )}

          {/* WINNER */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> Who wins? <span className="text-amber-600">+5 pts</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {winnerOptions.map(opt => {
                const count = tally[opt.value] || 0;
                const isSelected = form.winner === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setForm({ ...form, winner: opt.value })}
                    className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/30'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span className={isSelected ? '' : opt.color}>{opt.label}</span>
                    {count > 0 && (
                      <div className="text-[10px] font-medium text-gray-400 mt-1">{count} picked</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOP SCORER / TOP WICKET — external only (single combined picks) */}
          {!isInternal && (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Top scorer? <span className="text-blue-600">+10 pts</span>
                </label>
                <Select
                  value={form.top_scorer_id || ''}
                  onChange={(e) => setForm({ ...form, top_scorer_id: e.target.value || null })}
                  options={memberOptions}
                  disabled={isLocked}
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Zap className="w-3.5 h-3.5 text-red-500" fill="currentColor" /> Top wicket-taker? <span className="text-red-600">+10 pts</span>
                </label>
                <Select
                  value={form.top_wicket_taker_id || ''}
                  onChange={(e) => setForm({ ...form, top_wicket_taker_id: e.target.value || null })}
                  options={memberOptions}
                  disabled={isLocked}
                />
              </div>
            </>
          )}

          {/* PER-TEAM STARS — internal only */}
          {isInternal && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-3 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-500">⭐ Team Stars</p>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1.5">
                  🦁 Dhurandars top scorer? <span className="text-gray-400 font-normal">+5</span>
                </label>
                <Select value={form.int_dhur_top_scorer_id || ''}
                  onChange={(e) => setForm({ ...form, int_dhur_top_scorer_id: e.target.value || null })}
                  options={teamOptions.dhurandars} disabled={isLocked} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1.5">
                  🐅 Bazigars top scorer? <span className="text-gray-400 font-normal">+5</span>
                </label>
                <Select value={form.int_baz_top_scorer_id || ''}
                  onChange={(e) => setForm({ ...form, int_baz_top_scorer_id: e.target.value || null })}
                  options={teamOptions.bazigars} disabled={isLocked} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1.5">
                  🦁 Dhurandars top wicket-taker? <span className="text-gray-400 font-normal">+5</span>
                </label>
                <Select value={form.int_dhur_top_wicket_id || ''}
                  onChange={(e) => setForm({ ...form, int_dhur_top_wicket_id: e.target.value || null })}
                  options={teamOptions.dhurandars} disabled={isLocked} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1.5">
                  🐅 Bazigars top wicket-taker? <span className="text-gray-400 font-normal">+5</span>
                </label>
                <Select value={form.int_baz_top_wicket_id || ''}
                  onChange={(e) => setForm({ ...form, int_baz_top_wicket_id: e.target.value || null })}
                  options={teamOptions.bazigars} disabled={isLocked} />
              </div>
            </div>
          )}

          {/* MOM */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" /> Man of the Match? <span className="text-amber-600">+5 pts</span>
            </label>
            <Select
              value={form.mom_id || ''}
              onChange={(e) => setForm({ ...form, mom_id: e.target.value || null })}
              options={memberOptions}
              disabled={isLocked}
            />
          </div>

          {/* ── BONUS QUESTIONS ─────────────────────────────────────────── */}
          {!isInternal && (
            <div className="pt-3 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-black uppercase tracking-[2px] text-purple-500 mb-3 flex items-center gap-1.5">
                ⚡ Bonus Questions · Up to +25 pts
              </p>

              {/* SCC TOTAL SCORE RANGE */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <BarChart2 className="w-3.5 h-3.5 text-purple-500" /> SCC Total Score? <span className="text-purple-600">+10 pts</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'under_100', l: 'Under 100' },
                    { v: '100_110',   l: '100 – 110' },
                    { v: '110_125',   l: '110 – 125' },
                    { v: 'over_125',  l: 'Over 125' },
                  ] as const).map(opt => {
                    const sel = form.score_range === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, score_range: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-xs transition-all ${
                          sel
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WILL ANYONE SCORE 50+? */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Target className="w-3.5 h-3.5 text-blue-500" /> Will anyone score 50+? <span className="text-blue-600">+5 pts</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ v: 'yes', l: '✅ Yes' }, { v: 'no', l: '❌ No' }] as const).map(opt => {
                    const sel = form.fifty_scored === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, fifty_scored: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                          sel
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WILL ANYONE TAKE 3+ WICKETS? */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Flame className="w-3.5 h-3.5 text-red-500" fill="currentColor" /> Anyone takes 3+ wickets? <span className="text-red-600">+10 pts</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ v: 'yes', l: '🔥 Yes!' }, { v: 'no', l: '❌ No' }] as const).map(opt => {
                    const sel = form.three_wicket_haul === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, three_wicket_haul: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                          sel
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-2 ring-red-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── INTERNAL RIVALRY BONUS QUESTIONS ─────────────────────────── */}
          {isInternal && (
            <div className="pt-3 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-black uppercase tracking-[2px] text-purple-500 mb-3 flex items-center gap-1.5">
                🔥 Rivalry Bonus · Up to +35 pts
              </p>

              {/* MOST SIXES TEAM */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Flame className="w-3.5 h-3.5 text-orange-500" fill="currentColor" /> Most sixes? <span className="text-orange-600">+10 pts</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'dhurandars', l: '🦁 Dhurandars', c: 'text-red-600 dark:text-red-400' },
                    { v: 'tie',        l: '🤝 Tie',        c: 'text-gray-500' },
                    { v: 'bazigars',   l: '🐅 Bazigars',   c: 'text-blue-600 dark:text-blue-400' },
                  ] as const).map(opt => {
                    const sel = form.internal_most_sixes === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, internal_most_sixes: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-xs transition-all ${
                          sel
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 ring-2 ring-orange-500/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        <span className={sel ? 'text-orange-700 dark:text-orange-300' : opt.c}>{opt.l}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WINNING MARGIN */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Target className="w-3.5 h-3.5 text-purple-500" /> Winning margin? <span className="text-purple-600">+10 pts</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'thriller',    l: '😮 Thriller',  sub: '≤8 runs' },
                    { v: 'comfortable', l: '👍 Comfy',     sub: '9–30' },
                    { v: 'dominant',    l: '💪 Dominant',  sub: '31+' },
                  ] as const).map(opt => {
                    const sel = form.internal_margin === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, internal_margin: sel ? null : opt.v })}
                        className={`p-2 rounded-xl border-2 font-bold text-xs transition-all leading-tight ${
                          sel
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        <div>{opt.l}</div>
                        <div className="text-[9px] font-normal opacity-60 mt-0.5">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ANYONE 30+? */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Will anyone score 30+? <span className="text-blue-600">+5 pts</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ v: 'yes', l: '✅ Yes' }, { v: 'no', l: '❌ No' }] as const).map(opt => {
                    const sel = form.internal_milestone === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, internal_milestone: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                          sel
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HIGHEST INDIVIDUAL SCORE — WHICH TEAM */}
              <div className="mt-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" /> Highest individual score? <span className="text-amber-600">+5 pts</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'dhurandars', l: '🦁 Dhurandars', c: 'text-red-600 dark:text-red-400' },
                    { v: 'tie',        l: '🤝 Tie',        c: 'text-gray-500' },
                    { v: 'bazigars',   l: '🐅 Bazigars',   c: 'text-blue-600 dark:text-blue-400' },
                  ] as const).map(opt => {
                    const sel = form.internal_highest_team === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, internal_highest_team: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-xs transition-all ${
                          sel
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-500/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        <span className={sel ? 'text-amber-700 dark:text-amber-300' : opt.c}>{opt.l}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WILL THERE BE A DUCK? */}
              <div className="mt-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  🦆 Will anyone get a DUCK? <span className="text-emerald-600">+5 pts</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ v: 'yes', l: '🦆 Yes!' }, { v: 'no', l: '🛡️ No' }] as const).map(opt => {
                    const sel = form.internal_duck === opt.v;
                    return (
                      <button key={opt.v} type="button" disabled={isLocked}
                        onClick={() => setForm({ ...form, internal_duck: sel ? null : opt.v })}
                        className={`p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                          sel
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}>
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleReset} className="flex-1">Cancel</Button>
            <Button type="submit" loading={submitting} disabled={isLocked} className="flex-1">
              {existing ? 'Update Prediction' : 'Lock In Prediction'}
            </Button>
          </div>
        </form>
      )}

      {/* STEP 4: done */}
      {step === 'done' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Locked in! 🎰</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Points will be awarded once the match settles. Max possible: <span className="font-bold text-amber-600">+55 pts</span>.
          </p>
          <Button onClick={handleClose} className="mt-4">Done</Button>
        </div>
      )}
    </Modal>
  );
}

export default PredictMatchModal;
