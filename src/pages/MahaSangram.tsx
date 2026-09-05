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
import { JERSEY, type JerseyTeam } from '../lib/playerCard';
import { internalSides } from '../utils/internalTeams';
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

// The sides are read from the fixture, never hardcoded. Brahmos and Agni are a
// NEW competition, not renamed Dhurandars and Bazigars — treating them as the
// same two teams put the old rivalry's 5–4 on the board under the new names, in
// a season where nothing has been played yet. Each internal competition keeps
// its own record.

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

interface Rivalry {
  /** "Brahmos vs Agni" — identifies which competition this is. */
  label: string;
  home: string;
  away: string;
  homeWins: number;
  awayWins: number;
  played: number;
  undecided: number;
}

/** winning_team holds the side key — 'brahmos', 'dhurandars' — and the fixture
 *  names the sides. Comparing the two is what tells us which end won, and it
 *  works for any competition without knowing its teams in advance. */
const wonBy = (m: Match, side: string) =>
  !!m.winning_team && m.winning_team.toLowerCase() === side.toLowerCase();

/** Every internal competition inside `matches`, keyed by its pairing.
 *  Upcoming fixtures count towards naming the rivalry but not its score, so a
 *  season that has been scheduled and not yet played shows the right two teams
 *  on nil–nil rather than borrowing the previous era's record. */
function rivalriesIn(matches: Match[]): Map<string, Rivalry> {
  const out = new Map<string, Rivalry>();
  for (const m of matches) {
    if (m.match_type !== 'internal') continue;
    if (m.result === 'cancelled') continue;
    const sides = internalSides(m);
    if (!sides.home || !sides.away) continue;
    const r = out.get(sides.label) ?? {
      label: sides.label, home: sides.home, away: sides.away,
      homeWins: 0, awayWins: 0, played: 0, undecided: 0,
    };
    if (['won', 'lost', 'draw'].includes(m.result)) {
      r.played += 1;
      if (wonBy(m, sides.home)) r.homeWins += 1;
      else if (wonBy(m, sides.away)) r.awayWins += 1;
      else r.undecided += 1;
    }
    out.set(sides.label, r);
  }
  return out;
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

  // Whichever internal competition this season actually ran. Picked by how many
  // fixtures it has rather than assumed, so a season that changes format shows
  // the teams that played it.
  const seasonRivalry = useMemo(() => {
    const inWindow = matches.filter(inSeason);
    const found = [...rivalriesIn(inWindow).values()];
    if (found.length) {
      return found.sort((a, b) => b.played - a.played || b.label.localeCompare(a.label))[0];
    }
    return null;
  }, [matches, inSeason]);

  // All-time for THIS pairing only. Adding Dhurandars' wins to Brahmos' would
  // be adding up two different competitions.
  const allTimeRivalry = useMemo(
    () => (seasonRivalry ? rivalriesIn(matches).get(seasonRivalry.label) ?? null : null),
    [matches, seasonRivalry],
  );

  // Team colours exist for the current sides; an older rivalry falls back to the
  // club's own palette rather than borrowing Brahmos and Agni's kits.
  const kitOf = (side: string): { bg: string; ink: string } => {
    const key = side.toLowerCase() as JerseyTeam;
    return JERSEY[key] ?? { bg: 'linear-gradient(150deg,#0f2027 0%,#203a43 55%,#0b141a 100%)', ink: '#e2e8f0' };
  };

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
        {/* ── Rivalry scoreboard ───────────────────────────────────────
            Named from the fixtures, so each internal competition keeps its own
            record and its own two teams. */}
        <div className="relative overflow-hidden r-card shadow-lg">
          <div className="absolute inset-0"
            style={{ background: kitOf(seasonRivalry?.away ?? 'agni').bg }} />
          <div className="absolute inset-0"
            style={{ background: kitOf(seasonRivalry?.home ?? 'brahmos').bg,
                     clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)' }} />
          <div className="relative px-5 py-5 text-white">
            <p className="t-micro font-black uppercase tracking-[3px] text-white/60 text-center">
              {seasonRivalry?.label ?? 'Internal'} · {SEASONS.find(s => s.value === season)?.label ?? season}
            </p>
            {seasonRivalry ? (
              <>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <div className="text-right flex-1">
                    <p className="font-black text-lg leading-tight"
                       style={{ color: kitOf(seasonRivalry.home).ink }}>{seasonRivalry.home}</p>
                    <p className="text-4xl font-black tabular-nums">{seasonRivalry.homeWins}</p>
                  </div>
                  <span className="text-white/40 font-black">–</span>
                  <div className="text-left flex-1">
                    <p className="font-black text-lg leading-tight"
                       style={{ color: kitOf(seasonRivalry.away).ink }}>{seasonRivalry.away}</p>
                    <p className="text-4xl font-black tabular-nums">{seasonRivalry.awayWins}</p>
                  </div>
                </div>
                <p className="t-meta text-white/60 text-center mt-2">
                  {seasonRivalry.played === 0
                    ? 'Not played yet this season'
                    : `${seasonRivalry.played} played this season`}
                  {allTimeRivalry && allTimeRivalry.played > seasonRivalry.played &&
                    ` · ${allTimeRivalry.homeWins}–${allTimeRivalry.awayWins} all-time`}
                  {seasonRivalry.undecided > 0 && ` · ${seasonRivalry.undecided} with no side recorded`}
                </p>
              </>
            ) : (
              <p className="t-body text-white/70 text-center mt-3">
                No internal fixtures this season.
              </p>
            )}
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
