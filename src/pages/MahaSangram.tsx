import { useMemo, useState } from 'react';
import { Trophy, Target, Hand, Crown } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useCricketStats } from '../hooks/useCricketStats';
import { useSccRankings, type RankingMode } from '../hooks/useSccRankings';
import { seasonOptions, CURRENT_SEASON, seasonWindow } from '../config/season';
import { JERSEY } from '../lib/playerCard';
import type { MemberCricketStats, Match } from '../types';

// ─── MahaSangram honours ──────────────────────────────────────────────────────
// The club's internal competition now runs to roughly a third of the season, so
// it has earned its own honours board rather than a line on someone else's.
//
// It is deliberately kept OFF the club's external record and out of the all-time
// books: these runs were made against our own bowling, and folding them into
// figures built over 181 matches against other clubs would quietly devalue both.
// Here they get counted properly on their own terms.

const SEASONS = seasonOptions();

/** Brahmos and Agni replaced Dhurandars and Bazigars; both are internal. */
const HOME_SIDES = new Set(['brahmos', 'dhurandars']);
const AWAY_SIDES = new Set(['agni', 'bazigars']);

type Cap = {
  key: string;
  title: string;
  sub: string;
  icon: typeof Trophy;
  ink: string;
  pick: (rows: MemberCricketStats[]) => MemberCricketStats | null;
  value: (r: MemberCricketStats) => string;
  detail: (r: MemberCricketStats) => string;
};

const fielding = (r: MemberCricketStats) =>
  r.fielding_catches + r.fielding_stumpings + r.fielding_run_outs;

const best = (rows: MemberCricketStats[], score: (r: MemberCricketStats) => number) => {
  const ranked = rows.filter(r => score(r) > 0).sort((a, b) => score(b) - score(a));
  return ranked[0] ?? null;
};

const CAPS: Cap[] = [
  {
    key: 'orange', title: 'Orange Cap', sub: 'Most runs', icon: Trophy, ink: '#f0b429',
    pick: rows => best(rows, r => r.batting_runs),
    value: r => `${r.batting_runs}`,
    detail: r => `${r.batting_innings} inns · HS ${r.batting_highest_score} · SR ${r.batting_strike_rate}`,
  },
  {
    key: 'purple', title: 'Purple Cap', sub: 'Most wickets', icon: Target, ink: '#a78bfa',
    pick: rows => best(rows, r => r.bowling_wickets),
    value: r => `${r.bowling_wickets}`,
    detail: r => `${r.bowling_overs} ov · Econ ${r.bowling_economy} · Best ${r.bowling_best_figures}`,
  },
  {
    key: 'gloves', title: 'Best Fielder', sub: 'Most dismissals', icon: Hand, ink: '#34d399',
    pick: rows => best(rows, fielding),
    value: r => `${fielding(r)}`,
    detail: r => `${r.fielding_catches} ct · ${r.fielding_stumpings} st · ${r.fielding_run_outs} ro`,
  },
];

/** Rivalry record across every internal match in the window. */
function rivalryOf(matches: Match[], within: (m: Match) => boolean) {
  return matches.reduce((r, m) => {
    if (m.match_type !== 'internal') return r;
    if (!['won', 'lost', 'draw'].includes(m.result)) return r;
    if (!within(m)) return r;
    r.played += 1;
    if (m.winning_team && HOME_SIDES.has(m.winning_team)) r.home += 1;
    else if (m.winning_team && AWAY_SIDES.has(m.winning_team)) r.away += 1;
    else r.undecided += 1;
    return r;
  }, { played: 0, home: 0, away: 0, undecided: 0 });
}

export function MahaSangram({ embedded = false }: { embedded?: boolean } = {}) {
  const [season, setSeason] = useState<string>(CURRENT_SEASON);
  const { matches } = useMatches();
  const { members } = useMembers();
  const { scorecards } = useAllScorecards();
  const { stats, loading } = useCricketStats(season, 'internal');

  const window = useMemo(() => seasonWindow(season), [season]);
  const inSeason = useMemo(
    () => (m: Match) => m.date >= window.start && m.date <= window.end,
    [window],
  );

  const seasonRivalry = useMemo(() => rivalryOf(matches, inSeason), [matches, inSeason]);
  const allTimeRivalry = useMemo(() => rivalryOf(matches, () => true), [matches]);

  // Player of the Tournament uses the same rating engine as the club rankings,
  // scoped to internal matches — so it weighs a bowling spell against an innings
  // rather than just handing it to whoever scored most.
  const rankings = useSccRankings(matches, members, scorecards, season as RankingMode, 'internal');
  const potm = rankings.allRounders[0] ?? rankings.batters[0] ?? null;

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? '—';
  const rowName = (r: MemberCricketStats) => r.member?.name ?? nameOf(r.member_id);

  const topRuns = useMemo(
    () => [...stats].filter(r => r.batting_runs > 0).sort((a, b) => b.batting_runs - a.batting_runs).slice(0, 10),
    [stats],
  );
  const topWickets = useMemo(
    () => [...stats].filter(r => r.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets).slice(0, 10),
    [stats],
  );

  const hasStats = stats.length > 0;

  return (
    <div className="space-y-4">
      {!embedded && <Header title="MahaSangram" subtitle="Brahmos vs Agni — the internal honours" />}

      <div className="px-4 lg:px-8 pt-4 space-y-4">
        {/* ── Rivalry scoreboard ───────────────────────────────────────── */}
        <div className="relative overflow-hidden r-card shadow-lg">
          <div className="absolute inset-0" style={{ background: JERSEY.agni.bg }} />
          <div className="absolute inset-0"
            style={{ background: JERSEY.brahmos.bg, clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)' }} />
          <div className="relative px-5 py-5 text-white">
            <p className="t-micro font-black uppercase tracking-[3px] text-white/60 text-center">
              SCC MahaSangram · {SEASONS.find(s => s.value === season)?.label ?? season}
            </p>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="text-right flex-1">
                <p className="font-black text-lg leading-tight" style={{ color: JERSEY.brahmos.ink }}>Brahmos</p>
                <p className="text-4xl font-black tabular-nums">{seasonRivalry.home}</p>
              </div>
              <span className="text-white/40 font-black">–</span>
              <div className="text-left flex-1">
                <p className="font-black text-lg leading-tight" style={{ color: JERSEY.agni.ink }}>Agni</p>
                <p className="text-4xl font-black tabular-nums">{seasonRivalry.away}</p>
              </div>
            </div>
            <p className="t-meta text-white/60 text-center mt-2">
              {seasonRivalry.played} played this season
              {allTimeRivalry.played > seasonRivalry.played &&
                ` · ${allTimeRivalry.home}–${allTimeRivalry.away} all-time`}
              {seasonRivalry.undecided > 0 && ` · ${seasonRivalry.undecided} with no side recorded`}
            </p>
          </div>
        </div>

        {/* Season selector */}
        <div className="flex justify-end">
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="text-sm font-semibold r-control bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 outline-none cursor-pointer text-slate-700 dark:text-white"
          >
            {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {loading ? (
          <Card className="p-6 text-center t-body text-slate-500">Loading…</Card>
        ) : !hasStats ? (
          // Internal stats only exist once the sync has run since MahaSangram
          // became countable — before that this is empty for a real reason, and
          // saying so beats an empty table that looks like nobody has scored.
          <Card className="p-6 text-center space-y-1">
            <p className="font-black text-slate-900 dark:text-white">No MahaSangram stats yet</p>
            <p className="t-body text-slate-500 dark:text-gray-400">
              These fill in from the CricHeroes sync once an internal match has been played
              and synced. The rivalry score above reads from the fixtures and is already live.
            </p>
          </Card>
        ) : (
          <>
            {/* ── Player of the Tournament ─────────────────────────────── */}
            {potm && (
              <Card className="p-5 flex items-center gap-4 border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/10">
                <div className="w-12 h-12 r-card bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="t-micro font-black uppercase tracking-widest text-amber-600">
                    Player of the Tournament
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                    {potm.member.name}
                  </p>
                  <p className="t-meta text-slate-500 dark:text-gray-400">
                    {Math.round(potm.rating)} rating · {potm.matchesCounted} match{potm.matchesCounted === 1 ? '' : 'es'}
                  </p>
                </div>
              </Card>
            )}

            {/* ── The caps ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CAPS.map(cap => {
                const winner = cap.pick(stats);
                return (
                  <Card key={cap.key} className="p-4">
                    <div className="flex items-center gap-2">
                      <cap.icon className="w-4 h-4" style={{ color: cap.ink }} />
                      <p className="t-micro font-black uppercase tracking-widest text-slate-500">
                        {cap.title}
                      </p>
                    </div>
                    {winner ? (
                      <>
                        <p className="text-3xl font-black tabular-nums mt-2 text-slate-900 dark:text-white">
                          {cap.value(winner)}
                        </p>
                        <p className="font-bold text-slate-800 dark:text-white/90 truncate">
                          {rowName(winner)}
                        </p>
                        <p className="t-meta text-slate-500 dark:text-gray-400 truncate">
                          {cap.detail(winner)}
                        </p>
                      </>
                    ) : (
                      <p className="t-body text-slate-400 mt-2">{cap.sub} — nothing yet</p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* ── Run and wicket tables ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[
                { title: 'Most runs', rows: topRuns, val: (r: MemberCricketStats) => r.batting_runs,
                  sub: (r: MemberCricketStats) => `${r.batting_innings} inns · SR ${r.batting_strike_rate}` },
                { title: 'Most wickets', rows: topWickets, val: (r: MemberCricketStats) => r.bowling_wickets,
                  sub: (r: MemberCricketStats) => `${r.bowling_overs} ov · Econ ${r.bowling_economy}` },
              ].map(t => (
                <Card key={t.title} className="p-4">
                  <p className="t-micro font-black uppercase tracking-widest text-slate-500 mb-2">{t.title}</p>
                  {t.rows.length === 0 ? (
                    <p className="t-body text-slate-400">Nothing yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {t.rows.map((r, i) => (
                        <div key={r.member_id} className="flex items-center gap-3">
                          <span className="t-meta font-black text-slate-400 w-5 tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-white/90 truncate">{rowName(r)}</p>
                            <p className="t-micro text-slate-400 truncate">{t.sub(r)}</p>
                          </div>
                          <span className="font-black tabular-nums text-slate-900 dark:text-white">{t.val(r)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="t-meta text-slate-400 dark:text-gray-500 px-1">
          MahaSangram figures are counted on their own. They never enter the club's
          win/loss record or the all-time books — both sides are SCC.
        </p>
      </div>
    </div>
  );
}
