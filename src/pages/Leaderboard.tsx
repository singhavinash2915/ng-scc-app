import { useState, useMemo } from 'react';
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
  format?: (v: number | string) => string;
  highlight?: boolean;
}

const BATTING_COLS: ColDef[] = [
  { key: 'batting_innings',      label: 'Inn' },
  { key: 'batting_runs',         label: 'Runs',   highlight: true },
  { key: 'batting_highest_score',label: 'HS' },
  { key: 'batting_average',      label: 'Avg',    format: v => Number(v).toFixed(1), highlight: true },
  { key: 'batting_strike_rate',  label: 'SR',     format: v => Number(v).toFixed(1) },
  { key: 'batting_fifties',      label: '50s' },
  { key: 'batting_hundreds',     label: '100s' },
  { key: 'batting_fours',        label: '4s' },
  { key: 'batting_sixes',        label: '6s' },
  { key: 'batting_ducks',        label: '0s' },
];

const BOWLING_COLS: ColDef[] = [
  { key: 'bowling_innings',       label: 'Inn' },
  { key: 'bowling_overs',         label: 'Ov',     format: v => Number(v).toFixed(1) },
  { key: 'bowling_wickets',       label: 'Wkts',   highlight: true },
  { key: 'bowling_runs_conceded', label: 'Runs' },
  { key: 'bowling_economy',       label: 'Econ',   format: v => Number(v).toFixed(2), highlight: true },
  { key: 'bowling_average',       label: 'Avg',    format: v => Number(v).toFixed(1) },
  { key: 'bowling_strike_rate',   label: 'SR',     format: v => Number(v).toFixed(1) },
  { key: 'bowling_best_figures',  label: 'Best' },
  { key: 'bowling_five_wickets',  label: '5W' },
];

const FIELDING_COLS: ColDef[] = [
  { key: 'fielding_catches',    label: 'Catches',   highlight: true },
  { key: 'fielding_stumpings',  label: 'Stumpings' },
  { key: 'fielding_run_outs',   label: 'Run Outs' },
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

export function Leaderboard() {
  const { stats, loading, error, fetchStats } = useCricketStats('2025-26');
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
    return [...stats].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const diff = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [stats, sortKey, sortDir]);

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

  const activeStats = tab === 'overall' ? overallSorted : sorted;

  return (
    <div className="space-y-6">
      <Header title="Leaderboard" subtitle="Season 2025-26 • CricHeroes Stats" />

      {/* Season banner */}
      <div className="mx-4 sm:mx-0 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <p className="text-primary-100 text-sm font-medium">Current Season</p>
            <h2 className="text-xl font-bold">SCC Season 2025-26</h2>
            <p className="text-primary-200 text-xs">{stats.length} players · Synced from CricHeroes</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reload stats from database"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-xl text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Loading...' : 'Reload'}
          </button>
          <span className="text-primary-200 text-[10px]">Stats auto-sync daily at 6 AM</span>
        </div>
      </div>

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

      {/* Top 3 spotlight */}
      {!loading && activeStats.length >= 3 && (
        <div className="mx-4 sm:mx-0 grid grid-cols-3 gap-3">
          {[activeStats[1], activeStats[0], activeStats[2]].map((player, idx) => {
            const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            const score = tab === 'overall' ? overallScore(player) :
              tab === 'batting' ? player.batting_runs :
              tab === 'bowling' ? player.bowling_wickets :
              player.fielding_catches + player.fielding_stumpings + player.fielding_run_outs;
            const scoreLabel = tab === 'batting' ? 'runs' : tab === 'bowling' ? 'wkts' : 'dismissals';
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
            <OverallTable players={overallSorted} momCounts={momCounts} formByMember={formByMember} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">#</th>
                    <th className="sticky left-10 z-10 bg-gray-50 dark:bg-gray-700/50 px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-32">Player</th>
                    {cols.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                      >
                        <span className="flex items-center justify-center gap-1">
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
                  {sorted.map((player, idx) => {
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
                          <RankBadge rank={idx + 1} />
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

function OverallTable({ players, momCounts, formByMember }: { players: MemberCricketStats[]; momCounts: Record<string, number>; formByMember: Record<string, FormResult[]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider">Inn</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider">Runs</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider">Avg</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider">SR</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-purple-500 uppercase tracking-wider">Wkts</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-purple-500 uppercase tracking-wider">Econ</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider">Ct</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider">St</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-orange-500 uppercase tracking-wider">RO</th>
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
                <td className="px-4 py-3"><RankBadge rank={idx + 1} /></td>
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
