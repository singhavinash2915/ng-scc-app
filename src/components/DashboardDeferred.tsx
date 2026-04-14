import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Star, ChevronRight, Building2, ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { PhotoCarousel } from './PhotoCarousel';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useSponsor } from '../hooks/useSponsor';
import { useCricketStats } from '../hooks/useCricketStats';

export function DashboardDeferred() {
  const { photos: matchPhotos } = useMatchPhotos();
  const { sponsors } = useSponsor();
  const { stats: cricketStats } = useCricketStats();

  const topPerformers = useMemo(() => {
    if (!cricketStats.length) return [];
    const result: { player: typeof cricketStats[0]; label: string; stat: number | string; unit: string; gradient: string; icon: string }[] = [];
    const byMVP = [...cricketStats].sort((a, b) => {
      const scoreA = a.batting_runs + a.bowling_wickets * 20 + (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs) * 10;
      const scoreB = b.batting_runs + b.bowling_wickets * 20 + (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) * 10;
      return scoreB - scoreA;
    });
    if (byMVP[0]) result.push({ player: byMVP[0], label: 'Season MVP', stat: byMVP[0].batting_runs + byMVP[0].bowling_wickets * 20 + (byMVP[0].fielding_catches + byMVP[0].fielding_stumpings + byMVP[0].fielding_run_outs) * 10, unit: 'MVP pts', gradient: 'from-amber-500 to-yellow-500', icon: '👑' });
    const byRuns = [...cricketStats].sort((a, b) => b.batting_runs - a.batting_runs);
    if (byRuns[0]) result.push({ player: byRuns[0], label: 'Top Batsman', stat: byRuns[0].batting_runs, unit: 'runs', gradient: 'from-blue-500 to-indigo-500', icon: '🏏' });
    const byWkts = [...cricketStats].filter(s => s.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets);
    if (byWkts[0]) result.push({ player: byWkts[0], label: 'Top Bowler', stat: byWkts[0].bowling_wickets, unit: 'wickets', gradient: 'from-rose-500 to-red-600', icon: '⚡' });
    const byField = [...cricketStats].sort((a, b) => (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) - (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs));
    const fieldTotal = byField[0] ? byField[0].fielding_catches + byField[0].fielding_stumpings + byField[0].fielding_run_outs : 0;
    if (byField[0] && fieldTotal > 0) result.push({ player: byField[0], label: 'Best Fielder', stat: fieldTotal, unit: 'dismissals', gradient: 'from-emerald-500 to-green-600', icon: '🧤' });
    return result;
  }, [cricketStats]);

  return (
    <>
      {/* ── SEASON STARS ────────────────────────── */}
      {topPerformers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
              Season 2025–26 Stars
            </h2>
            <Link to="/leaderboard" className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 font-semibold">
              Full Leaderboard <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {topPerformers.map(({ player, label, stat, unit, gradient, icon }) => (
              <div key={`${player.member_id}-${label}`} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 shadow-lg group cursor-default`}>
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute -bottom-3 -left-3 w-10 h-10 bg-white/5 rounded-full" />
                <div className="text-xl mb-2 relative">{icon}</div>
                <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none relative">{stat}</p>
                <p className="text-white/55 text-[9px] uppercase tracking-wide relative mt-0.5">{unit}</p>
                <div className="mt-3 relative">
                  <p className="text-white text-xs font-bold truncate">{player.member?.name || '—'}</p>
                  <p className="text-white/50 text-[10px] truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PHOTO GALLERY ───────────────────────── */}
      {matchPhotos.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Camera className="w-3.5 h-3.5 text-primary-500" />
            Team Gallery
          </h2>
          <PhotoCarousel photos={matchPhotos} autoPlayInterval={5000} />
        </div>
      )}

      {/* ── SPONSOR BANNER ──────────────────────── */}
      {sponsors && sponsors.length > 0 && (
        <div className="space-y-3">
          {sponsors.map((s) => (
            <Card key={s.id} delay={0}>
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-3">Powered By</p>
                <div className="flex items-center gap-4">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="w-14 h-14 object-contain rounded-xl bg-gray-50 dark:bg-gray-700 p-1.5 flex-shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{s.name}</h3>
                    {s.tagline && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.tagline}</p>}
                    {s.member && <p className="text-xs text-gray-400 mt-0.5">SCC Member: {s.member.name}</p>}
                  </div>
                  {s.website_url && (
                    <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                      <ExternalLink className="w-4 h-4 text-gray-400 hover:text-primary-500" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default DashboardDeferred;
