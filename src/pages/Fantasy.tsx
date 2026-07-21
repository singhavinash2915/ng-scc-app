import { useState, useEffect, useMemo } from 'react';
import { Trophy, Coins, Crown, Check, Users, Info, AlertTriangle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MyStatsButton } from '../components/MyStatsButton';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useFantasyDraft, SQUAD_SIZE, BUDGET } from '../hooks/useFantasyDraft';
import { SEASON_NEW, SEASON_PREV, SEASON_NEW_START, SEASON_NEW_END } from '../config/season2';

const PROFILE_KEY = 'scc-my-profile-id';
const SEASON = SEASON_NEW;

export function Fantasy() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats: prevStats } = useCricketStats(SEASON_PREV);   // prices: last season's form
  const { stats: newStats } = useCricketStats(SEASON_NEW);      // points: this season's deeds
  const { counts: momCounts } = useMOMCounts(SEASON_NEW_START, SEASON_NEW_END);
  const { draftPlayers, priceById, leaderboard, myTeam, saveTeam, loading, tableMissing } =
    useFantasyDraft(SEASON, prevStats, newStats, members, momCounts);

  // The draft locks the moment the season's first ball is bowled.
  const seasonStarted = useMemo(() => matches.some(m =>
    m.match_type !== 'internal' && ['won', 'lost', 'draw'].includes(m.result)
    && m.date >= SEASON_NEW_START && m.date <= SEASON_NEW_END), [matches]);

  const [myId, setMyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setMyId(localStorage.getItem(PROFILE_KEY)); }, []);

  // Load existing team into the builder
  const existing = myTeam(myId);
  useEffect(() => {
    if (existing) {
      setSelected(new Set(existing.player_ids));
      setCaptain(existing.captain_id);
      setTeamName(existing.team_name || '');
    }
  }, [existing]);

  const pool = useMemo(() => [...draftPlayers].sort((a, b) => b.points - a.points), [draftPlayers]);
  const spent = useMemo(() => [...selected].reduce((s, id) => s + (priceById[id] || 0), 0), [selected, priceById]);
  const remaining = BUDGET - spent;
  const full = selected.size >= SQUAD_SIZE;
  const valid = selected.size === SQUAD_SIZE && remaining >= 0 && captain && selected.has(captain);

  const toggle = (id: string) => {
    if (seasonStarted) { setMsg('Squads are locked — the season has started.'); return; }
    setMsg(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (captain === id) setCaptain(null);
      } else {
        if (next.size >= SQUAD_SIZE) { setMsg(`Your squad is full (${SQUAD_SIZE} players).`); return prev; }
        if ((priceById[id] || 0) > remaining) { setMsg('Not enough credits for that pick.'); return prev; }
        next.add(id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!myId || !valid || seasonStarted) return;
    setSaving(true); setMsg(null);
    try {
      await saveTeam(myId, teamName || 'My XI', [...selected], captain);
      setMsg('✓ Team saved! Your score updates automatically as matches are played.');
    } catch {
      setMsg('Could not save — the fantasy table may not be set up yet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Fantasy Draft League" subtitle="Draft your XI · earn points from real performances" />
      <div className="p-4 lg:p-8 space-y-4 max-w-3xl mx-auto">

        {/* Hero / rules */}
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
          style={{ background: 'linear-gradient(120deg,#7c3aed,#2563eb 55%,#0a1019)' }}>
          <div className="flex items-center gap-2 mb-1"><Trophy className="w-5 h-5" /><span className="font-black text-lg">Fantasy Draft · Season {SEASON}</span></div>
          <p className="text-white/85 text-sm">Pick {SQUAD_SIZE} players within {BUDGET} credits, name your team and choose a captain (scores 2×). Prices are set by <b>last season's form</b>; points come from <b>this season's real performances</b> — and the draft locks at the first ball of the season.</p>
        </div>

        {seasonStarted && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-sm">
            <Info className="w-4 h-4 flex-shrink-0" />
            The season is underway — squads are locked. Points now update automatically after every match. 🏏
          </div>
        )}

        {tableMissing && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Fantasy league isn't activated yet — an admin needs to run the <code className="mx-1">add_fantasy_teams.sql</code> migration.
          </div>
        )}

        {/* Identify yourself */}
        {!myId ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-gray-700 dark:text-gray-200">Who are you?</p>
            <p className="text-xs text-gray-500 mb-3">Pick your profile to manage a fantasy team.</p>
            <div className="flex justify-center"><MyStatsButton /></div>
          </div>
        ) : (
          <>
            {/* Builder controls */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Name your team…"
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
                  <p className={`text-xl font-black tabular-nums ${selected.size === SQUAD_SIZE ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>{selected.size}/{SQUAD_SIZE}</p>
                  <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Players</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
                  <p className={`text-xl font-black tabular-nums ${remaining < 0 ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>{remaining}</p>
                  <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Credits left</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
                  <p className="text-xl font-black tabular-nums text-violet-600 dark:text-violet-400">{captain ? '✓' : '—'}</p>
                  <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Captain</p>
                </div>
              </div>
              {msg && <p className={`text-xs font-semibold ${msg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{msg}</p>}
              <button
                onClick={save}
                disabled={!valid || saving || seasonStarted}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-sm transition-colors"
              >
                {seasonStarted ? '🔒 Squads locked' : saving ? 'Saving…' : existing ? 'Update my team' : 'Save my team'}
              </button>
              {!valid && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Pick exactly {SQUAD_SIZE} players within budget and tap a star to set your captain.</p>
              )}
            </div>

            {/* Player pool */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[2px] text-gray-600 dark:text-gray-300">Player pool</span>
                <span className="text-[10px] text-gray-400 font-semibold">price · last-season pts</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[480px] overflow-y-auto">
                {pool.map(p => {
                  const isSel = selected.has(p.member.id);
                  const isCap = captain === p.member.id;
                  const tooPricey = !isSel && (p.price > remaining || full);
                  return (
                    <div key={p.member.id} className={`flex items-center gap-2.5 px-3 py-2 ${isSel ? 'bg-violet-50/60 dark:bg-violet-900/15' : ''}`}>
                      <button onClick={() => toggle(p.member.id)} disabled={tooPricey}
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${
                          isSel ? 'bg-violet-600 border-violet-600 text-white'
                          : tooPricey ? 'border-gray-200 dark:border-gray-700 text-gray-300 cursor-not-allowed'
                          : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-violet-400'}`}>
                        <Check className="w-4 h-4" />
                      </button>
                      {p.member.avatar_url
                        ? <img src={p.member.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-xs font-black text-gray-500">{p.member.name.charAt(0)}</div>}
                      <span className="flex-1 min-w-0 text-sm font-bold text-gray-900 dark:text-white truncate">{p.member.name}</span>
                      <button onClick={() => isSel && setCaptain(isCap ? null : p.member.id)} disabled={!isSel}
                        title="Set captain (2×)"
                        className={`flex-shrink-0 ${isCap ? 'text-amber-500' : isSel ? 'text-gray-300 hover:text-amber-400' : 'text-transparent'}`}>
                        <Crown className="w-4 h-4" fill={isCap ? 'currentColor' : 'none'} />
                      </button>
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums w-9 justify-end">
                        <Coins className="w-3 h-3" />{p.price}
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-gray-400 font-semibold tabular-nums w-12 text-right">{Math.round(p.lastSeasonPoints).toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* League table */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-black uppercase tracking-[2px] text-gray-600 dark:text-gray-300">League table</span>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-gray-400">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No teams yet — be the first to draft your XI! 🏏</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {leaderboard.map((e, i) => (
                <div key={e.team.id} className={`flex items-center gap-3 px-4 py-2.5 ${e.manager?.id === myId ? 'bg-violet-50/60 dark:bg-violet-900/15' : ''}`}>
                  <span className={`w-6 text-center font-black tabular-nums ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{e.team.team_name || 'My XI'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{e.manager?.name || 'Unknown'}{e.captainName ? ` · © ${e.captainName.split(' ')[0]}` : ''}</p>
                  </div>
                  <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{e.score.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}

export default Fantasy;
