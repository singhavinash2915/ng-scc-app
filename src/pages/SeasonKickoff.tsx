import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, CalendarDays, Trophy, Swords, Coins, Target as TargetIcon, Sparkles, Gavel, Check, Users } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MyStatsButton } from '../components/MyStatsButton';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useCricketStats } from '../hooks/useCricketStats';
import { useSeasonLeague } from '../hooks/useSeasonLeague';
import { useMarketValue, formatValue } from '../hooks/useMarketValue';
import { useSeasonPredictions } from '../hooks/useSeasonPredictions';
import { useMemberGoals } from '../hooks/useMemberGoals';
import { SEASON_AWARDS } from '../config/seasonAwards';
import { SEASON_NEW, SEASON_PREV_START, SEASON_PREV_END, AUCTION_NIGHT } from '../config/season2';
import type { Member } from '../types';

const PROFILE_KEY = 'scc-my-profile-id';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// ─── Live countdown to the first ball ─────────────────────────────────────────
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const diff = new Date(target + 'T07:00:00').getTime() - now;
  if (diff <= 0) return <p className="font-display text-2xl font-extrabold">It's game day! 🏏</p>;
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000),
    m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  const cell = (v: number, l: string) => (
    <div className="text-center bg-white/15 backdrop-blur rounded-2xl px-3 py-2 min-w-[62px]">
      <div className="font-display text-2xl font-extrabold tabular-nums leading-none">{String(v).padStart(2, '0')}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-white/70">{l}</div>
    </div>
  );
  return <div className="flex gap-2 justify-center">{cell(d, 'Days')}{cell(h, 'Hrs')}{cell(m, 'Min')}{cell(s, 'Sec')}</div>;
}

export function SeasonKickoff() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { scorecards } = useAllScorecards();
  const { stats: newStats } = useCricketStats(SEASON_NEW);
  const league = useSeasonLeague();
  const values = useMarketValue(matches, members, scorecards);
  const predictions = useSeasonPredictions(SEASON_NEW);
  const goalsApi = useMemberGoals(SEASON_NEW);

  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => { setMyId(localStorage.getItem(PROFILE_KEY)); }, []);

  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>, [members]);
  const pool = useMemo(() => members.filter(m => m.status === 'active' || m.matches_played > 0)
    .sort((a, b) => a.name.localeCompare(b.name)), [members]);

  const firstFixture = league.upcoming[0] ?? null;
  const seasonStarted = league.played.length > 0;

  // Champions strip — resolve avatars for last season's winners
  const champions = useMemo(() => SEASON_AWARDS.map(w => {
    const m = members.find(x => norm(x.name) === norm(w.match)) ?? members.find(x => norm(x.name.split(' ')[0]) === norm(w.match.split(' ')[0]));
    return { ...w, memberRec: m, shownName: w.display ?? m?.name ?? w.match };
  }), [members]);

  // Revenge meter — opponents who had our number last season
  const revenge = useMemo(() => {
    const rec: Record<string, { w: number; l: number }> = {};
    for (const m of matches) {
      if (m.match_type === 'internal' || !m.opponent) continue;
      if (!['won', 'lost'].includes(m.result)) continue;
      if (m.date < SEASON_PREV_START || m.date > SEASON_PREV_END) continue;
      const k = m.opponent.trim();
      rec[k] ??= { w: 0, l: 0 };
      if (m.result === 'won') rec[k].w++; else rec[k].l++;
    }
    return Object.entries(rec)
      .filter(([, r]) => r.l > r.w)
      .sort((a, b) => (b[1].l - b[1].w) - (a[1].l - a[1].w))
      .slice(0, 4);
  }, [matches]);

  // ── Prediction slip state ────────────────────────────────────────────────
  const mySlip = predictions.myPrediction(myId);
  const [topScorer, setTopScorer] = useState('');
  const [topWkt, setTopWkt] = useState('');
  const [mvp, setMvp] = useState('');
  const [wins, setWins] = useState('');
  const [slipSaving, setSlipSaving] = useState(false);
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  useEffect(() => {
    if (mySlip) {
      setTopScorer(mySlip.top_scorer_id ?? ''); setTopWkt(mySlip.top_wicket_taker_id ?? '');
      setMvp(mySlip.mvp_id ?? ''); setWins(mySlip.predicted_wins != null ? String(mySlip.predicted_wins) : '');
    }
  }, [mySlip]);

  async function saveSlip() {
    if (!myId) return;
    setSlipSaving(true); setSlipMsg(null);
    const res = await predictions.submit({
      memberId: myId,
      topScorerId: topScorer || null,
      topWicketTakerId: topWkt || null,
      mvpId: mvp || null,
      predictedWins: wins === '' ? null : Math.max(0, Math.min(30, parseInt(wins, 10) || 0)),
    });
    setSlipSaving(false);
    setSlipMsg(res.success ? '✓ Slip locked in! Scored when the season ends.' : `Could not save: ${res.error}`);
  }

  // ── Goals state ──────────────────────────────────────────────────────────
  const myGoal = goalsApi.myGoal(myId);
  const [goalRuns, setGoalRuns] = useState('');
  const [goalWkts, setGoalWkts] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMsg, setGoalMsg] = useState<string | null>(null);
  useEffect(() => {
    if (myGoal) {
      setGoalRuns(myGoal.goal_runs != null ? String(myGoal.goal_runs) : '');
      setGoalWkts(myGoal.goal_wickets != null ? String(myGoal.goal_wickets) : '');
    }
  }, [myGoal]);
  const myNewStats = useMemo(() => newStats.find(s => s.member_id === myId), [newStats, myId]);

  async function saveGoals() {
    if (!myId) return;
    setGoalSaving(true); setGoalMsg(null);
    const res = await goalsApi.saveGoal(myId,
      goalRuns === '' ? null : parseInt(goalRuns, 10) || 0,
      goalWkts === '' ? null : parseInt(goalWkts, 10) || 0);
    setGoalSaving(false);
    setGoalMsg(res.success ? '✓ Goals set. Chase them down! 🏃' : `Could not save: ${res.error}`);
  }

  const selectCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900';
  const migrationNeeded = predictions.tableMissing || goalsApi.tableMissing;

  const backedName = (id: string) => memberById[id]?.name?.split(' ')[0] ?? '?';

  return (
    <div className="min-h-screen aurora-bg">
      <Header title="Season Kickoff" subtitle={`Sangria Cricket Club · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── HERO + COUNTDOWN ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#065f46,#059669 45%,#0ea5e9)' }}>
          <div className="absolute -top-14 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[2px]">
            <Rocket className="w-3.5 h-3.5" /> New Season
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 drop-shadow">Season {SEASON_NEW} 🏏</h1>
          {firstFixture ? (
            <>
              <p className="text-white/85 text-sm mt-1.5 font-medium">
                First ball: <b>{new Date(firstFixture.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</b> vs <b>{firstFixture.opponent}</b>
              </p>
              <div className="mt-4"><Countdown target={firstFixture.date} /></div>
            </>
          ) : (
            <p className="text-white/80 text-sm mt-2">Fixtures land here as they're booked on CricHeroes.</p>
          )}
          <p className="text-white/70 text-xs mt-4">{league.totalFixtures} league fixtures · Sangria Cricket Club League {SEASON_NEW}</p>
        </div>

        {migrationNeeded && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 text-center">
            ⚙️ Predictions &amp; goals go live once <code>add_season2_features.sql</code> is run in Supabase.
          </div>
        )}

        {/* ── DEFENDING CHAMPIONS ──────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 mb-3 flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Defending champions · {`2025-26`}
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {champions.map(c => (
              <Link key={c.key} to="/awards" className="flex-shrink-0 w-28 rounded-2xl bg-white/70 border border-amber-100 p-3 text-center hover:shadow-md transition">
                <div className="w-12 h-12 rounded-full overflow-hidden mx-auto border-2 border-amber-300 bg-amber-50 flex items-center justify-center">
                  {c.memberRec?.avatar_url
                    ? <img src={c.memberRec.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="font-black text-amber-600">{c.shownName.charAt(0)}</span>}
                </div>
                <p className="text-lg leading-none mt-1.5">{c.emoji}</p>
                <p className="text-[11px] font-bold text-slate-800 leading-tight mt-0.5 truncate">{c.shownName.split(' ')[0]}</p>
                <p className="text-[9px] text-slate-400 leading-tight">{c.title}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── FIXTURES ─────────────────────────────────────────────────────── */}
        {league.upcoming.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-primary-600 mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> The road ahead
            </p>
            <div className="space-y-1.5">
              {league.upcoming.slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/60 px-3 py-2">
                  <span className="text-xs font-bold text-slate-500 min-w-[64px]">{new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-800 truncate">vs {m.opponent || 'TBD'}</span>
                  <Link to="/league" className="text-[10px] font-bold text-primary-500">League →</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REVENGE METER ────────────────────────────────────────────────── */}
        {revenge.length > 0 && (
          <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(120deg,#7f1d1d,#b91c1c 60%,#ea580c)' }}>
            <p className="text-[11px] font-black uppercase tracking-[2px] text-white/90 mb-1 flex items-center gap-1.5">
              <Swords className="w-4 h-4" /> Unfinished business
            </p>
            <p className="text-white/75 text-xs mb-3">Teams that had our number last season. This year, we collect. 😤</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {revenge.map(([opp, r]) => (
                <div key={opp} className="rounded-xl bg-white/10 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-bold truncate">{opp}</span>
                  <span className="text-xs font-black text-white/85 tabular-nums shrink-0 ml-2">{r.w}–{r.l} 😡</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRE-SEASON PREDICTIONS ───────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-violet-600 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Pre-season predictions
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Call your shots before a ball is bowled — slips lock at the first ball, bragging rights settle in June. 🔮
          </p>
          {!myId ? (
            <div className="text-center py-3">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-slate-600 mb-2">Pick your profile to make your calls</p>
              <div className="flex justify-center"><MyStatsButton /></div>
            </div>
          ) : seasonStarted ? (
            <p className="text-sm text-slate-500">🔒 The season is underway — predictions are locked.{mySlip ? ' Your slip is in!' : ''}</p>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([['🏏 Top run-scorer', topScorer, setTopScorer], ['🎯 Top wicket-taker', topWkt, setTopWkt], ['👑 Season MVP', mvp, setMvp]] as const).map(([label, val, set]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
                    <select value={val} onChange={e => set(e.target.value)} className={selectCls}>
                      <option value="">Pick a player…</option>
                      {pool.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">🏆 League wins ({league.totalFixtures} fixtures)</p>
                  <input type="number" min={0} max={30} value={wins} onChange={e => setWins(e.target.value)} placeholder="e.g. 5" className={selectCls} />
                </div>
                <button onClick={saveSlip} disabled={slipSaving || predictions.tableMissing}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-sm px-5 py-2.5">
                  {slipSaving ? 'Saving…' : mySlip ? 'Update slip' : 'Lock it in'}
                </button>
              </div>
              {slipMsg && <p className={`text-xs font-semibold ${slipMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{slipMsg}</p>}
            </div>
          )}
          {predictions.tally.slips > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-600">The squad is backing ({predictions.tally.slips} slips):</p>
              {predictions.tally.topScorer[0] && <p>🏏 Top scorer: <b>{backedName(predictions.tally.topScorer[0].id)}</b> ({predictions.tally.topScorer[0].n} picks)</p>}
              {predictions.tally.topWicketTaker[0] && <p>🎯 Top wickets: <b>{backedName(predictions.tally.topWicketTaker[0].id)}</b> ({predictions.tally.topWicketTaker[0].n} picks)</p>}
              {predictions.tally.mvp[0] && <p>👑 MVP: <b>{backedName(predictions.tally.mvp[0].id)}</b> ({predictions.tally.mvp[0].n} picks)</p>}
              {predictions.tally.avgWins != null && <p>🏆 Average predicted wins: <b>{predictions.tally.avgWins.toFixed(1)}</b></p>}
            </div>
          )}
        </div>

        {/* ── MY SEASON GOALS ──────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-emerald-600 mb-1 flex items-center gap-1.5">
            <TargetIcon className="w-4 h-4" /> My season goals
          </p>
          <p className="text-xs text-slate-500 mb-3">Set your targets — the app tracks your chase automatically all season.</p>
          {!myId ? (
            <div className="flex justify-center"><MyStatsButton /></div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">🏏 Runs target</p>
                  <input type="number" min={0} value={goalRuns} onChange={e => setGoalRuns(e.target.value)} placeholder="e.g. 600" className={selectCls} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">🎯 Wickets target</p>
                  <input type="number" min={0} value={goalWkts} onChange={e => setGoalWkts(e.target.value)} placeholder="e.g. 40" className={selectCls} />
                </div>
              </div>
              <button onClick={saveGoals} disabled={goalSaving || goalsApi.tableMissing}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm py-2.5">
                {goalSaving ? 'Saving…' : myGoal ? 'Update goals' : 'Set my goals'}
              </button>
              {goalMsg && <p className={`text-xs font-semibold ${goalMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{goalMsg}</p>}
              {myGoal && (
                <div className="space-y-2 pt-1">
                  {myGoal.goal_runs ? (
                    <GoalBar label="Runs" cur={myNewStats?.batting_runs ?? 0} target={myGoal.goal_runs} />
                  ) : null}
                  {myGoal.goal_wickets ? (
                    <GoalBar label="Wickets" cur={myNewStats?.bowling_wickets ?? 0} target={myGoal.goal_wickets} />
                  ) : null}
                  {!seasonStarted && <p className="text-[11px] text-slate-400">Season hasn't started — your chase begins at the first ball. 🏁</p>}
                </div>
              )}
            </div>
          )}
          {goalsApi.goals.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-600 mb-1.5">Squad goals 💪</p>
              <div className="flex flex-wrap gap-1.5">
                {goalsApi.goals.map(g => (
                  <span key={g.id} className="text-[11px] bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 font-semibold">
                    {memberById[g.member_id]?.name?.split(' ')[0] ?? '?'}: {g.goal_runs ? `${g.goal_runs}r` : ''}{g.goal_runs && g.goal_wickets ? ' · ' : ''}{g.goal_wickets ? `${g.goal_wickets}w` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── PLAYER MARKET VALUES ─────────────────────────────────────────── */}
        {values.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 mb-1 flex items-center gap-1.5">
              <Coins className="w-4 h-4" /> Player market values
            </p>
            <p className="text-xs text-slate-500 mb-3">Auction-style price tags from current form (ICC-style ratings). Perform → price rises. 📈</p>
            <div className="space-y-1.5">
              {values.slice(0, 12).map((v, i) => (
                <div key={v.member.id} className="flex items-center gap-2.5 rounded-xl bg-white/60 px-3 py-2">
                  <span className={`w-5 text-center text-xs font-black ${i < 3 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                  {v.member.avatar_url
                    ? <img src={v.member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    : <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-xs font-black text-amber-600">{v.member.name.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{v.member.name}</p>
                    <p className="text-[10px] text-slate-400">{v.discipline} · rating {v.rating}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase rounded-full px-2 py-0.5 ${v.tier.cls}`}>{v.tier.emoji} {v.tier.label}</span>
                  <span className="text-sm font-black text-amber-600 tabular-nums min-w-[64px] text-right">{formatValue(v.valueLakh)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FANTASY CTA + AUCTION NIGHT ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/fantasy" className="rounded-2xl p-4 text-white shadow-lg block"
            style={{ background: 'linear-gradient(120deg,#7c3aed,#2563eb)' }}>
            <p className="text-2xl">🧢</p>
            <p className="font-black text-base mt-1">Fantasy Draft {SEASON_NEW}</p>
            <p className="text-white/80 text-xs mt-0.5">Draft your XI before the first ball — prices set by last season's form. →</p>
          </Link>
          <div className="rounded-2xl p-4 text-white shadow-lg" style={{ background: 'linear-gradient(120deg,#92400e,#d97706)' }}>
            <p className="text-2xl"><Gavel className="w-7 h-7" /></p>
            <p className="font-black text-base mt-1">Auction Night 🔨</p>
            <p className="text-white/80 text-xs mt-0.5">Dhurandhars vs Baazigars re-draft · {AUCTION_NIGHT.label}{AUCTION_NIGHT.confirmed ? '' : ' (date TBC)'} — get your paddles ready!</p>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs pb-6 flex items-center justify-center gap-1">
          <Check className="w-3.5 h-3.5" /> New season. Same fire. Let's go, Sangria! 🔥
        </p>
      </div>
    </div>
  );
}

function GoalBar({ label, cur, target }: { label: string; cur: number; target: number }) {
  const pct = Math.min(100, Math.round((cur / Math.max(1, target)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-0.5">
        <span>{label}</span><span>{cur} / {target} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
