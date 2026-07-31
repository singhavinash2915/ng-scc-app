import { useState, useEffect, useMemo } from 'react';
import { Gavel, Users, Crown, Check, Megaphone, Shield, Trophy } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MyStatsButton } from '../components/MyStatsButton';
import { useMembers } from '../hooks/useMembers';
import { useSPL, ROLE_LABELS, SQUAD_TARGET, type SplStatus, type SplRole } from '../hooks/useSPL';
import { SEASON_NEW } from '../config/season2';
import type { Member } from '../types';

const PROFILE_KEY = 'scc-my-profile-id';
const BASE_PRICES = [50, 100, 200, 500];

function Avatar({ member, size = 36 }: { member?: Member; size?: number }) {
  const initial = member?.name?.charAt(0) ?? '?';
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</div>
  );
}

export function SPL() {
  const { members } = useMembers();
  const spl = useSPL(SEASON_NEW);

  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => { setMyId(localStorage.getItem(PROFILE_KEY)); }, []);

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  // ── Registration form ───────────────────────────────────────────────────
  const mine = spl.myRegistration(myId);
  const [status, setStatus] = useState<SplStatus>('in');
  const [role, setRole] = useState<SplRole>('allrounder');
  const [basePrice, setBasePrice] = useState(100);
  const [pitch, setPitch] = useState('');
  const [canCommit, setCanCommit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!mine) return;
    setStatus(mine.status);
    setRole((mine.role as SplRole) ?? 'allrounder');
    setBasePrice(mine.base_price ?? 100);
    setPitch(mine.pitch ?? '');
    setCanCommit(mine.can_commit);
  }, [mine]);

  const submit = async () => {
    if (!myId) return;
    setSaving(true); setMsg(null);
    const res = await spl.register({ memberId: myId, status, role, basePrice, pitch, canCommit });
    setSaving(false);
    setMsg(res.success
      ? (status === 'out' ? 'Noted — maybe next season! 🏏' : "✓ You're on the list! See you at the auction 🔨")
      : `Could not save: ${res.error}`);
    setTimeout(() => setMsg(null), 4000);
  };

  // ── Captain election ────────────────────────────────────────────────────
  const myBallot = spl.myVote(myId);
  const [capPick, setCapPick] = useState('');
  const [vicePick, setVicePick] = useState('');
  const [voting, setVoting] = useState(false);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!myBallot) return;
    setCapPick(myBallot.captain_id ?? '');
    setVicePick(myBallot.vice_id ?? '');
  }, [myBallot]);

  const vote = async () => {
    if (!myId) return;
    setVoting(true); setVoteMsg(null);
    const res = await spl.castVote(myId, capPick || null, vicePick || null);
    setVoting(false);
    setVoteMsg(res.success ? '✓ Ballot locked in!' : `Could not save: ${res.error}`);
    setTimeout(() => setVoteMsg(null), 3500);
  };

  // Only registered players can captain
  const candidates = useMemo(
    () => spl.going
      .map(r => memberById[r.member_id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [spl.going, memberById],
  );

  const progress = Math.min(100, Math.round((spl.going.length / SQUAD_TARGET) * 100));
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900';

  return (
    <div className="min-h-screen">
      <Header title="Sangria Premier League" subtitle={`Register · vote · get auctioned · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#4c1d95,#7c3aed 45%,#db2777)' }}>
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[2px]">
              <Gavel className="w-3.5 h-3.5" /> Auction League
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-2.5 drop-shadow">Sangria Premier League 🔨</h1>
            <p className="text-white/85 text-sm mt-2 max-w-lg">
              Two squads. One auction. A match every month. Register your interest, vote for the captains,
              then find out what you're <b>really</b> worth on auction night 😏
            </p>
            <div className="flex flex-wrap gap-2 mt-4 text-[11px] font-bold">
              <span className="bg-white/15 rounded-lg px-2.5 py-1.5">1️⃣ Register</span>
              <span className="bg-white/15 rounded-lg px-2.5 py-1.5">2️⃣ Vote captains</span>
              <span className="bg-white/15 rounded-lg px-2.5 py-1.5">3️⃣ Auction night</span>
              <span className="bg-white/15 rounded-lg px-2.5 py-1.5">4️⃣ Monthly clashes</span>
            </div>
          </div>
        </div>

        {spl.tableMissing && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 text-center">
            ⚙️ SPL goes live once <code>add_spl.sql</code> is run in Supabase.
          </div>
        )}

        {/* ── SIGN-UP TRACKER ──────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-violet-600 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Squad building
            </p>
            <span className="text-sm font-bold text-slate-700 dark:text-white">
              {spl.going.length}<span className="text-slate-400 font-medium"> / {SQUAD_TARGET}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-2">
            {spl.going.length >= SQUAD_TARGET
              ? '🎉 We have enough for two full XIs — auction time!'
              : `${SQUAD_TARGET - spl.going.length} more needed for two full XIs${spl.maybe.length ? ` · ${spl.maybe.length} on the fence` : ''}`}
          </p>
          {/* Role balance */}
          <div className="flex flex-wrap gap-2 mt-3">
            {(Object.keys(ROLE_LABELS) as SplRole[]).map(r => (
              <span key={r} className="text-[11px] font-bold bg-white/70 dark:bg-white/10 rounded-full px-2.5 py-1 text-slate-600 dark:text-white/70">
                {ROLE_LABELS[r]} · {spl.roleCounts[r] ?? 0}
              </span>
            ))}
          </div>
        </div>

        {/* ── REGISTER ─────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
            {mine ? 'Update your registration' : 'Register for the auction 🙋'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1 mb-4">
            Tell us you're in — captains need to know who they're bidding for.
          </p>

          {!myId ? (
            <div className="text-center py-3">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-slate-600 dark:text-white/70 mb-2">Pick your profile to register</p>
              <div className="flex justify-center"><MyStatsButton /></div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Status */}
              <div className="grid grid-cols-3 gap-2">
                {([['in', "I'm in! 🔥"], ['maybe', 'Maybe 🤔'], ['out', 'Sitting out']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setStatus(v)}
                    className={`rounded-xl py-2.5 text-xs font-black transition ${
                      status === v
                        ? v === 'in' ? 'bg-emerald-500 text-white' : v === 'maybe' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {status !== 'out' && (
                <>
                  {/* Role */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Your role</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(ROLE_LABELS) as SplRole[]).map(r => (
                        <button key={r} onClick={() => setRole(r)}
                          className={`rounded-xl py-2 text-[11px] font-bold transition ${
                            role === r ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                          }`}>
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Base price */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                      Your base price 💰 <span className="normal-case font-medium text-slate-400">(be bold — captains are watching)</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {BASE_PRICES.map(p => (
                        <button key={p} onClick={() => setBasePrice(p)}
                          className={`rounded-xl py-2 text-xs font-black transition ${
                            basePrice === p ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                          }`}>
                          ₹{p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pitch */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                      Your one-liner 🗣️ <span className="normal-case font-medium text-slate-400">(read out at the auction!)</span>
                    </p>
                    <input value={pitch} onChange={e => setPitch(e.target.value)} maxLength={90}
                      placeholder="e.g. Death-over specialist. Trust me."
                      className={inputCls} />
                  </div>

                  {/* Commitment */}
                  <label className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 rounded-xl p-3 cursor-pointer">
                    <input type="checkbox" checked={canCommit} onChange={e => setCanCommit(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-violet-600" />
                    <span className="text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">I can make roughly one match a month</span>
                      <span className="block text-xs text-slate-500 dark:text-white/60">
                        Be honest — squads are built around who actually turns up 🙏
                      </span>
                    </span>
                  </label>
                </>
              )}

              <button onClick={submit} disabled={saving || spl.tableMissing}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black py-3 text-sm transition-colors">
                {saving ? 'Saving…' : mine ? 'Update my registration' : 'Count me in →'}
              </button>
              {msg && (
                <p className={`text-xs font-semibold ${msg.startsWith('✓') || msg.startsWith('Noted') ? 'text-emerald-600' : 'text-rose-500'}`}>{msg}</p>
              )}
            </div>
          )}
        </div>

        {/* ── WHO'S IN ─────────────────────────────────────────────────── */}
        {(spl.going.length > 0 || spl.maybe.length > 0) && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-emerald-600 mb-3 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4" /> On the list
            </p>
            <div className="space-y-2">
              {spl.going.map(r => {
                const m = memberById[r.member_id];
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-2.5">
                    <Avatar member={m} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {m?.name ?? 'Unknown'}
                        {!r.can_commit && <span className="text-amber-500 text-[10px] font-bold ml-1.5">· limited availability</span>}
                      </p>
                      {r.pitch && <p className="text-[11px] text-slate-500 dark:text-white/60 italic truncate">"{r.pitch}"</p>}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 shrink-0">
                      {r.role ? ROLE_LABELS[r.role as SplRole] : ''}
                    </span>
                    <span className="text-xs font-black text-amber-600 tabular-nums shrink-0">₹{r.base_price}</span>
                  </div>
                );
              })}
              {spl.maybe.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase text-amber-500 mb-1.5">🤔 On the fence</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spl.maybe.map(r => (
                      <span key={r.id} className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full px-2.5 py-1">
                        {memberById[r.member_id]?.name?.split(' ')[0] ?? '?'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CAPTAIN ELECTION ─────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 mb-1 flex items-center gap-1.5">
            <Crown className="w-4 h-4" fill="currentColor" /> Captain election
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
            The squad votes. Top 2 become the <b>captains</b> of the two teams; the next 2 are their <b>vice-captains</b>.
            They'll run the bidding on auction night 🔨
          </p>

          {!myId ? (
            <div className="flex justify-center"><MyStatsButton /></div>
          ) : candidates.length < 2 ? (
            <p className="text-sm text-slate-500 dark:text-white/60">
              Voting opens once a few players have registered — get your name in first! 🏏
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">👑 Captain</p>
                  <select value={capPick} onChange={e => setCapPick(e.target.value)} className={inputCls}>
                    <option value="">Pick a captain…</option>
                    {candidates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">🛡️ Vice-captain</p>
                  <select value={vicePick} onChange={e => setVicePick(e.target.value)} className={inputCls}>
                    <option value="">Pick a vice-captain…</option>
                    {candidates.filter(m => m.id !== capPick).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={vote} disabled={voting || (!capPick && !vicePick) || spl.tableMissing}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-black py-2.5 text-sm transition-colors">
                {voting ? 'Saving…' : myBallot ? 'Update my ballot' : 'Cast my vote'}
              </button>
              {voteMsg && (
                <p className={`text-xs font-semibold ${voteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{voteMsg}</p>
              )}
            </div>
          )}

          {/* Live standings */}
          {spl.tally.ballots > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
                Live count · {spl.tally.ballots} ballot{spl.tally.ballots === 1 ? '' : 's'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-black text-amber-600 mb-1.5">👑 Captain votes</p>
                  {spl.tally.captains.slice(0, 5).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 py-0.5">
                      <span className={`text-[11px] font-black w-4 ${i < 2 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                      <Avatar member={memberById[c.id]} size={22} />
                      <span className="text-xs flex-1 truncate text-slate-700 dark:text-white/80">
                        {memberById[c.id]?.name ?? '?'}
                        {i < 2 && <span className="text-amber-500 font-bold"> · leading</span>}
                      </span>
                      <span className="text-xs font-bold text-slate-500 tabular-nums">{c.n}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-black text-sky-600 mb-1.5">🛡️ Vice-captain votes</p>
                  {spl.tally.vices.slice(0, 5).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 py-0.5">
                      <span className={`text-[11px] font-black w-4 ${i < 2 ? 'text-sky-500' : 'text-slate-300'}`}>{i + 1}</span>
                      <Avatar member={memberById[c.id]} size={22} />
                      <span className="text-xs flex-1 truncate text-slate-700 dark:text-white/80">{memberById[c.id]?.name ?? '?'}</span>
                      <span className="text-xs font-bold text-slate-500 tabular-nums">{c.n}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provisional leadership */}
              {spl.leadership.captains.length === 2 && (
                <div className="mt-4 rounded-xl p-3" style={{ background: 'linear-gradient(120deg,#78350f,#d97706)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-2">Provisional leadership</p>
                  <div className="grid grid-cols-2 gap-2">
                    {spl.leadership.captains.map((cid, i) => (
                      <div key={cid} className="bg-white/15 rounded-lg p-2.5">
                        <p className="text-[9px] font-bold uppercase text-white/70 flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> Team {i + 1}
                        </p>
                        <p className="text-white font-black text-sm truncate mt-0.5">
                          👑 {memberById[cid]?.name?.split(' ')[0] ?? '?'}
                        </p>
                        {spl.leadership.vices[i] && (
                          <p className="text-white/80 text-[11px] truncate flex items-center gap-1">
                            <Shield className="w-3 h-3" /> {memberById[spl.leadership.vices[i]]?.name?.split(' ')[0] ?? '?'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-white/60 text-[10px] mt-2">Not final until voting closes — keep campaigning 😏</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs pb-6 flex items-center justify-center gap-1">
          <Check className="w-3.5 h-3.5" /> Register → vote → get bought → win the SPL Cup 🏆
        </p>
      </div>
    </div>
  );
}
