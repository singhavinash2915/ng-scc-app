import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Lock, Crown, Trophy, Zap, TrendingUp } from 'lucide-react';
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

const PREDICT_CLOSE_MINUTES_BEFORE = 30;  // Predictions lock 30 min before match start

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
      });
    }
  }, [existing]);

  // Predictions close N minutes before match
  const isLocked = useMemo(() => {
    const matchDate = new Date(match.date);
    const cutoff = new Date(matchDate.getTime() - PREDICT_CLOSE_MINUTES_BEFORE * 60_000);
    return Date.now() > cutoff.getTime() || ['won', 'lost', 'draw'].includes(match.result);
  }, [match]);

  const matchDate = new Date(match.date);
  const isInternal = match.match_type === 'internal';

  const handleReset = () => {
    setStep('pick');
    setMemberId('');
    setPinDigits('');
    setPinError('');
    setForm({ winner: isInternal ? 'dhurandars' : 'scc', top_scorer_id: null, top_wicket_taker_id: null, mom_id: null });
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

  // Eligible SCC members for top-scorer / top-wicket / MOM picks
  // For internal matches, all selected players are eligible
  const eligibleMembers = useMemo(() => {
    if (isInternal && match.players) {
      const ids = new Set(match.players.map(p => p.member_id));
      return members.filter(m => ids.has(m.id));
    }
    return members.filter(m => m.status === 'active');
  }, [members, match.players, isInternal]);

  const memberOptions = useMemo(() => [
    { value: '', label: '— Skip / not sure —' },
    ...eligibleMembers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(m => ({ value: m.id, label: m.name })),
  ], [eligibleMembers]);

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
            Predictions lock 30 min before match start.
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

          {/* TOP SCORER */}
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

          {/* TOP WICKET-TAKER */}
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
            Points will be awarded once the match settles. Max possible: <span className="font-bold text-amber-600">+30 pts</span>.
          </p>
          <Button onClick={handleClose} className="mt-4">Done</Button>
        </div>
      )}
    </Modal>
  );
}

export default PredictMatchModal;
