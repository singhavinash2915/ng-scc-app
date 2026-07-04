import { Link } from 'react-router-dom';
import { Trophy, CalendarDays, Crown, TrendingUp, MapPin, Star } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useSeasonLeague } from '../hooks/useSeasonLeague';
import type { Match, Member } from '../types';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  return member.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {member.name.charAt(0)}
    </div>
  );
}

function ResultBadge({ result }: { result: Match['result'] }) {
  const map: Record<string, string> = {
    won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draw: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[result] ?? map.draw}`}>{result === 'draw' ? 'No result' : result}</span>;
}

export function SeasonLeague() {
  const lg = useSeasonLeague();

  return (
    <div className="aurora-bg min-h-screen">
      <Header title="Season League" subtitle={`${lg.name} · ${lg.window}`} />
      <div className="p-4 lg:p-8 space-y-4 max-w-3xl mx-auto">

        {/* ── Hero / record ─────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-12 right-0 w-52 h-52 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(251,191,36,0.16)' }} />
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-200">
            <Trophy className="w-5 h-5" fill="currentColor" />
            <span className="text-[11px] font-black uppercase tracking-[2px]">Club League</span>
          </div>
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">{lg.name} 🏆</h2>
          <p className="text-slate-500 dark:text-white/60 text-sm mt-0.5">
            {lg.played.length} played · {lg.upcoming.length} to come · {lg.totalFixtures} fixtures
          </p>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Won', value: lg.won, tone: 'text-green-600 dark:text-green-400' },
              { label: 'Lost', value: lg.lost, tone: 'text-red-500 dark:text-red-400' },
              { label: 'Win %', value: `${lg.winPct}%`, tone: 'text-slate-900 dark:text-white' },
              { label: 'Points', value: lg.points, tone: 'text-amber-600 dark:text-amber-300' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/60 dark:bg-white/5 p-2.5 text-center">
                <p className={`font-display text-xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/50 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fixtures (upcoming) ───────────────────────────────────────── */}
        {lg.upcoming.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-primary-600 dark:text-primary-300 mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Fixtures
            </p>
            <div className="space-y-2">
              {lg.upcoming.map(m => (
                <Link key={m.id} to="/matches" className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition p-3">
                  <div className="text-center min-w-[54px]">
                    <p className="font-display text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{fmtDate(m.date).split(',')[1]?.trim() ?? fmtDate(m.date)}</p>
                    <p className="text-[10px] uppercase text-slate-400 dark:text-white/50">{fmtDate(m.date).split(',')[0]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">vs {m.opponent || 'TBD'}</p>
                    {m.venue && <p className="text-xs text-slate-400 dark:text-white/50 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {m.venue}</p>}
                  </div>
                  <span className="text-[10px] font-bold uppercase text-primary-500">Upcoming</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Results (played) ──────────────────────────────────────────── */}
        {lg.played.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-500 dark:text-white/60 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Results
            </p>
            <div className="space-y-2">
              {[...lg.played].reverse().map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-3">
                  <div className="text-center min-w-[54px]">
                    <p className="text-xs font-bold text-slate-500 dark:text-white/60">{fmtDate(m.date)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">vs {m.opponent || 'Unknown'}</p>
                    {(m.our_score || m.opponent_score) && (
                      <p className="text-xs text-slate-400 dark:text-white/50 truncate">{m.our_score || '—'} · {m.opponent_score || '—'}</p>
                    )}
                    {m.man_of_match && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-300 flex items-center gap-1 mt-0.5"><Star className="w-3 h-3" fill="currentColor" /> {m.man_of_match.name}</p>
                    )}
                  </div>
                  <ResultBadge result={m.result} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── League leaders ────────────────────────────────────────────── */}
        {(lg.topBatter || lg.topBowler || lg.momLeaders.length > 0) && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-200 mb-3 flex items-center gap-1.5">
              <Crown className="w-4 h-4" fill="currentColor" /> League Leaders
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lg.topBatter && (
                <div className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-3">
                  <Avatar member={lg.topBatter.member} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-white/50">🏏 Most Runs</p>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{lg.topBatter.member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/60">{lg.topBatter.value} {lg.topBatter.label}</p>
                  </div>
                </div>
              )}
              {lg.topBowler && (
                <div className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-3">
                  <Avatar member={lg.topBowler.member} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-white/50">🎯 Most Wickets</p>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{lg.topBowler.member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/60">{lg.topBowler.value} {lg.topBowler.label}</p>
                  </div>
                </div>
              )}
            </div>
            {lg.momLeaders.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-white/50 mb-2">⭐ Man of the Match</p>
                <div className="flex flex-wrap gap-2">
                  {lg.momLeaders.map(l => (
                    <div key={l.member.id} className="flex items-center gap-1.5 rounded-full bg-white/60 dark:bg-white/5 pl-1 pr-3 py-1">
                      <Avatar member={l.member} size={24} />
                      <span className="text-xs font-medium text-slate-700 dark:text-white/80">{l.member.name}</span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-300">×{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty / pre-season state ──────────────────────────────────── */}
        {lg.totalFixtures === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Trophy className="w-10 h-10 text-slate-300 dark:text-white/20 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-white mt-3">No league matches yet</p>
            <p className="text-sm text-slate-400 dark:text-white/50 mt-1">Fixtures appear here automatically as they sync from CricHeroes.</p>
          </div>
        ) : lg.played.length === 0 && (
          <p className="text-center text-xs text-slate-400 dark:text-white/50 pb-2">
            The season kicks off soon — results, standings & leaders fill in as matches are played. 🏏
          </p>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
