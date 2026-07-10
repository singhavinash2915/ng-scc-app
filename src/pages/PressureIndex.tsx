import { useState } from 'react';
import { Flame, TrendingUp, Zap, Trophy, Info } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { usePressureIndex, type PressureRow } from '../hooks/usePressureIndex';
import type { Member } from '../types';

type Tab = 'batting' | 'bowling' | 'overall';

function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  return member.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>{member.name.charAt(0)}</div>
  );
}

export function PressureIndex() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const { scorecards } = useAllScorecards();
  const { batting, bowling, overall, pressureMatchCount, loading } = usePressureIndex(matches, members, scorecards);
  const [tab, setTab] = useState<Tab>('overall');
  const [showHow, setShowHow] = useState(false);

  const rows = tab === 'batting' ? batting : tab === 'bowling' ? bowling : overall;
  const metricLabel = (r: PressureRow) =>
    tab === 'bowling' ? `${r.pressureWkts} pw`
    : tab === 'batting' ? `${r.pressureRuns.toLocaleString('en-IN')} pr`
    : `${Math.round(r.pressureRuns + r.pressureWkts * 20).toLocaleString('en-IN')} pts`;
  const subLabel = (r: PressureRow) =>
    tab === 'bowling'
      ? `${r.rawWkts} wkts in pressure games`
      : tab === 'batting'
        ? `${r.rawRuns} runs · ${r.pInnings} inn · avg ${r.pAvg.toFixed(1)}`
        : `${r.rawRuns} runs · ${r.rawWkts} wkts under pressure`;

  const tabs: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: 'overall', label: 'Overall', icon: Trophy },
    { id: 'batting', label: 'Batting', icon: TrendingUp },
    { id: 'bowling', label: 'Bowling', icon: Zap },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Pressure Index" subtitle="Who delivers when it matters most" />
      <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">

        {/* Hero */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#b91c1c,#ea580c 60%,#f59e0b)' }}>
          <Flame className="w-9 h-9 drop-shadow" />
          <h2 className="font-display text-2xl font-extrabold mt-2">Pressure Performance Index 🔥</h2>
          <p className="text-white/85 text-sm mt-1">
            Runs and wickets in <b>tight, low-scoring, knockout & losing games</b> — weighted by the heat of the moment
            <b> and how strong the opponent was</b>. Anyone can score in a stroll; this is who stands up when it's hard.
          </p>
          <p className="text-white/70 text-xs mt-2">Based on {pressureMatchCount} high-pressure matches this club has played.</p>
        </div>

        {/* How it works */}
        <div className="glass rounded-2xl overflow-hidden">
          <button onClick={() => setShowHow(s => !s)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
            <Info className="w-4 h-4 text-rose-500" />
            <span className="flex-1 text-sm font-bold text-slate-800 dark:text-white">How is pressure measured?</span>
            <span className="text-slate-400 text-xs">{showHow ? '▲' : '▼'}</span>
          </button>
          {showHow && (
            <div className="px-4 pb-4 text-[13px] leading-relaxed text-slate-600 dark:text-white/70 space-y-2">
              <p>Each match gets a <b>pressure weight</b> (1.0 = ordinary, up to ~2.6 = white-knuckle). It goes up when:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>🔥 <b>Close finish</b> — the smaller the margin, the bigger the weight</li>
                <li>🧱 <b>Low-scoring game</b> — every run &amp; wicket is precious</li>
                <li>🏆 <b>Knockout stage</b> — final / semi / eliminator</li>
                <li>💪 <b>You stood up in a defeat</b> — the team fell short, you didn't</li>
              </ul>
              <p>That weight is then <b>multiplied by opponent strength</b> (0.8×–1.25×): teams with a better head-to-head record against us count for more, so runs &amp; wickets against a bogey side are worth more than against a soft one.</p>
              <p>Your <b>pressure runs / wickets</b> = actual runs &amp; wickets × match weight × opponent strength, summed over every pressure game. The index scales the squad to 0–1000.</p>
              <p className="text-slate-500 dark:text-white/60">Only genuinely tense matches count — routine wins are excluded.</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                tab === t.id ? 'bg-rose-500 text-white shadow' : 'glass text-slate-600 dark:text-white/70'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="glass rounded-2xl p-4">
          {loading ? (
            <p className="text-center text-slate-400 py-8 text-sm">Loading scorecards…</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No pressure-match data yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 15).map((r, i) => (
                <div key={r.member.id} className={`flex items-center gap-3 rounded-xl p-2.5 ${i === 0 ? 'bg-rose-500/10 ring-1 ring-rose-400/40' : ''}`}>
                  <span className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-rose-500' : 'text-slate-400'}`}>{i + 1}</span>
                  <Avatar member={r.member} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{r.member.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-white/50">{subLabel(r)}</p>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style={{ width: `${r.index / 10}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-extrabold text-rose-600 dark:text-rose-400">{metricLabel(r)}</p>
                    <p className="text-[10px] text-slate-400">{r.index}/1000</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 text-center mt-3">pr = pressure runs · pw = pressure wickets · pts = runs + wickets×20 (pressure-weighted)</p>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
