import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gavel, Lock, Crown, RotateCcw,
  CheckCircle2, X, Users, Sparkles,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';
import type { Member } from '../types';

type Team = 'dhurandars' | 'bazigars';
type Step = 'setup' | 'auction' | 'done';

interface Pick {
  memberId: string;
  team: Team | null;   // null = unsold
  price: number;
}

interface Config {
  matchDate: string;
  matchVenue: string;
  dhurCaptainId: string;
  bazCaptainId: string;
  poolOrder: string[];     // shuffled member IDs
  budgetEach: number;
  basePrice: number;
  bidIncrement: number;
}

const STORAGE_KEY = 'scc-auction-state';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TEAM_NAMES: Record<Team, string> = {
  dhurandars: 'Dhurandars',
  bazigars: 'Bazigars',
};
const TEAM_EMOJI: Record<Team, string> = {
  dhurandars: '🦁',
  bazigars: '🐅',
};
const TEAM_GRADIENT: Record<Team, string> = {
  dhurandars: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)',
  bazigars:   'linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)',
};
const TEAM_BORDER: Record<Team, string> = {
  dhurandars: 'rgba(59,130,246,0.4)',
  bazigars:   'rgba(168,85,247,0.4)',
};
const TEAM_ACCENT: Record<Team, string> = {
  dhurandars: 'text-blue-300',
  bazigars:   'text-purple-300',
};

export function Auction() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const { matches, addMatch } = useMatches();
  const { stats: cricketStats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();
  const { isActive } = useMemberActivity(members, matches);

  const [step, setStep] = useState<Step>('setup');
  const [config, setConfig] = useState<Config>({
    matchDate: new Date().toISOString().split('T')[0],
    matchVenue: 'Four Star Cricket Ground',
    dhurCaptainId: '',
    bazCaptainId: '',
    poolOrder: [],
    budgetEach: 10000,
    basePrice: 100,
    bidIncrement: 50,
  });
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentBidder, setCurrentBidder] = useState<Team | null>(null);
  const [poolSelected, setPoolSelected] = useState<string[]>([]);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);

  // Restore from localStorage so accidental refresh doesn't lose progress
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.step && s.config) {
        setStep(s.step);
        setConfig(s.config);
        setPicks(s.picks || []);
        setCurrentIdx(s.currentIdx || 0);
        setCurrentBid(s.currentBid || 0);
        setCurrentBidder(s.currentBidder || null);
      }
    } catch {/* ignore */}
  }, []);

  // Persist state
  useEffect(() => {
    if (step === 'setup' && picks.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      step, config, picks, currentIdx, currentBid, currentBidder,
    }));
  }, [step, config, picks, currentIdx, currentBid, currentBidder]);

  const memberById = useMemo(() => {
    const m: Record<string, Member> = {};
    members.forEach(x => { m[x.id] = x; });
    return m;
  }, [members]);

  const dhurCaptain = config.dhurCaptainId ? memberById[config.dhurCaptainId] : null;
  const bazCaptain = config.bazCaptainId ? memberById[config.bazCaptainId] : null;

  const eligibleMembers = useMemo(() => {
    return members
      .filter(m => m.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  // ── Default pool: all active EXCEPT captains ─────────────────────────
  useEffect(() => {
    if (poolSelected.length === 0) {
      const defaults = members
        .filter(m => isActive(m.id))
        .map(m => m.id);
      setPoolSelected(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  // ── Stats helpers ────────────────────────────────────────────────────
  const getStats = (memberId: string) => cricketStats.find(s => s.member_id === memberId);
  const getMOM = (memberId: string) => momCounts[memberId] || 0;

  // ── SETUP ────────────────────────────────────────────────────────────
  const togglePool = (id: string) => {
    setPoolSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const startAuction = () => {
    if (!config.dhurCaptainId || !config.bazCaptainId) {
      alert('Please select captains for both teams');
      return;
    }
    if (config.dhurCaptainId === config.bazCaptainId) {
      alert('Captains must be different members');
      return;
    }
    // Pool: selected members excluding the two captains
    const pool = poolSelected.filter(id => id !== config.dhurCaptainId && id !== config.bazCaptainId);
    if (pool.length < 2) {
      alert('Pool must have at least 2 players');
      return;
    }
    setConfig(c => ({ ...c, poolOrder: shuffle(pool) }));
    setPicks([]);
    setCurrentIdx(0);
    setCurrentBid(config.basePrice);
    setCurrentBidder(null);
    setStep('auction');
  };

  // ── AUCTION ──────────────────────────────────────────────────────────
  const dhurPicks = picks.filter(p => p.team === 'dhurandars');
  const bazPicks = picks.filter(p => p.team === 'bazigars');
  const dhurSpent = dhurPicks.reduce((s, p) => s + p.price, 0);
  const bazSpent = bazPicks.reduce((s, p) => s + p.price, 0);
  const dhurBudget = config.budgetEach - dhurSpent;
  const bazBudget = config.budgetEach - bazSpent;
  const dhurCanBid = dhurBudget >= currentBid + config.bidIncrement;
  const bazCanBid = bazBudget >= currentBid + config.bidIncrement;

  const currentPlayerId = config.poolOrder[currentIdx];
  const currentPlayer = currentPlayerId ? memberById[currentPlayerId] : null;
  const totalToAuction = config.poolOrder.length;
  const remainingToAuction = totalToAuction - currentIdx;

  const placeBid = (team: Team) => {
    const newBid = currentBid + config.bidIncrement;
    const budget = team === 'dhurandars' ? dhurBudget : bazBudget;
    if (newBid > budget) return;
    setCurrentBid(newBid);
    setCurrentBidder(team);
  };

  const markSold = () => {
    if (!currentBidder || !currentPlayerId) return;
    setPicks(p => [...p, { memberId: currentPlayerId, team: currentBidder, price: currentBid }]);
    advance();
  };

  const markUnsold = () => {
    if (!currentPlayerId) return;
    setPicks(p => [...p, { memberId: currentPlayerId, team: null, price: 0 }]);
    advance();
  };

  const advance = () => {
    if (currentIdx + 1 >= totalToAuction) {
      setStep('done');
    } else {
      setCurrentIdx(i => i + 1);
      setCurrentBid(config.basePrice);
      setCurrentBidder(null);
    }
  };

  // ── DONE ─────────────────────────────────────────────────────────────
  const dhurFinalRoster = useMemo(() => {
    const ids = [config.dhurCaptainId, ...picks.filter(p => p.team === 'dhurandars').map(p => p.memberId)];
    return ids.filter(Boolean);
  }, [config.dhurCaptainId, picks]);

  const bazFinalRoster = useMemo(() => {
    const ids = [config.bazCaptainId, ...picks.filter(p => p.team === 'bazigars').map(p => p.memberId)];
    return ids.filter(Boolean);
  }, [config.bazCaptainId, picks]);

  const createInternalMatch = async () => {
    setCreatingMatch(true);
    try {
      const playerTeams: Record<string, Team> = {};
      dhurFinalRoster.forEach(id => { playerTeams[id] = 'dhurandars'; });
      bazFinalRoster.forEach(id => { playerTeams[id] = 'bazigars'; });
      const playerIds = [...dhurFinalRoster, ...bazFinalRoster];

      const data = await addMatch(
        {
          date: config.matchDate,
          venue: config.matchVenue,
          opponent: 'Sangria Dhurandars vs Sangria Bazigars',
          result: 'upcoming',
          our_score: null,
          opponent_score: null,
          match_fee: 0,
          ground_cost: 0,
          other_expenses: 0,
          deduct_from_balance: false,
          notes: `Internal match · auction-built. Spent: Dhurandars ₹${dhurSpent}, Bazigars ₹${bazSpent}`,
          man_of_match_id: null,
          match_type: 'internal',
          winning_team: null,
          polling_enabled: false,
          polling_deadline: null,
          captain_id: config.dhurCaptainId,
          vice_captain_id: config.bazCaptainId,
        },
        playerIds,
        playerTeams,
      );

      setSavedMatchId(data?.id || 'saved');
      // Clear localStorage now that we've saved
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
      alert('Failed to save match. Try again.');
    } finally {
      setCreatingMatch(false);
    }
  };

  const fullReset = () => {
    if (!confirm('Discard the entire auction and start over?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setStep('setup');
    setPicks([]);
    setCurrentIdx(0);
    setCurrentBid(0);
    setCurrentBidder(null);
    setSavedMatchId(null);
  };

  // ── ADMIN CHECK ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div>
        <Header title="Auction" subtitle="Admin only" />
        <div className="p-8 max-w-md mx-auto mt-12">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-900">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Admin access required
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Only admins can run an auction. Log in from the sidebar to start.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────────────
  return (
    <div>
      <Header title="Internal Match Auction" subtitle="IPL-style team building for Dhurandars vs Bazigars" />

      <div className="p-4 lg:p-8 space-y-5 max-w-6xl mx-auto">

        {/* ── STEP 1: SETUP ────────────────────────────────────────────── */}
        {step === 'setup' && (
          <>
            <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 shadow-xl"
                 style={{ background: 'radial-gradient(600px circle at 0% 0%, rgba(168,85,247,0.3), transparent 50%), radial-gradient(400px circle at 100% 100%, rgba(59,130,246,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #0a1019 100%)' }}>
              <div className="absolute inset-0 border border-purple-500/30 rounded-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-purple-400/15 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-400/20 border-2 border-purple-400/40 flex items-center justify-center flex-shrink-0">
                  <Gavel className="w-7 h-7 text-purple-300" />
                </div>
                <div>
                  <h2 className="text-2xl lg:text-3xl font-black text-white">Auction Setup</h2>
                  <p className="text-purple-200/70 text-sm mt-0.5">Configure captains, pool, and budget</p>
                </div>
              </div>
            </div>

            {/* Match details */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">Match Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Match Date"
                  type="date"
                  value={config.matchDate}
                  onChange={e => setConfig(c => ({ ...c, matchDate: e.target.value }))}
                />
                <Input
                  label="Venue"
                  value={config.matchVenue}
                  onChange={e => setConfig(c => ({ ...c, matchVenue: e.target.value }))}
                />
              </div>
            </div>

            {/* Captains */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">Pick Captains</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1.5 flex items-center gap-1">
                    🦁 Dhurandars Captain
                  </label>
                  <select
                    value={config.dhurCaptainId}
                    onChange={e => setConfig(c => ({ ...c, dhurCaptainId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">— Select —</option>
                    {eligibleMembers.filter(m => m.id !== config.bazCaptainId).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-1.5 flex items-center gap-1">
                    🐅 Bazigars Captain
                  </label>
                  <select
                    value={config.bazCaptainId}
                    onChange={e => setConfig(c => ({ ...c, bazCaptainId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">— Select —</option>
                    {eligibleMembers.filter(m => m.id !== config.dhurCaptainId).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Budget + bid params */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">Budget & Bidding</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Budget per team (₹)"
                  type="number"
                  value={config.budgetEach}
                  onChange={e => setConfig(c => ({ ...c, budgetEach: parseInt(e.target.value) || 0 }))}
                />
                <Input
                  label="Base price (₹)"
                  type="number"
                  value={config.basePrice}
                  onChange={e => setConfig(c => ({ ...c, basePrice: parseInt(e.target.value) || 0 }))}
                />
                <Input
                  label="Bid increment (₹)"
                  type="number"
                  value={config.bidIncrement}
                  onChange={e => setConfig(c => ({ ...c, bidIncrement: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Pool selection */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">
                  Pool ({poolSelected.filter(id => id !== config.dhurCaptainId && id !== config.bazCaptainId).length} players)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPoolSelected(members.filter(m => isActive(m.id)).map(m => m.id))}
                    className="text-xs text-primary-500 font-semibold hover:text-primary-600"
                  >
                    All Active
                  </button>
                  <button
                    onClick={() => setPoolSelected(members.map(m => m.id))}
                    className="text-xs text-primary-500 font-semibold hover:text-primary-600"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPoolSelected([])}
                    className="text-xs text-red-500 font-semibold hover:text-red-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-1.5 p-1">
                {eligibleMembers.map(m => {
                  const isCaptain = m.id === config.dhurCaptainId || m.id === config.bazCaptainId;
                  const selected = poolSelected.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isCaptain}
                      onClick={() => togglePool(m.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-all ${
                        isCaptain
                          ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 opacity-50 cursor-not-allowed'
                          : selected
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/40'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-white">{m.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="flex-1 truncate text-xs">{m.name.split(' ')[0]}</span>
                      {isCaptain && <Crown className="w-3 h-3 flex-shrink-0" fill="currentColor" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={startAuction} className="w-full !py-3.5 text-base">
              <Gavel className="w-5 h-5 mr-2" />
              Start Auction
            </Button>
          </>
        )}

        {/* ── STEP 2: AUCTION ──────────────────────────────────────────── */}
        {step === 'auction' && currentPlayer && (
          <>
            {/* Progress */}
            <div className="flex items-center justify-between rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-2.5">
              <span className="text-xs font-bold text-gray-500">
                Player {currentIdx + 1} of {totalToAuction}
              </span>
              <span className="text-xs text-gray-400">
                {remainingToAuction} remaining · {picks.filter(p => p.team).length} sold · {picks.filter(p => !p.team).length} unsold
              </span>
              <button onClick={fullReset} className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / totalToAuction) * 100}%` }}
              />
            </div>

            {/* Current Player Card */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl"
                 style={{ background: currentBidder
                   ? `radial-gradient(600px circle at 50% 0%, ${currentBidder === 'dhurandars' ? 'rgba(59,130,246,0.4)' : 'rgba(168,85,247,0.4)'}, transparent 50%), linear-gradient(135deg, #0a0e1f 0%, #0a1019 100%)`
                   : 'radial-gradient(600px circle at 50% 0%, rgba(251,191,36,0.25), transparent 50%), linear-gradient(135deg, #1a0f05 0%, #0a1019 100%)'
                 }}>
              <div className="absolute inset-0 border border-amber-500/30 rounded-3xl pointer-events-none" />
              <div className="relative p-6 lg:p-8 text-center">
                <p className="text-amber-300/70 text-[10px] font-bold uppercase tracking-[3px]">On the block</p>
                <div className="mt-4 flex justify-center">
                  {currentPlayer.avatar_url ? (
                    <img src={currentPlayer.avatar_url} alt="" className="w-28 h-28 lg:w-32 lg:h-32 rounded-3xl object-cover border-[3px] border-amber-400/50 shadow-2xl shadow-amber-500/40" />
                  ) : (
                    <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-600 border-[3px] border-amber-400/50 flex items-center justify-center shadow-2xl shadow-amber-500/40">
                      <span className="text-5xl font-black text-yellow-950">{currentPlayer.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-white mt-4 tracking-tight">{currentPlayer.name}</h2>
                {currentPlayer.role && (
                  <p className="text-amber-200/80 text-sm mt-1 font-semibold">
                    {currentPlayer.role.replace('_', '-')}
                    {currentPlayer.jersey_number != null && ` · #${currentPlayer.jersey_number}`}
                  </p>
                )}

                {/* Stats strip */}
                {(() => {
                  const s = getStats(currentPlayer.id);
                  const moms = getMOM(currentPlayer.id);
                  if (!s && moms === 0) return null;
                  return (
                    <div className="flex items-center justify-center gap-4 mt-5 text-white/80">
                      {s && s.batting_runs > 0 && (
                        <div className="text-center">
                          <p className="text-xl font-black tabular-nums">{s.batting_runs}</p>
                          <p className="text-[10px] uppercase tracking-widest text-white/40">runs</p>
                        </div>
                      )}
                      {s && s.bowling_wickets > 0 && (
                        <div className="text-center">
                          <p className="text-xl font-black tabular-nums">{s.bowling_wickets}</p>
                          <p className="text-[10px] uppercase tracking-widest text-white/40">wkts</p>
                        </div>
                      )}
                      {moms > 0 && (
                        <div className="text-center">
                          <p className="text-xl font-black tabular-nums">👑 {moms}</p>
                          <p className="text-[10px] uppercase tracking-widest text-white/40">MOMs</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Current bid */}
                <div className="mt-7 pt-5 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-[2px] text-white/50">Current Bid</p>
                  <p className="text-5xl lg:text-6xl font-black text-white tabular-nums mt-1"
                     style={{ background: 'linear-gradient(180deg, #fff 30%, #fde68a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ₹{currentBid.toLocaleString('en-IN')}
                  </p>
                  {currentBidder && (
                    <p className={`text-sm font-bold mt-2 ${TEAM_ACCENT[currentBidder]}`}>
                      {TEAM_EMOJI[currentBidder]} {TEAM_NAMES[currentBidder]} bid
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bid actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => placeBid('dhurandars')}
                disabled={!dhurCanBid}
                className={`relative p-4 rounded-2xl text-white font-bold transition-all ${
                  dhurCanBid
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-lg shadow-blue-500/30 active:scale-95'
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="text-2xl">🦁</div>
                <div className="text-xs uppercase tracking-widest mt-1 opacity-80">Dhurandars Bid</div>
                <div className="text-lg font-black tabular-nums">+₹{config.bidIncrement}</div>
              </button>
              <button
                onClick={() => placeBid('bazigars')}
                disabled={!bazCanBid}
                className={`relative p-4 rounded-2xl text-white font-bold transition-all ${
                  bazCanBid
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 shadow-lg shadow-purple-500/30 active:scale-95'
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="text-2xl">🐅</div>
                <div className="text-xs uppercase tracking-widest mt-1 opacity-80">Bazigars Bid</div>
                <div className="text-lg font-black tabular-nums">+₹{config.bidIncrement}</div>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={markSold} disabled={!currentBidder} className="!py-3 !bg-emerald-500 hover:!bg-emerald-600">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                SOLD {currentBidder ? `to ${TEAM_NAMES[currentBidder]}` : ''}
              </Button>
              <Button onClick={markUnsold} variant="secondary" className="!py-3">
                <X className="w-4 h-4 mr-1.5" />
                Unsold / Skip
              </Button>
            </div>

            {/* Team stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['dhurandars', 'bazigars'] as Team[]).map(team => {
                const teamPicks = team === 'dhurandars' ? dhurPicks : bazPicks;
                const captain = team === 'dhurandars' ? dhurCaptain : bazCaptain;
                const budget = team === 'dhurandars' ? dhurBudget : bazBudget;
                const spent = team === 'dhurandars' ? dhurSpent : bazSpent;
                const used = (spent / config.budgetEach) * 100;
                return (
                  <div key={team} className="relative overflow-hidden rounded-2xl p-4"
                       style={{ background: TEAM_GRADIENT[team] }}>
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                         style={{ border: `1px solid ${TEAM_BORDER[team]}` }} />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{TEAM_EMOJI[team]}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-[1.5px] ${TEAM_ACCENT[team]}`}>
                          {TEAM_NAMES[team]}
                        </span>
                      </div>
                      {captain && (
                        <p className="text-xs text-white/70 mt-1">
                          <Crown className="w-3 h-3 inline mr-1" fill="currentColor" />
                          {captain.name}
                        </p>
                      )}
                      <div className="mt-3 flex items-baseline justify-between">
                        <p className="text-2xl font-black text-white tabular-nums">₹{budget.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-white/50 font-semibold">{teamPicks.length + 1} players</p>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${team === 'dhurandars' ? 'bg-blue-400' : 'bg-purple-400'}`}
                             style={{ width: `${used}%` }} />
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Spent ₹{spent.toLocaleString('en-IN')} ({used.toFixed(0)}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Already sold list */}
            {picks.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                <p className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-2">Auction Log</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {[...picks].reverse().map((p, idx) => {
                    const m = memberById[p.memberId];
                    if (!m) return null;
                    return (
                      <div key={`${p.memberId}-${idx}`} className="flex items-center gap-2 text-xs">
                        {p.team ? (
                          <span className={`w-1.5 h-1.5 rounded-full ${p.team === 'dhurandars' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        )}
                        <span className="font-bold text-gray-700 dark:text-gray-300 flex-1 truncate">{m.name}</span>
                        {p.team ? (
                          <span className={`font-black ${p.team === 'dhurandars' ? 'text-blue-600' : 'text-purple-600'}`}>
                            ₹{p.price.toLocaleString('en-IN')} → {TEAM_NAMES[p.team]}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-semibold">Unsold</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 3: DONE ─────────────────────────────────────────────── */}
        {step === 'done' && (
          <>
            <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 shadow-xl text-center"
                 style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(34,197,94,0.3), transparent 50%), linear-gradient(135deg, #064e3b 0%, #0a1019 100%)' }}>
              <div className="absolute inset-0 border border-emerald-500/30 rounded-3xl pointer-events-none" />
              <div className="text-6xl mb-3">🏆</div>
              <h2 className="text-2xl lg:text-3xl font-black text-white">Auction Complete!</h2>
              <p className="text-emerald-200/70 text-sm mt-1">{config.poolOrder.length} players auctioned · {picks.filter(p => p.team).length} sold · {picks.filter(p => !p.team).length} unsold</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(['dhurandars', 'bazigars'] as Team[]).map(team => {
                const captain = team === 'dhurandars' ? dhurCaptain : bazCaptain;
                const teamPicks = team === 'dhurandars' ? dhurPicks : bazPicks;
                const spent = team === 'dhurandars' ? dhurSpent : bazSpent;
                return (
                  <div key={team} className="relative overflow-hidden rounded-2xl p-5"
                       style={{ background: TEAM_GRADIENT[team] }}>
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                         style={{ border: `1px solid ${TEAM_BORDER[team]}` }} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <span className="text-2xl">{TEAM_EMOJI[team]}</span>
                          {TEAM_NAMES[team]}
                        </h3>
                        <span className="text-xs text-white/60">{teamPicks.length + 1} players · ₹{spent.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="space-y-1.5">
                        {captain && (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30">
                            <Crown className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" fill="currentColor" />
                            <span className="text-sm font-bold text-white truncate flex-1">{captain.name}</span>
                            <span className="text-[10px] text-amber-300 font-bold">CAPTAIN</span>
                          </div>
                        )}
                        {teamPicks.map(p => {
                          const m = memberById[p.memberId];
                          if (!m) return null;
                          return (
                            <div key={p.memberId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
                              <Users className="w-3 h-3 text-white/40 flex-shrink-0" />
                              <span className="text-sm text-white truncate flex-1">{m.name}</span>
                              <span className="text-xs font-black text-white/70 tabular-nums">₹{p.price}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {savedMatchId ? (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 p-5 bg-emerald-50 dark:bg-emerald-900/20 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300">Internal match created!</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Both rosters are saved with team assignments + captains.</p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button onClick={() => navigate('/matches')}>View on Matches page</Button>
                  <Button variant="secondary" onClick={fullReset}>New Auction</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button onClick={createInternalMatch} loading={creatingMatch} className="!py-3 text-base">
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Save as Internal Match
                </Button>
                <Button variant="secondary" onClick={fullReset} className="!py-3">
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Discard & New Auction
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default Auction;
