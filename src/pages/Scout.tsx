import { useMemo, useState } from 'react';
import { Search, Shield, Swords, MapPin, TrendingUp, Trophy } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useCricketStats } from '../hooks/useCricketStats';
import { useHeadToHead } from '../hooks/useHeadToHead';

const HOME_GROUND = 'Four Star Cricket Ground, Hinjawadi Phase 2, Pune';

function FormDot({ r }: { r: 'W' | 'L' | 'N' }) {
  const cls = r === 'W' ? 'bg-emerald-500' : r === 'L' ? 'bg-red-500' : 'bg-gray-400';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-black ${cls}`}>
      {r}
    </span>
  );
}

/**
 * Public "Scouting Report" — what an opposing club sees before they play SCC.
 * Built to make outside teams engage (and want their own version): overall
 * record, current form, players to watch, and a searchable head-to-head so a
 * visiting captain can look up their own team's record vs SCC.
 */
export function Scout() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const { stats } = useCricketStats('2025-26');
  const h2h = useHeadToHead(matches);
  const [query, setQuery] = useState('');

  const overall = useMemo(() => {
    const ext = matches.filter(m => m.match_type === 'external');
    const decided = ext.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = decided.filter(m => m.result === 'won').length;
    const lost = decided.filter(m => m.result === 'lost').length;
    const nr = decided.filter(m => m.result === 'draw').length;
    const form = [...decided]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(m => (m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'N')) as Array<'W' | 'L' | 'N'>;
    return {
      played: decided.length,
      won, lost, nr,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      form,
    };
  }, [matches]);

  const keyPlayers = useMemo(() => {
    const byId: Record<string, { name: string; avatar_url: string | null }> = {};
    members.forEach(m => { byId[m.id] = { name: m.name, avatar_url: m.avatar_url ?? null }; });
    const withName = stats.filter(s => byId[s.member_id]);
    const topBat = [...withName].sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topBowl = [...withName].sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const topField = [...withName].sort((a, b) =>
      (b.fielding_catches + b.fielding_stumpings + b.fielding_run_outs) -
      (a.fielding_catches + a.fielding_stumpings + a.fielding_run_outs))[0];
    return {
      bat: topBat && topBat.batting_runs > 0
        ? { ...byId[topBat.member_id], stat: `${topBat.batting_runs} runs`, sub: topBat.batting_highest_score ? `HS ${topBat.batting_highest_score}` : '', role: 'Top Batter' }
        : null,
      bowl: topBowl && topBowl.bowling_wickets > 0
        ? { ...byId[topBowl.member_id], stat: `${topBowl.bowling_wickets} wkts`, sub: topBowl.bowling_best_figures ? `Best ${topBowl.bowling_best_figures}` : '', role: 'Top Bowler' }
        : null,
      field: topField && (topField.fielding_catches + topField.fielding_stumpings + topField.fielding_run_outs) > 0
        ? { ...byId[topField.member_id], stat: `${topField.fielding_catches + topField.fielding_stumpings + topField.fielding_run_outs} dismissals`, sub: 'Fielding', role: 'Best Fielder' }
        : null,
    };
  }, [stats, members]);

  const filteredH2H = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? h2h.filter(r => r.opponent.toLowerCase().includes(q)) : h2h;
  }, [h2h, query]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-emerald-700 via-emerald-800 to-gray-900">
        <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-widest">
          <Swords className="w-4 h-4" /> Scouting Report
        </div>
        <h1 className="text-2xl sm:text-3xl font-black mt-2">Playing Sangria Cricket Club?</h1>
        <p className="text-emerald-100/80 mt-1 text-sm">Here's exactly who you're up against. Do your homework. 🏏</p>
        <div className="flex items-center gap-2 mt-4 text-sm text-emerald-100/90">
          <MapPin className="w-4 h-4 shrink-0" /> Home ground: {HOME_GROUND}
        </div>
      </div>

      {/* Overall record */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Played', value: overall.played, color: 'text-gray-900 dark:text-white' },
          { label: 'Won', value: overall.won, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Lost', value: overall.lost, color: 'text-red-600 dark:text-red-400' },
          { label: 'Win %', value: `${overall.winRate}%`, color: 'text-amber-600 dark:text-amber-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent form */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">Current Form</h2>
          <span className="text-xs text-gray-400">last 5</span>
        </div>
        <div className="flex gap-2">
          {overall.form.length ? overall.form.map((r, i) => <FormDot key={i} r={r} />) : <span className="text-sm text-gray-400">No recent matches</span>}
        </div>
      </div>

      {/* Players to watch */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">Players to Watch</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[keyPlayers.bat, keyPlayers.bowl, keyPlayers.field].filter(Boolean).map((p, i) => (
            <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
              {p!.avatar_url ? (
                <img src={p!.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black">{p!.name.charAt(0)}</div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">{p!.role}</p>
                <p className="font-bold text-gray-900 dark:text-white truncate">{p!.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p!.stat}{p!.sub ? ` · ${p!.sub}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Head-to-head lookup */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-emerald-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">Find your team's record vs SCC</h2>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your team name…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4">Opponent</th>
                <th className="py-2 px-2 text-center">P</th>
                <th className="py-2 px-2 text-center">SCC W</th>
                <th className="py-2 px-2 text-center">SCC L</th>
                <th className="py-2 px-2 text-center">SCC Win%</th>
                <th className="py-2 pl-2">Last</th>
              </tr>
            </thead>
            <tbody>
              {filteredH2H.map(r => (
                <tr key={r.opponent} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{r.opponent}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{r.played}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-emerald-600 dark:text-emerald-400">{r.won}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-red-600 dark:text-red-400">{r.lost}</td>
                  <td className="py-2 px-2 text-center tabular-nums font-semibold">{r.winRate}%</td>
                  <td className="py-2 pl-2">
                    {r.lastResult && (
                      <span className={`text-xs font-bold ${r.lastResult === 'won' ? 'text-emerald-500' : r.lastResult === 'lost' ? 'text-red-500' : 'text-gray-400'}`}>
                        SCC {r.lastResult === 'won' ? 'won' : r.lastResult === 'lost' ? 'lost' : 'NR'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredH2H.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-sm">No record yet — you'd be the first to face us. 👀</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 text-white text-center bg-gradient-to-br from-violet-600 via-blue-600 to-gray-900">
        <h3 className="text-xl font-black">Think you can beat us?</h3>
        <p className="text-white/80 text-sm mt-1">Pick a date, pay online, get a confirmation — all in our app.</p>
        <a href="/book-match" className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-white text-gray-900 font-bold hover:bg-gray-100 transition">
          🏏 Book a Match vs SCC
        </a>
      </div>
    </div>
  );
}
