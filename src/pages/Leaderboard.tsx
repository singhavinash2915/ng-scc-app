import { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Target,
  Zap,
  Shield,
  TrendingUp,
  Medal,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Star,
  Crown,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useFormGuide, type FormResult } from '../hooks/useFormGuide';
import type { MemberCricketStats } from '../types';
import { outfieldDismissals, keeperDismissals, hasKept } from '../utils/fielding';

// MOM count pill shown next to a player name
function MOMBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      title={`${count} Man of the Match award${count > 1 ? 's' : ''} this season`}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold whitespace-nowrap"
    >
      <Crown className="w-2.5 h-2.5" fill="currentColor" />
      {count}
    </span>
  );
}

// Last-5 form: small colored dots
function FormDots({ form }: { form: FormResult[] | undefined }) {
  if (!form || form.length === 0) return null;
  return (
    <span className="inline-flex gap-0.5 ml-2" title={`Form: ${form.map(r => r.charAt(0).toUpperCase()).join(' · ')}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full inline-block ${
            r === 'won' ? 'bg-green-500'
            : r === 'lost' ? 'bg-red-500'
            : 'bg-amber-500'
          }`}
        />
      ))}
    </span>
  );
}

type Tab = 'batting' | 'bowling' | 'fielding' | 'overall';
type SortDir = 'asc' | 'desc';

interface ColDef {
  key: keyof MemberCricketStats;
  label: string;
  tooltip: string;          // full description shown on hover
  format?: (v: number | string) => string;
  highlight?: boolean;
}

const BATTING_COLS: ColDef[] = [
  { key: 'batting_innings',      label: 'Inn',   tooltip: 'Innings batted' },
  { key: 'batting_runs',         label: 'Runs',  tooltip: 'Total runs scored', highlight: true },
  { key: 'batting_highest_score',label: 'HS',    tooltip: 'Highest score in a single innings' },
  { key: 'batting_average',      label: 'Avg',   tooltip: 'Batting average (runs per dismissal)', format: v => Number(v).toFixed(1), highlight: true },
  { key: 'batting_strike_rate',  label: 'SR',    tooltip: 'Strike rate — runs per 100 balls', format: v => Number(v).toFixed(1) },
  { key: 'batting_fifties',      label: '50s',   tooltip: 'Fifties scored (50–99 runs in an innings)' },
  { key: 'batting_hundreds',     label: '100s',  tooltip: 'Centuries scored (100+ runs in an innings)' },
  { key: 'batting_fours',        label: '4s',    tooltip: 'Fours hit' },
  { key: 'batting_sixes',        label: '6s',    tooltip: 'Sixes hit' },
  { key: 'batting_ducks',        label: 'Ducks', tooltip: 'Ducks — dismissed without scoring (0)' },
  { key: 'batting_run_outs',     label: 'ROs',   tooltip: 'Times dismissed by run-out while batting' },
];

const BOWLING_COLS: ColDef[] = [
  { key: 'bowling_innings',       label: 'Inn',   tooltip: 'Innings bowled' },
  { key: 'bowling_overs',         label: 'Overs', tooltip: 'Total overs bowled', format: v => Number(v).toFixed(1) },
  { key: 'bowling_wickets',       label: 'Wkts',  tooltip: 'Total wickets taken', highlight: true },
  { key: 'bowling_runs_conceded', label: 'Runs',  tooltip: 'Runs conceded while bowling' },
  { key: 'bowling_economy',       label: 'Econ',  tooltip: 'Economy rate — runs conceded per over (lower is better)', format: v => Number(v).toFixed(2), highlight: true },
  { key: 'bowling_average',       label: 'Avg',   tooltip: 'Bowling average — runs per wicket (lower is better)', format: v => Number(v).toFixed(1) },
  { key: 'bowling_strike_rate',   label: 'SR',    tooltip: 'Bowling strike rate — balls per wicket (lower is better)', format: v => Number(v).toFixed(1) },
  { key: 'bowling_best_figures',  label: 'Best',  tooltip: 'Best bowling figures in a single innings (e.g. 4/22)' },
  { key: 'bowling_five_wickets',  label: '5-fors', tooltip: '5-wicket hauls in a single innings' },
];

const FIELDING_COLS: ColDef[] = [
  { key: 'fielding_catches',    label: 'Catches',   tooltip: 'Catches taken', highlight: true },
  { key: 'fielding_stumpings',  label: 'Stumpings', tooltip: 'Stumpings (wicket-keeper only)' },
  { key: 'fielding_run_outs',   label: 'Run Outs',  tooltip: 'Run outs directly credited to this player' },
];

function overallScore(s: MemberCricketStats) {
  return s.batting_runs + s.bowling_wickets * 20 +
    (s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs) * 10;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
      <Trophy className="w-4 h-4 text-yellow-500" />
    </span>
  );
  if (rank === 2) return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700">
      <Medal className="w-4 h-4 text-gray-400" />
    </span>
  );
  if (rank === 3) return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
      <Medal className="w-4 h-4 text-orange-400" />
    </span>
  );
  return (
    <span className="flex items-center justify-center w-8 h-8 text-sm font-bold text-gray-500 dark:text-gray-400">
      {rank}
    </span>
  );
}

// Shows a small arrow + number for rank movement (positive = moved up)
function RankChangeBadge({ change }: { change: number }) {
  if (!change) return null;
  const up = change > 0;
  return (
    <span
      title={up ? `Moved up ${change} place${change > 1 ? 's' : ''}` : `Moved down ${Math.abs(change)} place${Math.abs(change) > 1 ? 's' : ''}`}
      className={`inline-flex items-center gap-0 text-[10px] font-black leading-none ${up ? 'text-emerald-500' : 'text-red-400'}`}
    >
      {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(change)}
    </span>
  );
}

function StatCell({ value, highlight, isTop }: { value: string | number; highlight?: boolean; isTop?: boolean }) {
  const text = String(value);
  if (highlight && isTop) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold text-sm">
        <Star className="w-3 h-3" />
        {text}
      </span>
    );
  }
  return <span className={highlight ? 'font-semibold text-gray-900 dark:text-white' : ''}>{text}</span>;
}

const SEASONS = [
  { value: '2025-26', label: 'Season 2025–26' },
  { value: '2024-25', label: 'Season 2024–25' },
  { value: '2023-24', label: 'Season 2023–24' },
  { value: 'all',     label: 'Overall (All Seasons)' },
] as const;
// Note: 'all' aggregates every named-year row (2025-26, 2024-25, etc.)
// Never shows 'all-time' rows (which would double-count current season stats).

export function Leaderboard() {
  const [season, setSeason] = useState<string>('all');
  const { stats, loading, error, fetchStats } = useCricketStats(season);
  const { counts: momCounts } = useMOMCounts();
  const { formByMember } = useFormGuide();
  const [tab, setTab] = useState<Tab>('batting');
  const [sortKey, setSortKey] = useState<keyof MemberCricketStats>('batting_runs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleSort = (key: keyof MemberCricketStats) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const defaultSortKey: Record<Tab, keyof MemberCricketStats> = {
    batting:  'batting_runs',
    bowling:  'bowling_wickets',
    fielding: 'fielding_catches',
    overall:  'batting_runs',
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSortKey(defaultSortKey[t]);
    setSortDir('desc');
  };

  const sorted = useMemo(() => {
    // Fielding board ranks by cumulative outfield dismissals (catches + run-outs),
    // not catches alone — unless the user explicitly sorts by another column.
    if (tab === 'fielding' && sortKey === 'fielding_catches') {
      return [...stats].sort((a, b) =>
        sortDir === 'desc' ? outfieldDismissals(b) - outfieldDismissals(a)
                           : outfieldDismissals(a) - outfieldDismissals(b));
    }
    return [...stats].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const diff = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [stats, sortKey, sortDir, tab]);

  // Overall sorted by composite score
  const overallSorted = useMemo(() => {
    return [...stats].sort((a, b) => overallScore(b) - overallScore(a));
  }, [stats]);

  const cols = tab === 'batting' ? BATTING_COLS : tab === 'bowling' ? BOWLING_COLS : FIELDING_COLS;

  // For highlight detection: top value per highlight col
  const topValues = useMemo(() => {
    const tv: Partial<Record<keyof MemberCricketStats, number | string>> = {};
    cols.forEach(col => {
      if (col.highlight) {
        const vals = stats.map(s => s[col.key] as number);
        tv[col.key] = col.key === 'bowling_economy'
          ? Math.min(...vals.filter(v => v > 0))
          : Math.max(...vals);
      }
    });
    return tv;
  }, [stats, cols]);

  const tabs: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'batting',  label: 'Batting',  icon: TrendingUp, color: 'text-blue-500' },
    { id: 'bowling',  label: 'Bowling',  icon: Zap,        color: 'text-purple-500' },
    { id: 'fielding', label: 'Fielding', icon: Shield,     color: 'text-orange-500' },
    { id: 'overall',  label: 'Overall',  icon: Trophy,     color: 'text-yellow-500' },
  ];

  // No keeper exclusion: fielding_catches is outfield-only (keeper catches live
  // in fielding_caught_behind), so everyone competes fairly on outfielding.
  const activeStats = tab === 'overall' ? overallSorted : sorted;

  // Best Wicket-Keeper highlight — shown above the fielding board.
  const topKeeper = useMemo(() => {
    const k = [...stats].filter(hasKept).sort((a, b) => keeperDismissals(b) - keeperDismissals(a))[0];
    return k ? { player: k, total: keeperDismissals(k) } : null;
  }, [stats]);

  // ── "Your rank" — the member-magnet hook ─────────────────────────────────
  const metricOf = (s: MemberCricketStats) =>
    tab === 'batting' ? s.batting_runs
    : tab === 'bowling' ? s.bowling_wickets
    : tab === 'fielding' ? outfieldDismissals(s)
    : Math.round(overallScore(s));
  const metricUnit = tab === 'batting' ? 'runs' : tab === 'bowling' ? 'wkts' : tab === 'fielding' ? 'dismissals' : 'pts';
  const myMemberId = typeof window !== 'undefined' ? localStorage.getItem('scc-my-profile-id') : null;
  const myRank = useMemo(() => {
    if (!myMemberId) return null;
    const idx = activeStats.findIndex(s => s.member_id === myMemberId);
    if (idx < 0) return null;
    const me = activeStats[idx];
    const above = idx > 0 ? activeStats[idx - 1] : null;
    const gap = above ? metricOf(above) - metricOf(me) : 0;
    const aboveName = (above?.member as { name?: string } | undefined)?.name?.split(' ')[0] ?? null;
    return { rank: idx + 1, value: metricOf(me), gap, aboveName, name: (me.member as { name?: string } | undefined)?.name ?? 'You' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStats, myMemberId, tab]);

  // ── Rank-change tracking ─────────────────────────────────────────────────
  // Two keys per tab:
  //   scc-lb-prev-{tab}  → yesterday's (or last-match-day's) ranks — STABLE all day
  //   scc-lb-today-{tab} → current ranks (updated every time stats load)
  // On a new calendar day, "today" is promoted to "prev" before overwriting.
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({});

  // Effect 1: load the stable "previous" snapshot on mount / tab change.
  // This always reads scc-lb-prev-{tab} which never changes during the same day.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scc-lb-prev-${tab}`);
      setPrevRanks(stored ? (JSON.parse(stored) as Record<string, number>) : {});
    } catch { setPrevRanks({}); }
  }, [tab]);

  // Effect 2: keep scc-lb-today-{tab} up-to-date, promote to prev on new day.
  useEffect(() => {
    if (activeStats.length === 0) return;
    const prevKey   = `scc-lb-prev-${tab}`;
    const todayKey  = `scc-lb-today-${tab}`;
    const dateKey   = `scc-lb-date-${tab}`;
    const today     = new Date().toDateString();

    if (localStorage.getItem(dateKey) !== today) {
      // New calendar day — promote yesterday's "today" snapshot to "prev"
      const todayData = localStorage.getItem(todayKey);
      if (todayData) localStorage.setItem(prevKey, todayData);
      localStorage.setItem(dateKey, today);
    }

    // Always update today's snapshot so tomorrow's "prev" is accurate
    const current: Record<string, number> = {};
    activeStats.forEach((s, i) => { current[s.member_id] = i + 1; });
    localStorage.setItem(todayKey, JSON.stringify(current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, stats.length]);

  return (
    <div className="space-y-6">
      <Header title="Leaderboard" subtitle={SEASONS.find(s => s.value === season)?.label ?? season} />

      {/* Season banner */}
      <div className="mx-4 sm:mx-0 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 p-5 text-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <p className="text-primary-100 text-sm font-medium">Sangria Cricket Club</p>
            <h2 className="text-xl font-bold">
              {SEASONS.find(s => s.value === season)?.label ?? season}
            </h2>
            <p className="text-primary-200 text-xs">{stats.length} players · Synced from CricHeroes</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Season selector */}
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="text-sm font-semibold rounded-xl bg-white/20 hover:bg-white/30 border border-white/20 text-white px-3 py-2 outline-none cursor-pointer"
          >
            {SEASONS.map(s => (
              <option key={s.value} value={s.value} className="text-gray-900">{s.label}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-primary-200 hover:text-white text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      {/* ── Your Rank — personal hook ──────────────────────────────────── */}
      {myRank && (
        <div className="mx-4 sm:mx-0 rounded-2xl bg-accent-grad p-4 sm:px-5 flex items-center justify-between gap-3 flex-wrap shadow-accent">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Your rank · {tabs.find(t => t.id === tab)?.label}</p>
            <p className="font-display text-2xl sm:text-[26px] font-extrabold tabular-nums">#{myRank.rank} · {myRank.value.toLocaleString()} {metricUnit}</p>
          </div>
          <div className="text-right text-[13px] font-bold leading-tight">
            {myRank.gap > 0 && myRank.aboveName
              ? <>Just <span className="tabular-nums">{myRank.gap.toLocaleString()}</span> {metricUnit} to overtake<br /><span className="opacity-85 font-semibold">{myRank.aboveName} ↑</span></>
              : <>🏆 You're #1 — top of the board!</>}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="mx-4 sm:mx-0 flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? t.color : ''}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Best Wicket-Keeper highlight (fielding tab only) */}
      {tab === 'fielding' && topKeeper && (
        <div className="mx-4 sm:mx-0 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-4 py-3">
          {(topKeeper.player.member as { avatar_url?: string } | undefined)?.avatar_url ? (
            <img src={(topKeeper.player.member as { avatar_url?: string }).avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center font-black">
              {((topKeeper.player.member as { name?: string } | undefined)?.name || '?').charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">🧤 Best Wicket-Keeper</p>
            <p className="font-bold text-gray-900 dark:text-white truncate">{(topKeeper.player.member as { name?: string } | undefined)?.name || 'Player'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {topKeeper.total} dismissals · {topKeeper.player.fielding_caught_behind ?? 0} ct behind · {topKeeper.player.fielding_stumpings} st
            </p>
          </div>
        </div>
      )}

      {/* Top 3 spotlight */}
      {!loading && activeStats.length >= 3 && (
        <div className="mx-4 sm:mx-0 grid grid-cols-3 gap-3">
          {[activeStats[1], activeStats[0], activeStats[2]].map((player, idx) => {
            const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            const score = tab === 'overall' ? overallScore(player) :
              tab === 'batting' ? player.batting_runs :
              tab === 'bowling' ? player.bowling_wickets :
              player.fielding_catches + player.fielding_run_outs;
            const scoreLabel = tab === 'batting' ? 'runs' : tab === 'bowling' ? 'wkts' : tab === 'overall' ? 'pts' : 'dismissals';
            const avatarUrl = (player.member as { avatar_url?: string } | undefined)?.avatar_url;
            const name = (player.member as { name?: string } | undefined)?.name || 'Player';

            return (
              <div
                key={player.id}
                className={`relative rounded-2xl p-3 text-center flex flex-col items-center gap-1 ${
                  realRank === 1
                    ? 'bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-2 border-yellow-300 dark:border-yellow-600 -mt-2'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {realRank === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                  </div>
                )}
                <div className={`relative ${realRank === 1 ? 'mt-2' : ''}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name}
                      className={`rounded-full object-cover ${realRank === 1 ? 'w-16 h-16' : 'w-12 h-12'}`} />
                  ) : (
                    <div className={`rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center ${realRank === 1 ? 'w-16 h-16' : 'w-12 h-12'}`}>
                      <span className={`font-bold text-primary-600 dark:text-primary-400 ${realRank === 1 ? 'text-xl' : 'text-base'}`}>
                        {name[0]}
                      </span>
                    </div>
                  )}
                  <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    realRank === 1 ? 'bg-yellow-500' : realRank === 2 ? 'bg-gray-400' : 'bg-orange-400'
                  }`}>{realRank}</span>
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight mt-1 flex items-center gap-1">
                  {name.split(' ')[0]}
                  <MOMBadge count={momCounts[player.member_id] || 0} />
                </p>
                <p className={`font-bold ${realRank === 1 ? 'text-lg text-yellow-600 dark:text-yellow-400' : 'text-base text-primary-600 dark:text-primary-400'}`}>
                  {score}
                  <span className="text-xs font-normal text-gray-500 ml-1">{scoreLabel}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats table */}
      <Card className="mx-4 sm:mx-0 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading stats...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : stats.length === 0 ? (
            <div className="p-10 text-center">
              <Target className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No stats yet for this season</p>
              <p className="text-sm text-gray-400 mt-1">Run the CricHeroes sync script to populate data</p>
            </div>
          ) : tab === 'overall' ? (
            <OverallTable players={overallSorted} momCounts={momCounts} formByMember={formByMember} prevRanks={prevRanks} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">#</th>
                    <th className="sticky left-10 z-10 bg-gray-50 dark:bg-gray-700/50 px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-32">Player</th>
                    {cols.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        title={col.tooltip}
                        className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                      >
                        <span className="flex items-center justify-center gap-1" title={col.tooltip}>
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          ) : null}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activeStats.map((player, idx) => {
                    const name = (player.member as { name?: string } | undefined)?.name || 'Unknown';
                    const avatarUrl = (player.member as { avatar_url?: string } | undefined)?.avatar_url;
                    const isTopRow = idx < 3;
                    return (
                      <tr
                        key={player.id}
                        className={`transition-colors hover:bg-primary-50/50 dark:hover:bg-primary-900/10 ${
                          idx === 0 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <RankBadge rank={idx + 1} />
                            <RankChangeBadge change={prevRanks[player.member_id] !== undefined ? prevRanks[player.member_id] - (idx + 1) : 0} />
                          </div>
                        </td>
                        <td className="sticky left-10 z-10 bg-white dark:bg-gray-800 px-3 py-3">
                          <div className="flex items-center gap-2">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                  {name[0]}
                                </span>
                              </div>
                            )}
                            <span className="font-medium text-gray-900 dark:text-white text-sm whitespace-nowrap">
                              {name.split(' ')[0]}
                              {name.split(' ').length > 1 && (
                                <span className="hidden sm:inline"> {name.split(' ').slice(1).join(' ')}</span>
                              )}
                            </span>
                            <MOMBadge count={momCounts[player.member_id] || 0} />
                            <FormDots form={formByMember[player.member_id]} />
                          </div>
                        </td>
                        {cols.map(col => {
                          const raw = player[col.key];
                          const display = col.format ? col.format(raw as number) : String(raw ?? '—');
                          const isTopVal = col.highlight && raw === topValues[col.key] && (raw as number) > 0;
                          return (
                            <td key={col.key} className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">
                              <StatCell value={display} highlight={col.highlight} isTop={isTopVal && isTopRow} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      {!loading && stats.length > 0 && (
        <p className="mx-4 sm:mx-0 text-xs text-gray-400 text-center pb-6">
          Stats sourced from CricHeroes · Season 2025-26 · Updated daily
        </p>
      )}
    </div>
  );
}

function OverallTable({ players, momCounts, formByMember, prevRanks = {} }: { players: MemberCricketStats[]; momCounts: Record<string, number>; formByMember: Record<string, FormResult[]>; prevRanks?: Record<string, number> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
            <th title="Overall points: Runs + Wickets×20 + Dismissals×10" className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-help">Pts 🏅</th>
            <th title="Batting innings" className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider cursor-help">Inn 🏏</th>
            <th title="Runs scored" className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider cursor-help">Runs</th>
            <th title="Batting average (runs per dismissal)" className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider cursor-help">Avg</th>
            <th title="Strike rate — runs per 100 balls" className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider cursor-help">SR</th>
            <th title="Wickets taken" className="px-3 py-3 text-center text-xs font-semibold text-purple-500 uppercase tracking-wider cursor-help">Wkts ⚡</th>
            <th title="Economy rate — runs conceded per over (lower is better)" className="px-3 py-3 text-center text-xs font-semibold text-purple-500 uppercase tracking-wider cursor-help">Econ</th>
            <th title="Catches taken" className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider cursor-help">Catches 🧤</th>
            <th title="Stumpings (wicket-keeper)" className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider cursor-help">Stump</th>
            <th title="Run outs credited" className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider cursor-help">RO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {players.map((player, idx) => {
            const name = (player.member as { name?: string } | undefined)?.name || 'Unknown';
            const avatarUrl = (player.member as { avatar_url?: string } | undefined)?.avatar_url;
            const pts = overallScore(player);
            const maxPts = overallScore(players[0]);
            const pct = maxPts > 0 ? (pts / maxPts) * 100 : 0;

            return (
              <tr
                key={player.id}
                className={`hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors ${
                  idx === 0 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <RankBadge rank={idx + 1} />
                    <RankChangeBadge change={prevRanks[player.member_id] !== undefined ? prevRanks[player.member_id] - (idx + 1) : 0} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{name[0]}</span>
                      </div>
                    )}
                    <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{name}</span>
                    <MOMBadge count={momCounts[player.member_id] || 0} />
                    <FormDots form={formByMember[player.member_id]} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-gray-900 dark:text-white">{pts}</span>
                    <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{player.batting_innings}</td>
                <td className="px-3 py-3 text-center font-semibold text-blue-600 dark:text-blue-400">{player.batting_runs}</td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{player.batting_average.toFixed(1)}</td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{player.batting_strike_rate.toFixed(1)}</td>
                <td className="px-3 py-3 text-center font-semibold text-purple-600 dark:text-purple-400">{player.bowling_wickets}</td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{player.bowling_economy > 0 ? player.bowling_economy.toFixed(2) : '—'}</td>
                <td className="px-3 py-3 text-center text-orange-600 dark:text-orange-400">{player.fielding_catches}</td>
                <td className="px-3 py-3 text-center text-orange-600 dark:text-orange-400">{player.fielding_stumpings}</td>
                <td className="px-3 py-3 text-center text-orange-600 dark:text-orange-400">{player.fielding_run_outs}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
