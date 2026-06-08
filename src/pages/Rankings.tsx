import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, TrendingUp, Zap, Sparkles, Info, X, Crown, Medal, Award,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useSccRankings, RANKING_CONSTANTS, type RankedPlayer, type RankingMode } from '../hooks/useSccRankings';

type Tab = 'batting' | 'bowling' | 'allrounder';

const MODE_LABELS: { id: RankingMode; label: string }[] = [
  { id: 'all',     label: 'Overall (All-Time)' },
  { id: '2025-26', label: 'Season 2025–26' },
  { id: '2024-25', label: 'Season 2024–25' },
  { id: '2023-24', label: 'Season 2023–24' },
];

const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'batting',    label: 'Batting',     icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'from-blue-500 to-indigo-600' },
  { id: 'bowling',    label: 'Bowling',     icon: <Zap className="w-3.5 h-3.5" />,        color: 'from-rose-500 to-red-600' },
  { id: 'allrounder', label: 'All-Rounder', icon: <Sparkles className="w-3.5 h-3.5" />,   color: 'from-amber-500 to-orange-600' },
];

export function Rankings() {
  const { matches, loading: matchesLoading } = useMatches();
  const { members, loading: membersLoading } = useMembers();
  const { scorecards, loading: scLoading } = useAllScorecards();

  const [mode, setMode] = useState<RankingMode>('all');
  const rankings = useSccRankings(matches, members, scorecards, mode);

  const [tab, setTab] = useState<Tab>('batting');
  const [showInfo, setShowInfo] = useState(false);

  const loading = matchesLoading || membersLoading || scLoading;

  const list: RankedPlayer[] = useMemo(() => {
    if (tab === 'batting') return rankings.batters;
    if (tab === 'bowling') return rankings.bowlers;
    return rankings.allRounders;
  }, [tab, rankings]);

  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 50);

  const modeLabel = MODE_LABELS.find(m => m.id === mode)?.label || 'Overall';

  return (
    <div>
      <Header title="SCC Rankings" subtitle={`ICC-style player ratings · ${modeLabel}`} />

      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">
        {/* ── Title bar with info button ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h1 className="text-base lg:text-lg font-black text-gray-900 dark:text-white">Player Rankings</h1>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400 text-xs font-bold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition"
            title="How are ratings calculated?"
          >
            <Info className="w-3.5 h-3.5" />
            How it works
          </button>
        </div>

        {/* ── Mode selector (Overall / Season) ───────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {MODE_LABELS.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                mode === m.id
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === t.id
                  ? `bg-gradient-to-br ${t.color} text-white shadow-lg`
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <div className="inline-block w-6 h-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mb-3" />
            <p>Calculating ratings from {matches.length} matches…</p>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!loading && list.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700">
            <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">No ranked players yet</p>
            <p className="text-xs text-gray-400 mt-1">
              {tab === 'allrounder'
                ? 'Need players with both batting AND bowling contributions to qualify.'
                : 'Detailed match scorecards must be synced from CricHeroes first.'}
            </p>
          </div>
        )}

        {/* ── Podium (Top 3) ─────────────────────────────────────────────── */}
        {!loading && top3.length > 0 && <Podium top3={top3} tab={tab} />}

        {/* ── Rest of the table (4 onwards) ──────────────────────────────── */}
        {!loading && rest.length > 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {rest.map(p => (
              <RankRow key={p.member.id} player={p} tab={tab} />
            ))}
          </div>
        )}

        {/* ── Bottom note ────────────────────────────────────────────────── */}
        {!loading && list.length > 0 && (
          <p className="text-[11px] text-gray-400 text-center pt-2">
            Ratings normalised 0–1000 · top-rated player = 1000 · recalculated on every page load
          </p>
        )}
      </div>

      <HowItWorksModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}

// ─── Podium component ────────────────────────────────────────────────────
function Podium({ top3, tab }: { top3: RankedPlayer[]; tab: Tab }) {
  const colors = {
    batting:    { 1: 'from-blue-500 to-indigo-600',  2: 'from-blue-400 to-indigo-500', 3: 'from-blue-300 to-indigo-400' },
    bowling:    { 1: 'from-rose-500 to-red-600',     2: 'from-rose-400 to-red-500',    3: 'from-rose-300 to-red-400' },
    allrounder: { 1: 'from-amber-500 to-orange-600', 2: 'from-amber-400 to-orange-500', 3: 'from-amber-300 to-orange-400' },
  };
  return (
    <div className="space-y-3">
      {/* Champion */}
      {top3[0] && <ChampionCard player={top3[0]} gradient={colors[tab][1]} tab={tab} />}
      {/* Silver + Bronze side by side */}
      {(top3[1] || top3[2]) && (
        <div className="grid grid-cols-2 gap-3">
          {top3[1] && <RunnerUpCard player={top3[1]} gradient={colors[tab][2]} icon={<Medal className="w-4 h-4" />} />}
          {top3[2] && <RunnerUpCard player={top3[2]} gradient={colors[tab][3]} icon={<Award className="w-4 h-4" />} />}
        </div>
      )}
    </div>
  );
}

function ChampionCard({ player, gradient, tab }: { player: RankedPlayer; gradient: string; tab: Tab }) {
  return (
    <Link to={`/profile/${player.member.id}`} className="block">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 shadow-2xl`}>
        <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute top-3 right-3">
          <Crown className="w-5 h-5 text-yellow-300" fill="currentColor" />
        </div>
        <div className="relative flex items-center gap-4">
          {player.member.avatar_url ? (
            <img src={player.member.avatar_url} alt={player.member.name}
                 className="w-20 h-20 rounded-2xl object-cover border-3 border-white/40 shadow-xl flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-white">{player.member.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[10px] font-black uppercase tracking-[2px]">Rank #1 · {tab === 'batting' ? 'Batter' : tab === 'bowling' ? 'Bowler' : 'All-Rounder'}</p>
            <h3 className="text-white text-xl font-black truncate">{player.member.name}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-white">{player.rating}</span>
              <span className="text-white/60 text-xs">/ 1000</span>
            </div>
            <p className="text-white/50 text-[10px] mt-1">{player.matchesCounted} matches counted</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RunnerUpCard({ player, gradient, icon }: { player: RankedPlayer; gradient: string; icon: React.ReactNode }) {
  return (
    <Link to={`/profile/${player.member.id}`} className="block">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-3.5 shadow-lg`}>
        <div className="absolute top-2 right-2 text-white">{icon}</div>
        <div className="flex flex-col items-center text-center gap-1">
          {player.member.avatar_url ? (
            <img src={player.member.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-white/40" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-lg font-black text-white">{player.member.name.charAt(0)}</span>
            </div>
          )}
          <p className="text-white text-[10px] font-black uppercase tracking-wider">#{player.rank}</p>
          <p className="text-white text-sm font-bold truncate w-full leading-tight">{player.member.name.split(' ')[0]}</p>
          <p className="text-2xl font-black text-white tabular-nums leading-none">{player.rating}</p>
        </div>
      </div>
    </Link>
  );
}

function RankRow({ player, tab }: { player: RankedPlayer; tab: Tab }) {
  const sub = tab === 'batting' ? `Bat ${player.battingTotal}`
            : tab === 'bowling' ? `Bowl ${player.bowlingTotal}`
            : `Bat ${player.battingTotal} · Bowl ${player.bowlingTotal}`;
  return (
    <Link to={`/profile/${player.member.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-800">
        <span className="w-6 text-center text-xs font-black text-gray-400 flex-shrink-0">{player.rank}</span>
        {player.member.avatar_url ? (
          <img src={player.member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{player.member.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{player.member.name}</p>
          <p className="text-[10px] text-gray-500 truncate">{sub} · {player.matchesCounted} matches{player.momBonus ? ` · ⭐${Math.round((player.momBonus || 0) / 50)} MOM` : ''}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-black text-gray-900 dark:text-white tabular-nums">{player.rating}</p>
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">rating</p>
        </div>
      </div>
    </Link>
  );
}

// ─── How-it-works modal ───────────────────────────────────────────────────
function HowItWorksModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const c = RANKING_CONSTANTS;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How SCC Rankings Work" size="lg">
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5">
          <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-300">
            <strong>ICC-style weighted rating.</strong> Each player earns points from every match — adjusted for opposition quality and win/loss. Final rating normalised 0–1000.
          </p>
        </div>

        <Section icon="🌐" title="Overall vs Season views">
          <Bullet><strong>Overall (All-Time)</strong>: includes every external match SCC has ever played, with recent matches weighted more heavily (time decay).</Bullet>
          <Bullet><strong>Season 2025–26 / 2024–25 / 2023–24</strong>: only includes matches in that season's window (Oct → Sep). Time decay is OFF so every match counts equally — a fair summary of who actually performed that season.</Bullet>
        </Section>

        <Section icon="🏏" title="Batting Points (per innings)">
          <Bullet>Base = runs scored</Bullet>
          <Bullet>+{c.FIFTY_BONUS} bonus for 50–99</Bullet>
          <Bullet>+{c.HUNDRED_BONUS} bonus for 100+</Bullet>
          <Bullet>Strike-rate multiplier ({c.SR_MIN}× to {c.SR_MAX}×) based on SR ÷ 100</Bullet>
          <Bullet>+{c.NOT_OUT_BONUS} not-out bonus</Bullet>
          <Bullet>−{c.DUCK_PENALTY} duck penalty</Bullet>
        </Section>

        <Section icon="⚡" title="Bowling Points (per innings)">
          <Bullet>{c.WICKET_POINTS} × wickets taken</Bullet>
          <Bullet>+{c.THREE_FOR_BONUS} bonus for 3–4 wickets</Bullet>
          <Bullet>+{c.FIVE_FOR_BONUS} bonus for 5+ wickets</Bullet>
          <Bullet>Economy multiplier ({c.ECO_MIN}× to {c.ECO_MAX}×) — better econ = bigger boost</Bullet>
          <Bullet>+{c.MAIDEN_BONUS} per maiden over</Bullet>
        </Section>

        <Section icon="🧤" title="Fielding & MOM">
          <Bullet>+{c.CATCH_POINTS} per catch</Bullet>
          <Bullet>+{c.STUMPING_POINTS} per stumping</Bullet>
          <Bullet>+{c.RUN_OUT_POINTS} per run-out assist</Bullet>
          <Bullet>+{c.MOM_BONUS} bonus if Man of the Match in that game</Bullet>
        </Section>

        <Section icon="🎯" title="Opposition Quality Multiplier">
          <Bullet>×{c.OPP_STRONG_MULT.toFixed(2)} vs strong opponents (beat SCC ≥ 50% of the time)</Bullet>
          <Bullet>×{c.OPP_AVERAGE_MULT.toFixed(2)} vs average opponents</Bullet>
          <Bullet>×{c.OPP_WEAK_MULT.toFixed(2)} vs weaker opponents (beat SCC &lt; 25% of the time)</Bullet>
        </Section>

        <Section icon="🏆" title="Match Result Modifier">
          <Bullet>×{c.WIN_MULT.toFixed(2)} when SCC wins</Bullet>
          <Bullet>×{c.DRAW_MULT.toFixed(2)} for draw / no result</Bullet>
          <Bullet>×{c.LOSS_MULT.toFixed(2)} when SCC loses</Bullet>
        </Section>

        <Section icon="⏳" title="Time Decay (Overall mode only)">
          {c.TIME_DECAY_STEPS.map((s, i) => (
            <Bullet key={i}>
              {i === 0 ? '0' : c.TIME_DECAY_STEPS[i - 1].days + '+'}–{s.days} days: ×{s.mult.toFixed(2)}
            </Bullet>
          ))}
          <Bullet>365+ days: ×{c.TIME_DECAY_OLD.toFixed(2)}</Bullet>
          <Bullet><strong>Season views</strong>: time decay is disabled — every match in the chosen season counts equally so the ranking is a fair summary, not just recent-form-driven.</Bullet>
        </Section>

        <Section icon="🌟" title="All-Rounder Qualification">
          <Bullet>Must have ≥ {c.ALL_ROUNDER_MIN_PER_DISCIPLINE} weighted points in BOTH batting and bowling</Bullet>
          <Bullet>Rating = geometric mean of bat + bowl totals (favours balance over extreme one-sided stats)</Bullet>
        </Section>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3.5">
          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong>Final rating</strong> = sum of (match points × opposition × result × time-decay) for every external match a player participated in. Internal matches (Dhurandars vs Bazigars) are excluded so the rating measures performance against real opposition.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="w-4 h-4" /> Got it
        </button>
      </div>
    </Modal>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2 mb-1.5">
        <span>{icon}</span>{title}
      </h3>
      <ul className="space-y-0.5 pl-4">{children}</ul>
    </div>
  );
}
function Bullet({ children }: { children: React.ReactNode }) {
  return <li className="text-xs text-gray-600 dark:text-gray-400 list-disc">{children}</li>;
}
