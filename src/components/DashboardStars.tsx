import { CURRENT_SEASON, seasonLabel } from '../config/season';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronRight, Crown, TrendingUp, Zap, Shield } from 'lucide-react';
import { useCricketStats } from '../hooks/useCricketStats';
import { outfieldDismissals, keeperDismissals, hasKept } from '../utils/fielding';
import type { MemberCricketStats } from '../types';

const getAvatar = (m: unknown) => (m as { avatar_url?: string } | undefined)?.avatar_url;
const getName = (m: unknown) => (m as { name?: string } | undefined)?.name || '—';

// ─── One specialist ─────────────────────────────────────────────────────
// The old cards were saturated gradient slabs — navy, maroon, green, brown —
// sitting on a page whose every other card is the app's own light surface.
// Four full-bleed colours competing at once is what made the section look
// bolted on, and in light mode it was four dark blocks on a white page.
//
// Same information, house surface: colour survives as an accent — the icon
// chip, a hairline rule along the top, the unit under the figure — and the
// number carries the card instead of a background gradient.
function Specialist({ label, icon, tone, number, unit, detail, player, moms }: {
  label: string;
  icon: React.ReactNode;
  tone: { rule: string; chip: string; ink: string };
  number: number | string;
  unit: string;
  detail?: string;
  player: MemberCricketStats;
  moms: number;
}) {
  const avatar = getAvatar(player.member);
  const name = getName(player.member);
  return (
    <div className="glass r-card relative overflow-hidden p-4 lg:p-5 flex flex-col">
      {/* The card's only saturated pixels. */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${tone.rule}`} />

      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${tone.chip}`}>
          {icon}
        </span>
        <span className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/45">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mt-3">
        <span className="t-num text-4xl lg:text-[2.75rem] leading-none text-slate-900 dark:text-white">
          {number}
        </span>
        <span className={`t-micro font-black uppercase tracking-[1.5px] ${tone.ink}`}>{unit}</span>
      </div>
      {detail && (
        <p className="t-micro font-semibold text-slate-400 dark:text-white/40 mt-1">{detail}</p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-3.5">
        {avatar ? (
          <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover
                                             ring-1 ring-slate-200 dark:ring-white/15 flex-shrink-0" />
        ) : (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${tone.chip}`}>
            <span className={`t-micro font-black ${tone.ink}`}>{name.charAt(0)}</span>
          </div>
        )}
        <span className="t-body font-bold text-slate-800 dark:text-white/90 truncate flex-1 min-w-0">
          {name.split(' ').slice(0, 2).join(' ')}
        </span>
        {moms > 0 && (
          <span className="inline-flex items-center gap-0.5 t-micro font-black text-amber-500 dark:text-amber-300 flex-shrink-0">
            <Crown className="w-2.5 h-2.5" fill="currentColor" />{moms}
          </span>
        )}
      </div>
    </div>
  );
}

interface DashboardStarsProps {
  momCounts?: Record<string, number>;
}

export function DashboardStars({ momCounts = {} }: DashboardStarsProps) {
  const { stats: cricketStats } = useCricketStats(CURRENT_SEASON);

  const { mvp, topBatsman, topBowler, bestFielder, bestKeeper } = useMemo(() => {
    if (!cricketStats.length) {
      return { mvp: null, topBatsman: null, topBowler: null, bestFielder: null, bestKeeper: null };
    }
    const score = (s: typeof cricketStats[0]) =>
      s.batting_runs + s.bowling_wickets * 20 +
      (s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs) * 10;

    const byMVP = [...cricketStats].sort((a, b) => score(b) - score(a));
    const byRuns = [...cricketStats].sort((a, b) => b.batting_runs - a.batting_runs);
    const byWkts = [...cricketStats].filter(s => s.bowling_wickets > 0)
      .sort((a, b) => b.bowling_wickets - a.bowling_wickets);
    // Best Fielder = outfield catches + run-outs (keepers included fairly —
    // their behind-the-stumps catches don't count here).
    const byField = [...cricketStats].sort((a, b) => outfieldDismissals(b) - outfieldDismissals(a));
    const byKeeper = cricketStats.filter(hasKept).sort((a, b) => keeperDismissals(b) - keeperDismissals(a));

    return {
      mvp: byMVP[0] ? { player: byMVP[0], points: score(byMVP[0]) } : null,
      topBatsman: byRuns[0] ? { player: byRuns[0] } : null,
      topBowler: byWkts[0] ? { player: byWkts[0] } : null,
      bestFielder: byField[0] && outfieldDismissals(byField[0]) > 0
        ? { player: byField[0], total: outfieldDismissals(byField[0]) } : null,
      bestKeeper: byKeeper[0] ? { player: byKeeper[0], total: keeperDismissals(byKeeper[0]) } : null,
    };
  }, [cricketStats]);

  if (!mvp) return null;

  const mvpAvatar = getAvatar(mvp.player.member);
  const mvpName = getName(mvp.player.member);
  const mvpMoms = momCounts[mvp.player.member_id] || 0;

  // What actually earned the points. The card used to call every MVP "the
  // all-rounder leading the pack" — including a bowler who hadn't batted.
  const mvpBlurb = (() => {
    const bat = mvp.player.batting_runs;
    const ball = mvp.player.bowling_wickets * 20;
    const field = (mvp.player.fielding_catches + mvp.player.fielding_stumpings
                 + mvp.player.fielding_run_outs) * 10;
    const top = Math.max(bat, ball, field);
    if (top === 0) return 'Leading the season';
    // Two strands within a third of each other is genuinely all-round.
    const strands = [bat, ball, field].filter(v => v >= top * 0.66).length;
    if (strands > 1) return 'Contributing in every department';
    if (top === bat) return 'Leading with the bat';
    if (top === ball) return 'Leading with the ball';
    return 'Leading in the field';
  })();

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
          {seasonLabel(CURRENT_SEASON)} Stars
        </h2>
        <Link to="/leaderboard" className="text-xs text-primary-500 dark:text-primary-400 flex items-center gap-0.5 font-semibold">
          Full Leaderboard <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">

        {/* ── MVP ──────────────────────────────────────────────────────────
            Still the one card that gets to feel like an award, but the gold
            is now light — a wash and a hairline over the house surface rather
            than a brown slab with a gradient-filled number on top of it. */}
        <div className="glass r-card relative overflow-hidden p-5 lg:p-7">
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(620px circle at 88% -30%, rgba(245,158,11,0.16), transparent 62%)' }} />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-amber-300 to-transparent" />

          <div className="relative flex items-center gap-3 lg:gap-6">
            {/* Face */}
            <div className="relative flex-shrink-0">
              {mvpAvatar ? (
                <img src={mvpAvatar} alt=""
                     className="w-14 h-14 lg:w-20 lg:h-20 r-card object-cover ring-1 ring-amber-400/40" />
              ) : (
                <div className="w-14 h-14 lg:w-20 lg:h-20 r-card bg-amber-400/15 ring-1 ring-amber-400/40
                                flex items-center justify-center">
                  <span className="t-num text-2xl text-amber-600 dark:text-amber-300">{mvpName.charAt(0)}</span>
                </div>
              )}
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400
                               flex items-center justify-center shadow-sm">
                <Crown className="w-3 h-3 text-amber-950" fill="currentColor" />
              </span>
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <span className="t-micro font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-300/80">
                Season MVP
              </span>
              <h3 className="font-display font-extrabold text-slate-900 dark:text-white
                             text-lg lg:text-2xl leading-tight truncate mt-0.5">
                {mvpName}
              </h3>
              <p className="t-micro font-semibold text-slate-400 dark:text-white/40 mt-0.5">
                {mvpBlurb}
              </p>
            </div>

            {/* Points — right-aligned, the anchor of the card */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-baseline gap-1 justify-end">
                <span className="t-num text-4xl lg:text-5xl leading-none text-slate-900 dark:text-white">
                  {mvp.points}
                </span>
                <span className="t-micro font-black uppercase tracking-[1.5px] text-amber-600 dark:text-amber-300/70">pts</span>
              </div>
              {mvpMoms > 0 && (
                <span className="inline-flex items-center gap-0.5 t-micro font-black
                                 text-amber-500 dark:text-amber-300 mt-1.5">
                  <Crown className="w-2.5 h-2.5" fill="currentColor" />
                  {mvpMoms} MOM{mvpMoms > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Breakdown — hairline row, no boxes inside boxes */}
          <div className="relative grid grid-cols-3 mt-5 pt-4 border-t border-slate-200/70 dark:border-white/10">
            {[
              { v: mvp.player.batting_runs, k: 'Runs' },
              { v: mvp.player.bowling_wickets, k: 'Wickets' },
              { v: mvp.player.fielding_catches + mvp.player.fielding_stumpings + mvp.player.fielding_run_outs,
                k: 'Dismissals' },
            ].map((x, i) => (
              <div key={x.k} className={i > 0 ? 'pl-4 border-l border-slate-200/70 dark:border-white/10' : ''}>
                <p className="t-num text-lg lg:text-xl leading-none text-slate-900 dark:text-white">{x.v}</p>
                <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/40 mt-1">
                  {x.k}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── The specialists ──────────────────────────────────────────────
            Two by two on a phone, four across on a desktop. The old
            three-column grid left the keeper stranded on a row of its own. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {topBatsman && (
            <Specialist
              label="Top Batsman"
              icon={<TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />}
              tone={{ rule: 'bg-sky-400/70', chip: 'bg-sky-500/10 dark:bg-sky-400/15',
                      ink: 'text-sky-600 dark:text-sky-300' }}
              number={topBatsman.player.batting_runs}
              unit="runs"
              detail={topBatsman.player.batting_average > 0
                ? `Average ${topBatsman.player.batting_average.toFixed(1)}` : undefined}
              player={topBatsman.player}
              moms={momCounts[topBatsman.player.member_id] || 0}
            />
          )}

          {topBowler && (
            <Specialist
              label="Top Bowler"
              icon={<Zap className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" fill="currentColor" />}
              tone={{ rule: 'bg-rose-400/70', chip: 'bg-rose-500/10 dark:bg-rose-400/15',
                      ink: 'text-rose-600 dark:text-rose-300' }}
              number={topBowler.player.bowling_wickets}
              unit="wkts"
              detail={topBowler.player.bowling_economy > 0
                ? `Economy ${topBowler.player.bowling_economy.toFixed(1)}` : undefined}
              player={topBowler.player}
              moms={momCounts[topBowler.player.member_id] || 0}
            />
          )}

          {bestFielder && (
            <Specialist
              label="Best Fielder"
              icon={<Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
              tone={{ rule: 'bg-emerald-400/70', chip: 'bg-emerald-500/10 dark:bg-emerald-400/15',
                      ink: 'text-emerald-600 dark:text-emerald-300' }}
              number={bestFielder.total}
              unit="taken"
              detail={[
                bestFielder.player.fielding_catches > 0 ? `${bestFielder.player.fielding_catches} caught` : null,
                bestFielder.player.fielding_run_outs > 0 ? `${bestFielder.player.fielding_run_outs} run out` : null,
              ].filter(Boolean).join(' · ') || undefined}
              player={bestFielder.player}
              moms={momCounts[bestFielder.player.member_id] || 0}
            />
          )}

          {bestKeeper && (
            <Specialist
              label="Wicket-Keeper"
              icon={<Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
              tone={{ rule: 'bg-amber-400/70', chip: 'bg-amber-500/10 dark:bg-amber-400/15',
                      ink: 'text-amber-600 dark:text-amber-300' }}
              number={bestKeeper.total}
              unit="behind"
              detail={[
                (bestKeeper.player.fielding_caught_behind ?? 0) > 0
                  ? `${bestKeeper.player.fielding_caught_behind} caught` : null,
                bestKeeper.player.fielding_stumpings > 0
                  ? `${bestKeeper.player.fielding_stumpings} stumped` : null,
              ].filter(Boolean).join(' · ') || undefined}
              player={bestKeeper.player}
              moms={momCounts[bestKeeper.player.member_id] || 0}
            />
          )}
        </div>

      </div>
    </div>
  );
}

export default DashboardStars;
