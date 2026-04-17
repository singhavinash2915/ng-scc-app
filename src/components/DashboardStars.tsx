import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronRight, Crown, TrendingUp, Zap, Shield } from 'lucide-react';
import { useCricketStats } from '../hooks/useCricketStats';

interface DashboardStarsProps {
  momCounts?: Record<string, number>;
}

export function DashboardStars({ momCounts = {} }: DashboardStarsProps) {
  const { stats: cricketStats } = useCricketStats('2025-26');

  const { mvp, topBatsman, topBowler, bestFielder } = useMemo(() => {
    if (!cricketStats.length) {
      return { mvp: null, topBatsman: null, topBowler: null, bestFielder: null };
    }
    const score = (s: typeof cricketStats[0]) =>
      s.batting_runs + s.bowling_wickets * 20 +
      (s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs) * 10;

    const byMVP = [...cricketStats].sort((a, b) => score(b) - score(a));
    const byRuns = [...cricketStats].sort((a, b) => b.batting_runs - a.batting_runs);
    const byWkts = [...cricketStats].filter(s => s.bowling_wickets > 0)
      .sort((a, b) => b.bowling_wickets - a.bowling_wickets);
    const byField = [...cricketStats].sort((a, b) =>
      (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) -
      (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs));
    const fieldTotal = (s: typeof cricketStats[0]) =>
      s.fielding_catches + s.fielding_stumpings + s.fielding_run_outs;

    return {
      mvp: byMVP[0] ? { player: byMVP[0], points: score(byMVP[0]) } : null,
      topBatsman: byRuns[0] ? { player: byRuns[0] } : null,
      topBowler: byWkts[0] ? { player: byWkts[0] } : null,
      bestFielder: byField[0] && fieldTotal(byField[0]) > 0
        ? { player: byField[0], total: fieldTotal(byField[0]) } : null,
    };
  }, [cricketStats]);

  if (!mvp) return null;

  const getAvatar = (m: unknown) => (m as { avatar_url?: string } | undefined)?.avatar_url;
  const getName = (m: unknown) => (m as { name?: string } | undefined)?.name || '—';

  const mvpAvatar = getAvatar(mvp.player.member);
  const mvpName = getName(mvp.player.member);
  const mvpMoms = momCounts[mvp.player.member_id] || 0;

  // Specialist card helper — shared props
  const Specialist = ({
    label, icon, color, number, subtitle, player, moms,
  }: {
    label: string;
    icon: React.ReactNode;
    color: { bg: string; border: string; accent: string; glow: string; numText: string };
    number: number | string;
    subtitle: string;
    player: typeof cricketStats[0];
    moms: number;
  }) => {
    const avatar = getAvatar(player.member);
    const name = getName(player.member);
    return (
      <div className="relative overflow-hidden rounded-2xl p-5 lg:p-6 flex flex-col min-h-[200px]"
           style={{ background: color.bg }}>
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `1px solid ${color.border}` }} />
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: color.glow }} />

        <div className="flex items-center justify-between mb-1 relative">
          <div className={`flex items-center gap-1.5 ${color.accent}`}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: color.glow }}>
              {icon}
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-[2px] ${color.accent}`}>{label}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center relative py-2">
          <div className="text-5xl lg:text-6xl font-black text-white tabular-nums leading-none"
               style={{ background: color.numText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {number}
          </div>
          <div className="text-[10px] text-gray-400 uppercase tracking-[1.5px] font-bold mt-2">{subtitle}</div>
        </div>

        <div className="relative pt-3 border-t border-white/8 flex items-center gap-2.5">
          {avatar ? (
            <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-white/15 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color.glow }}>
              <span className="text-xs font-black text-white">{name.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate leading-tight">{name.split(' ').slice(0, 2).join(' ')}</div>
          </div>
          {moms > 0 && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black flex-shrink-0">
              <Crown className="w-2.5 h-2.5" fill="currentColor" />{moms}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
          Season 2025–26 Stars
        </h2>
        <Link to="/leaderboard" className="text-xs text-primary-500 dark:text-primary-400 flex items-center gap-0.5 font-semibold">
          Full Leaderboard <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">

        {/* ── MVP HERO CARD (full width, featured) ────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8"
             style={{
               background: 'radial-gradient(600px circle at 10% 0%, rgba(251,191,36,0.3), transparent 50%), radial-gradient(800px circle at 100% 100%, rgba(245,158,11,0.15), transparent 60%), linear-gradient(135deg, #78350f 0%, #1a0f05 60%, #0a1019 100%)',
             }}>
          <div className="absolute inset-0 border border-amber-500/30 rounded-3xl pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -translate-y-1/2 right-10 w-1 h-24 bg-gradient-to-b from-transparent via-amber-400/30 to-transparent hidden lg:block" />

          {/* Decorative MVP trophy emoji in background */}
          <div className="absolute top-4 right-8 text-8xl opacity-[0.04] select-none pointer-events-none">🏆</div>

          <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">

            {/* Left: Avatar + identity */}
            <div className="flex items-center gap-5 flex-shrink-0">
              <div className="relative flex-shrink-0">
                {mvpAvatar ? (
                  <img src={mvpAvatar} alt=""
                       className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl object-cover border-[3px] border-amber-400/50 shadow-2xl shadow-amber-500/40" />
                ) : (
                  <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 border-[3px] border-amber-400/50 flex items-center justify-center shadow-2xl shadow-amber-500/40">
                    <span className="text-4xl font-black text-yellow-950">{mvpName.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/50 border-2 border-amber-900/20">
                  <Crown className="w-4 h-4 text-yellow-950" fill="currentColor" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-300/80 text-[10px] font-bold uppercase tracking-[2px]">Season MVP</span>
                  {mvpMoms > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black">
                      <Crown className="w-2.5 h-2.5" fill="currentColor" />
                      {mvpMoms} MOM{mvpMoms > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl lg:text-3xl font-black text-white leading-tight tracking-tight">{mvpName}</h3>
                <p className="text-amber-200/50 text-xs mt-0.5 font-medium">The all-rounder leading the pack</p>
              </div>
            </div>

            {/* Right: Points + Breakdown */}
            <div className="flex-1 min-w-0 lg:pl-8 lg:border-l lg:border-amber-500/15">

              {/* Big points number */}
              <div className="flex items-baseline gap-2 lg:justify-end">
                <span className="text-6xl lg:text-7xl font-black tabular-nums leading-none"
                      style={{ background: 'linear-gradient(180deg, #fff 30%, #fde68a 70%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {mvp.points}
                </span>
                <span className="text-amber-300/70 text-xs font-bold uppercase tracking-[2px]">pts</span>
              </div>

              {/* Breakdown stats row */}
              <div className="grid grid-cols-3 gap-3 mt-4 lg:mt-5 pt-4 border-t border-amber-500/15">
                <div className="text-center lg:text-left">
                  <div className="text-xl lg:text-2xl font-black text-white tabular-nums leading-none">
                    {mvp.player.batting_runs}
                  </div>
                  <div className="text-[9px] text-amber-300/60 uppercase tracking-widest font-bold mt-1">Runs</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-xl lg:text-2xl font-black text-white tabular-nums leading-none">
                    {mvp.player.bowling_wickets}
                  </div>
                  <div className="text-[9px] text-amber-300/60 uppercase tracking-widest font-bold mt-1">Wickets</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-xl lg:text-2xl font-black text-white tabular-nums leading-none">
                    {mvp.player.fielding_catches + mvp.player.fielding_stumpings + mvp.player.fielding_run_outs}
                  </div>
                  <div className="text-[9px] text-amber-300/60 uppercase tracking-widest font-bold mt-1">Dismissals</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 SPECIALIST CARDS (equal 1/3 width) ────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topBatsman && (
            <Specialist
              label="Top Batsman"
              icon={<TrendingUp className="w-3.5 h-3.5 text-blue-300" />}
              color={{
                bg: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)',
                border: 'rgba(59, 130, 246, 0.3)',
                accent: 'text-blue-300/80',
                glow: 'rgba(59, 130, 246, 0.25)',
                numText: 'linear-gradient(180deg, #fff 30%, #93c5fd 100%)',
              }}
              number={topBatsman.player.batting_runs}
              subtitle={`Runs · Avg ${topBatsman.player.batting_average.toFixed(1)}`}
              player={topBatsman.player}
              moms={momCounts[topBatsman.player.member_id] || 0}
            />
          )}

          {topBowler && (
            <Specialist
              label="Top Bowler"
              icon={<Zap className="w-3.5 h-3.5 text-red-300" fill="currentColor" />}
              color={{
                bg: 'linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)',
                border: 'rgba(239, 68, 68, 0.3)',
                accent: 'text-red-300/80',
                glow: 'rgba(239, 68, 68, 0.25)',
                numText: 'linear-gradient(180deg, #fff 30%, #fca5a5 100%)',
              }}
              number={topBowler.player.bowling_wickets}
              subtitle={`Wickets${topBowler.player.bowling_economy > 0 ? ` · Eco ${topBowler.player.bowling_economy.toFixed(1)}` : ''}`}
              player={topBowler.player}
              moms={momCounts[topBowler.player.member_id] || 0}
            />
          )}

          {bestFielder && (
            <Specialist
              label="Best Fielder"
              icon={<Shield className="w-3.5 h-3.5 text-emerald-300" />}
              color={{
                bg: 'linear-gradient(135deg, #065f46 0%, #0a1019 100%)',
                border: 'rgba(16, 185, 129, 0.3)',
                accent: 'text-emerald-300/80',
                glow: 'rgba(16, 185, 129, 0.25)',
                numText: 'linear-gradient(180deg, #fff 30%, #6ee7b7 100%)',
              }}
              number={bestFielder.total}
              subtitle={`Dismissals · ${bestFielder.player.fielding_catches}c${bestFielder.player.fielding_stumpings > 0 ? ` · ${bestFielder.player.fielding_stumpings}st` : ''}${bestFielder.player.fielding_run_outs > 0 ? ` · ${bestFielder.player.fielding_run_outs}ro` : ''}`}
              player={bestFielder.player}
              moms={momCounts[bestFielder.player.member_id] || 0}
            />
          )}
        </div>

      </div>
    </div>
  );
}

export default DashboardStars;
