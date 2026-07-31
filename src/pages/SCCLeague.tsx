import { useState, useEffect, useMemo } from 'react';
import { Gavel, Crown, Shield, Swords, Flame, Check, Sparkles } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MyStatsButton } from '../components/MyStatsButton';
import { useMembers } from '../hooks/useMembers';
import { useSCCLeague, ROLE_LABELS, SQUAD_TARGET, type LeagueStatus, type LeagueRole } from '../hooks/useSCCLeague';
import { SEASON_NEW } from '../config/season2';
import type { Member } from '../types';

const PROFILE_KEY = 'scc-my-profile-id';
const BASE_PRICES = [50, 100, 200, 500];

const ROLE_EMOJI: Record<LeagueRole, string> = {
  batter: '🏏', bowler: '🎯', allrounder: '⚡', keeper: '🧤',
};

function Avatar({ member, size = 40, ring }: { member?: Member; size?: number; ring?: string }) {
  const initial = member?.name?.charAt(0) ?? '?';
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: ring ? `2px solid ${ring}` : undefined }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, border: ring ? `2px solid ${ring}` : undefined }}>
      {initial}
    </div>
  );
}

export function SCCLeague() {
  const { members } = useMembers();
  const league = useSCCLeague(SEASON_NEW);

  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => { setMyId(localStorage.getItem(PROFILE_KEY)); }, []);

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  // ── Registration ────────────────────────────────────────────────────────
  const mine = league.myRegistration(myId);
  const [status, setStatus] = useState<LeagueStatus>('in');
  const [role, setRole] = useState<LeagueRole>('allrounder');
  const [basePrice, setBasePrice] = useState(100);
  const [pitch, setPitch] = useState('');
  const [canCommit, setCanCommit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!mine) return;
    setStatus(mine.status);
    setRole((mine.role as LeagueRole) ?? 'allrounder');
    setBasePrice(mine.base_price ?? 100);
    setPitch(mine.pitch ?? '');
    setCanCommit(mine.can_commit);
  }, [mine]);

  const submit = async () => {
    if (!myId) return;
    setSaving(true); setMsg(null);
    const res = await league.register({ memberId: myId, status, role, basePrice, pitch, canCommit });
    setSaving(false);
    setMsg(res.success
      ? (status === 'out' ? 'Noted — you can change your mind any time 🏏' : "✓ You're IN! See you at the auction 🔨")
      : `Could not save: ${res.error}`);
    setTimeout(() => setMsg(null), 4000);
  };

  // ── Captain election ────────────────────────────────────────────────────
  const myBallot = league.myVote(myId);
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
    const res = await league.castVote(myId, capPick || null, vicePick || null);
    setVoting(false);
    setVoteMsg(res.success ? '✓ Ballot locked in!' : `Could not save: ${res.error}`);
    setTimeout(() => setVoteMsg(null), 3500);
  };

  const candidates = useMemo(
    () => league.going.map(r => memberById[r.member_id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [league.going, memberById],
  );

  const count = league.going.length;
  const pct = Math.min(100, (count / SQUAD_TARGET) * 100);
  const remaining = Math.max(0, SQUAD_TARGET - count);
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400';

  // Ring geometry for the squad counter
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div className="min-h-screen">
      <Header title="SCC League" subtitle={`The internal rivalry · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl"
          style={{ background: 'radial-gradient(900px 400px at 85% -10%, #7c3aed 0%, transparent 55%), linear-gradient(140deg,#1e1b4b 5%,#4c1d95 45%,#9d174d 100%)' }}>
          <div className="blob-anim absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: '#f472b6', filter: 'blur(80px)', opacity: .35 }} />
          <div className="blob-anim-2 absolute -bottom-28 -left-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: '#8b5cf6', filter: 'blur(80px)', opacity: .35 }} />

          <div className="relative text-center">
            <span className="rise-in inline-flex items-center gap-1.5 bg-white/15 border border-white/25 backdrop-blur rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[3px]">
              <Gavel className="w-3.5 h-3.5" /> Auction League
            </span>
            <h1 className="rise-in-1 font-display text-4xl sm:text-5xl font-extrabold mt-3 leading-[1.05] drop-shadow">
              SCC <span style={{ background: 'linear-gradient(90deg,#fde68a,#fbbf24 45%,#f472b6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>League</span>
            </h1>
            <p className="rise-in-2 text-white/85 text-sm sm:text-base mt-2.5 max-w-md mx-auto font-medium">
              Two squads. One auction. A match every month.<br className="hidden sm:block" />
              Register, vote for your captain, then find out what you're <b>really</b> worth 😏
            </p>

            {/* Squad ring */}
            <div className="rise-in-3 mt-6 flex items-center justify-center gap-6 flex-wrap">
              <div className="relative w-[128px] h-[128px]">
                <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" stroke="rgba(255,255,255,0.15)" />
                  <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round" stroke="url(#lg)"
                    strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,1,.3,1)' }} />
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fbbf24" /><stop offset="1" stopColor="#f472b6" />
                  </linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-extrabold tabular-nums leading-none">{count}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 mt-1">of {SQUAD_TARGET}</span>
                </div>
              </div>
              <div className="text-left">
                <p className="font-display text-xl font-extrabold">
                  {count >= SQUAD_TARGET ? 'Squad complete! 🎉' : `${remaining} more needed`}
                </p>
                <p className="text-white/70 text-xs mt-1 max-w-[190px]">
                  {count >= SQUAD_TARGET
                    ? 'Two full XIs locked. Auction time 🔨'
                    : 'Enough for two full XIs unlocks the auction'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(Object.keys(ROLE_LABELS) as LeagueRole[]).map(r => (
                    <span key={r} className="text-[10px] font-bold bg-white/15 rounded-full px-2 py-1">
                      {ROLE_EMOJI[r]} {league.roleCounts[r] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { icon: '🙋', t: 'Register', d: "Confirm you're in" },
            { icon: '👑', t: 'Vote', d: 'Pick the captains' },
            { icon: '🔨', t: 'Auction', d: 'Get bought' },
            { icon: '⚔️', t: 'Play', d: 'One match a month' },
          ].map(s => (
            <div key={s.t} className="glass rounded-2xl p-3.5 text-center">
              <div className="text-2xl">{s.icon}</div>
              <p className="font-black text-sm mt-1 text-slate-900 dark:text-white">{s.t}</p>
              <p className="text-[11px] text-slate-500 dark:text-white/50 leading-tight mt-0.5">{s.d}</p>
            </div>
          ))}
        </div>

        {league.tableMissing && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 text-center">
            ⚙️ SCC League goes live once <code>add_scc_league.sql</code> is run in Supabase.
          </div>
        )}

        {/* ── REGISTER ─────────────────────────────────────────────────── */}
        <div className={`rounded-3xl p-5 sm:p-6 shadow-lg ${mine?.status === 'in'
          ? 'bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-300 dark:from-emerald-900/20 dark:to-transparent'
          : 'glass'}`}>
          <div className="flex items-center gap-2 mb-1">
            {mine?.status === 'in' && <Check className="w-5 h-5 text-emerald-500" />}
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              {mine?.status === 'in' ? "You're in the auction! 🔥" : mine ? 'Changed your mind?' : 'Are you in? 🙋'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
            Confirmed players only — captains build squads around who actually turns up.
          </p>

          {!myId ? (
            <div className="text-center py-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-white/70 mb-2.5">Pick your profile to register</p>
              <div className="flex justify-center"><MyStatsButton /></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* IN / OUT */}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setStatus('in')}
                  className={`rounded-2xl py-4 font-black transition-all ${
                    status === 'in'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg scale-[1.02]'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60'
                  }`}>
                  <span className="text-2xl block">🔥</span>
                  <span className="text-sm">I'm IN</span>
                </button>
                <button onClick={() => setStatus('out')}
                  className={`rounded-2xl py-4 font-black transition-all ${
                    status === 'out' ? 'bg-slate-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60'
                  }`}>
                  <span className="text-2xl block">😔</span>
                  <span className="text-sm">Sitting out</span>
                </button>
              </div>

              {status === 'in' && (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Your role</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(ROLE_LABELS) as LeagueRole[]).map(r => (
                        <button key={r} onClick={() => setRole(r)}
                          className={`rounded-xl py-2.5 text-[11px] font-bold transition-all ${
                            role === r ? 'bg-violet-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                          }`}>
                          <span className="block text-base">{ROLE_EMOJI[r]}</span>
                          {ROLE_LABELS[r].replace(/^\S+\s/, '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Your base price 💰 <span className="normal-case font-medium">— be bold, captains are watching</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {BASE_PRICES.map(p => (
                        <button key={p} onClick={() => setBasePrice(p)}
                          className={`rounded-xl py-3 text-sm font-black transition-all ${
                            basePrice === p
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md scale-105'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                          }`}>
                          ₹{p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Your one-liner 🗣️ <span className="normal-case font-medium">— read out at the auction!</span>
                    </p>
                    <input value={pitch} onChange={e => setPitch(e.target.value)} maxLength={90}
                      placeholder="e.g. Death-over specialist. Trust me." className={inputCls} />
                  </div>

                  <label className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 rounded-xl p-3.5 cursor-pointer">
                    <input type="checkbox" checked={canCommit} onChange={e => setCanCommit(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-violet-600" />
                    <span className="text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">I can make roughly one match a month</span>
                      <span className="block text-xs text-slate-500 dark:text-white/60">Be honest 🙏</span>
                    </span>
                  </label>
                </>
              )}

              <button onClick={submit} disabled={saving || league.tableMissing}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:brightness-110 disabled:opacity-40 text-white font-black py-4 text-base transition-all shadow-lg">
                {saving ? 'Saving…' : mine ? 'Update my registration' : status === 'in' ? 'Count me in 🔥' : 'Save'}
              </button>
              {msg && (
                <p className={`text-sm font-bold text-center ${msg.startsWith('✓') || msg.startsWith('Noted') ? 'text-emerald-600' : 'text-rose-500'}`}>{msg}</p>
              )}
            </div>
          )}
        </div>

        {/* ── WHO'S IN — auction cards ─────────────────────────────────── */}
        {league.going.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-emerald-600 mb-3 flex items-center gap-1.5">
              <Flame className="w-4 h-4" /> In the auction pool · {league.going.length}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {league.going.map(r => {
                const m = memberById[r.member_id];
                return (
                  <div key={r.id}
                    className="relative rounded-2xl p-3 text-white overflow-hidden shadow-md"
                    style={{ background: 'linear-gradient(150deg,#4c1d95,#7c3aed 60%,#a78bfa)' }}>
                    <span className="absolute top-2 right-2 text-[9px] font-black bg-amber-400 text-slate-900 rounded-full px-1.5 py-0.5">
                      ₹{r.base_price}
                    </span>
                    <Avatar member={m} size={44} ring="rgba(255,255,255,.5)" />
                    <p className="font-black text-sm mt-2 truncate">{m?.name?.split(' ')[0] ?? '?'}</p>
                    <p className="text-[10px] text-white/70">{r.role ? ROLE_LABELS[r.role as LeagueRole] : ''}</p>
                    {r.pitch && <p className="text-[10px] text-white/60 italic mt-1 line-clamp-2">"{r.pitch}"</p>}
                    {!r.can_commit && <p className="text-[9px] text-amber-300 font-bold mt-1">limited availability</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CAPTAIN ELECTION ─────────────────────────────────────────── */}
        <div className="glass rounded-3xl p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 mb-1 flex items-center gap-1.5">
            <Crown className="w-4 h-4" fill="currentColor" /> Captain election
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
            The squad votes. Top 2 become <b>captains</b> of the two teams; next 2 are their <b>vice-captains</b>.
            They run the bidding on auction night 🔨
          </p>

          {!myId ? (
            <div className="flex justify-center"><MyStatsButton /></div>
          ) : candidates.length < 2 ? (
            <p className="text-sm text-slate-500 dark:text-white/60">
              Voting opens once a few players are in — get your name on the list first! 🏏
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1.5">👑 Captain</p>
                  <select value={capPick} onChange={e => setCapPick(e.target.value)} className={inputCls}>
                    <option value="">Pick a captain…</option>
                    {candidates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-1.5">🛡️ Vice-captain</p>
                  <select value={vicePick} onChange={e => setVicePick(e.target.value)} className={inputCls}>
                    <option value="">Pick a vice-captain…</option>
                    {candidates.filter(m => m.id !== capPick).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={vote} disabled={voting || (!capPick && !vicePick) || league.tableMissing}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 disabled:opacity-40 text-white font-black py-3 text-sm transition-all shadow-md">
                {voting ? 'Saving…' : myBallot ? 'Update my ballot' : 'Cast my vote 👑'}
              </button>
              {voteMsg && (
                <p className={`text-sm font-bold text-center ${voteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{voteMsg}</p>
              )}
            </div>
          )}

          {/* Live count */}
          {league.tally.ballots > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2.5">
                Live count · {league.tally.ballots} ballot{league.tally.ballots === 1 ? '' : 's'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([['👑 Captain', league.tally.captains, 'text-amber-500'], ['🛡️ Vice-captain', league.tally.vices, 'text-sky-500']] as const).map(([label, rows, colour]) => (
                  <div key={label}>
                    <p className={`text-[11px] font-black mb-1.5 ${colour}`}>{label}</p>
                    {rows.slice(0, 5).map((c, i) => (
                      <div key={c.id} className="flex items-center gap-2 py-1">
                        <span className={`text-[11px] font-black w-4 ${i < 2 ? colour : 'text-slate-300'}`}>{i + 1}</span>
                        <Avatar member={memberById[c.id]} size={24} />
                        <span className="text-xs flex-1 truncate text-slate-700 dark:text-white/80">
                          {memberById[c.id]?.name ?? '?'}
                        </span>
                        <span className="text-xs font-black text-slate-500 tabular-nums">{c.n}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Provisional teams */}
              {league.leadership.captains.length === 2 && (
                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                    <Swords className="w-3.5 h-3.5" /> Teams taking shape
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {league.leadership.captains.map((cid, i) => (
                      <div key={cid} className="rounded-2xl p-3.5 text-white shadow-md"
                        style={{ background: i === 0
                          ? 'linear-gradient(135deg,#1e3a8a,#3b82f6)'
                          : 'linear-gradient(135deg,#7c2d12,#f97316)' }}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Team {i + 1}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar member={memberById[cid]} size={34} ring="rgba(255,255,255,.6)" />
                          <div className="min-w-0">
                            <p className="font-black text-sm truncate flex items-center gap-1">
                              <Crown className="w-3 h-3" fill="currentColor" />
                              {memberById[cid]?.name?.split(' ')[0] ?? '?'}
                            </p>
                            {league.leadership.vices[i] && (
                              <p className="text-white/75 text-[10px] truncate flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" /> {memberById[league.leadership.vices[i]]?.name?.split(' ')[0] ?? '?'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Not final until voting closes — keep campaigning 😏
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs pb-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Register → vote → get bought → lift the trophy 🏆
        </p>
      </div>
    </div>
  );
}
