import { useState, useEffect, useMemo } from 'react';
import { Gavel, Crown, Swords, Flame, Lock, UserMinus, Check, Sparkles, ScrollText, ChevronDown, Vote } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MyStatsButton } from '../components/MyStatsButton';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useMarketValue } from '../hooks/useMarketValue';
import { useSCCLeague, ROLE_LABELS, REVEAL_TOP_N, SQUAD_TARGET, SQUAD_MAX, VOTE_UNLOCK_AT, PRICE_TIERS, PURSE_LAKH, SQUAD_SIZE, formatPrice,
  tierForRating, isWillingCaptain, type LeagueStatus, type LeagueRole } from '../hooks/useSCCLeague';
import { ALL_RULES } from '../config/leagueRules';
import { SEASON_NEW } from '../config/season2';
import type { Member } from '../types';

const PROFILE_KEY = 'scc-my-profile-id';

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
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { scorecards } = useAllScorecards();
  // Base price is GRADED from the club's own rating — never self-selected,
  // otherwise every single player would tick "₹2 Cr" and the grade means nothing.
  // The same ratings break captain-vote ties, per the rulebook.
  const values = useMarketValue(matches, members, scorecards);
  const ratingById = useMemo(
    () => Object.fromEntries(values.map(v => [v.member.id, v.rating])) as Record<string, number>,
    [values],
  );

  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => { setMyId(localStorage.getItem(PROFILE_KEY)); }, []);

  const league = useSCCLeague(SEASON_NEW, { isAdmin, myId, ratingById });

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  // ── Registration ────────────────────────────────────────────────────────
  const mine = league.myRegistration(myId);
  const [status, setStatus] = useState<LeagueStatus>('in');
  const [role, setRole] = useState<LeagueRole>('allrounder');
  const [pitch, setPitch] = useState('');
  const [canCommit, setCanCommit] = useState(true);
  const [wantsCaptaincy, setWantsCaptaincy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!mine) return;
    setStatus(mine.status);
    setRole((mine.role as LeagueRole) ?? 'allrounder');
    setPitch(mine.pitch ?? '');
    setCanCommit(mine.can_commit);
    setWantsCaptaincy(isWillingCaptain(mine));
  }, [mine]);

  const save = async (next: LeagueStatus) => {
    if (!myId) return;
    setSaving(true); setMsg(null);
    const res = await league.register({ memberId: myId, status: next, role, basePrice: myTier.price, pitch, canCommit, wantsCaptaincy });
    setSaving(false);
    setMsg(res.success
      ? (next === 'out' ? '✓ Noted — you can change your mind any time 🏏' : "✓ You're IN! See you at the auction 🔨")
      : `Could not save: ${res.error}`);
    setTimeout(() => setMsg(null), 4000);
  };

  const submit = () => save(status);

  /**
   * Opting out saves on the tap. There is nothing else to fill in, and the old
   * two-step version silently ate every opt-out: tapping "Sitting out" collapsed
   * the whole form, which read as "done", so nobody pressed the little "Save"
   * button underneath and not one 'out' row was ever written.
   */
  const chooseOut = () => { setStatus('out'); save('out'); };

  // ── Captain election ────────────────────────────────────────────────────
  const myBallot = league.myVote(myId);
  const [capPick, setCapPick] = useState('');
  const [voting, setVoting] = useState(false);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!myBallot) return;
    setCapPick(myBallot.captain_id ?? '');
  }, [myBallot]);

  const vote = async () => {
    if (!myId || !capPick) return;
    setVoting(true); setVoteMsg(null);
    const res = await league.castVote(myId, capPick);
    setVoting(false);
    setVoteMsg(res.success ? '✓ Ballot locked in!' : `Could not save: ${res.error}`);
    setTimeout(() => setVoteMsg(null), 3500);
  };

  const candidates = useMemo(
    () => league.captainCandidates.map(r => memberById[r.member_id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [league.captainCandidates, memberById],
  );

  const myRating = myId ? ratingById[myId] : undefined;
  const myTier = tierForRating(myRating);
  const myRated = myRating != null;

  const count = league.going.length;
  const votingOpen = count >= VOTE_UNLOCK_AT && candidates.length >= 2;
  // Once ballots are live the captaincy choice is frozen — pulling out after
  // people have voted for you throws their vote away.
  const captaincyLocked = count >= VOTE_UNLOCK_AT;
  const canVote = mine?.status === 'in';
  // Belt and braces: if a ballot ends up pointing at someone who is no longer a
  // candidate, tell that voter instead of silently binning their vote.
  const ballotWithdrawn = !!myBallot?.captain_id && !candidates.some(m => m.id === myBallot.captain_id);
  const pct = Math.min(100, (count / SQUAD_TARGET) * 100);
  const remaining = Math.max(0, SQUAD_TARGET - count);
  // Past 26 the squad isn't closed — the next 4 are impact players.
  const impactTaken = Math.max(0, Math.min(SQUAD_MAX, count) - SQUAD_TARGET);
  const impactLeft = Math.max(0, SQUAD_MAX - Math.max(count, SQUAD_TARGET));
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
              Two squads. One auction. Two to three matches every month.<br className="hidden sm:block" />
              Register, vote for your captain, then find out what you're <b>really</b> worth 😏
            </p>

            {/* Purse headline — the number that makes it feel big */}
            <div className="rise-in-2 inline-flex items-center gap-2 mt-3 bg-white/15 border border-white/25 backdrop-blur rounded-full px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Purse per team</span>
              <span className="font-display text-lg font-extrabold" style={{ color: '#fde68a' }}>{formatPrice(PURSE_LAKH)}</span>
            </div>

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
                  {count >= SQUAD_MAX
                    ? 'Squad FULL 🔒'
                    : count >= SQUAD_TARGET ? 'Squad complete! 🎉' : `${remaining} more needed`}
                </p>
                <p className="text-white/70 text-xs mt-1 max-w-[190px]">
                  {count >= SQUAD_MAX
                    ? `All ${SQUAD_MAX} spots gone. Auction time 🔨`
                    : count >= SQUAD_TARGET
                      ? `Two full XIs locked 🔨 ${impactLeft} impact-player spot${impactLeft === 1 ? '' : 's'} still open`
                      : `Get to ${SQUAD_TARGET} — 13 a side — and the auction is on`}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(Object.keys(ROLE_LABELS) as LeagueRole[]).map(r => (
                    <span key={r} className="text-[10px] font-bold bg-white/15 rounded-full px-2 py-1">
                      {ROLE_EMOJI[r]} {league.roleCounts[r] ?? 0}
                    </span>
                  ))}
                </div>
                {impactTaken > 0 && (
                  <p className="text-amber-300 text-[11px] font-bold mt-2">
                    ⚡ {impactTaken} impact player{impactTaken === 1 ? '' : 's'} · {impactLeft} spot{impactLeft === 1 ? '' : 's'} left
                  </p>
                )}
                {league.sittingOut.length > 0 && (
                  <p className="text-white/50 text-[11px] font-bold mt-2">
                    😔 {league.sittingOut.length} sitting out
                  </p>
                )}
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
            { icon: '⚔️', t: 'Play', d: '2–3 matches a month' },
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
                <button onClick={chooseOut} disabled={saving || league.tableMissing}
                  className={`rounded-2xl py-4 font-black transition-all disabled:opacity-60 ${
                    status === 'out' ? 'bg-slate-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60'
                  }`}>
                  <span className="text-2xl block">😔</span>
                  <span className="text-sm">Sitting out</span>
                </button>
              </div>

              {status === 'out' && (
                <div className="rounded-2xl bg-slate-100 dark:bg-white/10 p-4 text-center">
                  <p className="text-sm font-black text-slate-700 dark:text-white">
                    {mine?.status === 'out' ? "You're marked as sitting out 😔" : 'Saving…'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Saved — nothing else to do. Changed your mind? Just tap <b>I'm IN</b> above 🔥
                  </p>
                </div>
              )}

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
                      Your base price 💰 <span className="normal-case font-medium">— earned, not chosen</span>
                    </p>
                    <div className={`rounded-2xl p-4 text-white bg-gradient-to-r ${myTier.cls} shadow-md`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl leading-none">{myTier.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{myTier.label}</p>
                          <p className="text-2xl font-black leading-tight">{formatPrice(myTier.price)}</p>
                        </div>
                      </div>
                      <p className="text-[11px] mt-2.5 opacity-90 leading-snug">
                        {myRated
                          ? <>Graded from your <b>SCC Rankings rating</b> ({Math.round(myRating!)}/1000). Play well, get upgraded 📈</>
                          : <>Not enough rated matches yet, so you start at <b>Grade C</b>. The auction is where you fix that 😄</>}
                      </p>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {PRICE_TIERS.map(t => (
                        <div key={t.key}
                          className={`rounded-lg py-1.5 text-center text-[10px] font-bold ${
                            t.key === myTier.key
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60'
                          }`}>
                          <span className="block text-sm leading-none mb-0.5">{t.emoji}</span>
                          {formatPrice(t.price)}
                        </div>
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
                      <span className="font-bold text-slate-900 dark:text-white">I can make most of the 2–3 league matches each month</span>
                      <span className="block text-xs text-slate-500 dark:text-white/60">Be honest 🙏</span>
                    </span>
                  </label>

                  {/* Captaincy is a separate question from playing. Someone who
                      doesn't want the job shouldn't be on the ballot at all —
                      every vote spent on them would be thrown away. */}
                  <label className={`flex items-start gap-3 rounded-xl p-3.5 ${
                    captaincyLocked
                      ? 'bg-slate-50 dark:bg-white/5 opacity-70 cursor-not-allowed'
                      : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 cursor-pointer'
                  }`}>
                    <input type="checkbox" checked={wantsCaptaincy} disabled={captaincyLocked}
                      onChange={e => setWantsCaptaincy(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-amber-600" />
                    <span className="text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">
                        👑 Put me on the captain ballot
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-white/60 mt-0.5">
                        {captaincyLocked
                          ? 'Locked — voting has started, so this can no longer change.'
                          : wantsCaptaincy
                            ? "Happy to lead a side if the squad picks you. Untick if you'd rather just play — you'll be left off the ballot so nobody wastes a vote on you."
                            : "You're off the ballot 👍 You'll still be in the auction like everyone else."}
                      </span>
                    </span>
                  </label>
                </>
              )}

              {/* Only IN needs a confirm step — it has a role, a pitch and the
                  availability box to fill in first. OUT already saved on tap. */}
              {status === 'in' && (
                <button onClick={submit} disabled={saving || league.tableMissing}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:brightness-110 disabled:opacity-40 text-white font-black py-4 text-base transition-all shadow-lg">
                  {saving ? 'Saving…' : mine?.status === 'in' ? 'Update my registration' : 'Count me in 🔥'}
                </button>
              )}
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
                      {formatPrice(r.base_price)}
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

        {/* ── SITTING OUT ──────────────────────────────────────────────── */}
        {/* Shown so the group can see who has actually answered. Silence and
            "no" look identical otherwise, and captains keep chasing people
            who already said they're out. */}
        {league.sittingOut.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400 mb-1 flex items-center gap-1.5">
              <UserMinus className="w-4 h-4" /> Sitting this one out · {league.sittingOut.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-white/60 mb-3">
              No hard feelings — next season 🤝 Changed your mind? Just tap <b>I'm IN</b> above.
            </p>
            <div className="flex flex-wrap gap-2">
              {league.sittingOut.map(r => {
                const m = memberById[r.member_id];
                return (
                  <div key={r.id}
                    className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 pl-1 pr-3 py-1">
                    <Avatar member={m} size={24} />
                    <span className="text-xs font-bold text-slate-500 dark:text-white/60">
                      {m?.name?.split(' ')[0] ?? '?'}
                    </span>
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
          <p className="text-xs text-slate-500 dark:text-white/60 mb-3">
            The squad votes. The <b>two most-voted</b> players captain the two teams
            and run the bidding on auction night 🔨
          </p>

          {/* How voting works — 3 steps, so nobody has to ask */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 p-3.5 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
              <Vote className="w-3.5 h-3.5" /> How the voting works
            </p>
            <ol className="space-y-1.5 text-[12px] text-slate-700 dark:text-white/75">
              <li><b>1.</b> Ballots unlock at <b>{VOTE_UNLOCK_AT} confirmed players</b> — no stitching it up early.</li>
              <li><b>2.</b> Every registered player gets <b>one ballot</b> — pick the one player you want captaining.</li>
              <li><b>3.</b> You can <b>vote for yourself</b>, and change your ballot any time until voting closes.</li>
              <li><b>4.</b> The count stays <b>hidden from everyone</b> until voting closes 🤐</li>
              <li><b>5.</b> The <b>2 most-voted</b> become the captains of the two teams. Ties broken by SCC rating.</li>
            </ol>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-2">
              Captains are <b>not auctioned</b> — they're assigned to their own team automatically, and each
              picks their own deputy after the auction.
            </p>
          </div>

          {!myId ? (
            <div className="flex justify-center"><MyStatsButton /></div>
          ) : !canVote ? (
            /* Eligibility is the registration itself. Anyone could vote before
               this — including players sitting out, and anyone who had simply
               picked a profile without registering at all. */
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
              <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                {mine?.status === 'out' ? "You're sitting this one out" : 'Register first to vote'}
              </p>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-1.5">
                {mine?.status === 'out'
                  ? "Only players in the auction pick the captains — they're the ones who'll be playing under them. Tap I'm IN above if you'd like a say 🔥"
                  : 'Confirm you\'re in above, then come back and cast your ballot 👑'}
              </p>
            </div>
          ) : !votingOpen ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
              <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" /> Voting opens at {VOTE_UNLOCK_AT} confirmed players
              </p>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-1.5">
                Ballots stay shut until most of the squad is in — otherwise the first few to register
                decide the captains for everyone else.
              </p>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, (count / VOTE_UNLOCK_AT) * 100)}%` }} />
              </div>
              <p className="text-[11px] font-bold text-amber-600 mt-1.5">
                {count} of {VOTE_UNLOCK_AT} · {Math.max(0, VOTE_UNLOCK_AT - count)} more to unlock 🔓
              </p>
              <p className="text-[11px] text-slate-500 dark:text-white/60 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-white/10">
                👑 Don't want to captain? Untick <b>"Put me on the captain ballot"</b> above <b>before voting opens</b> —
                after that it's locked, and a vote spent on someone who declines is a wasted vote.
                <span className="block mt-1 font-bold text-slate-600 dark:text-white/70">
                  {candidates.length} of {count} are up for it so far.
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1.5">
                  👑 My captain pick <span className="text-slate-400">· {candidates.length} on the ballot</span>
                </p>
                <select value={capPick} onChange={e => setCapPick(e.target.value)} className={inputCls}>
                  <option value="">Pick a captain…</option>
                  {candidates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-white/60 mt-1.5">
                  Only players who said they're up for the job are listed — no wasted votes.
                </p>
                {ballotWithdrawn && (
                  <p className="text-[11px] font-bold text-rose-500 mt-1.5">
                    ⚠️ The player you voted for is no longer on the ballot — please pick again.
                  </p>
                )}
              </div>
              <button onClick={vote} disabled={voting || !capPick || league.tableMissing}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 disabled:opacity-40 text-white font-black py-3 text-sm transition-all shadow-md">
                {voting ? 'Saving…' : myBallot ? 'Update my ballot' : 'Cast my vote 👑'}
              </button>
              {voteMsg && (
                <p className={`text-sm font-bold text-center ${voteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{voteMsg}</p>
              )}
            </div>
          )}

          {/* Running count — ADMIN ONLY. If members can watch the numbers move
              they stop voting for who should captain and start voting to swing
              the result, which is exactly what we don't want. */}
          {votingOpen && !isAdmin && league.tally.ballots > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 text-center">
              <p className="text-3xl">🔒</p>
              <p className="text-sm font-black text-slate-800 dark:text-white mt-1">
                {league.tally.ballots} ballot{league.tally.ballots === 1 ? '' : 's'} cast
              </p>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-1 max-w-xs mx-auto">
                Who's leading stays sealed until voting closes — vote for who you actually want,
                not for who's ahead 😏
              </p>
            </div>
          )}

          {isAdmin && league.tally.ballots > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Admin only · Leading {REVEAL_TOP_N}
              </p>
              {/* Names and order only. No vote counts anywhere on screen — the
                  admin password is shared, so a number here is a number the
                  whole club can read. Run scripts/league_votes.sh for the real
                  numbers. */}
              {league.revealed.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2.5 py-1.5">
                  <span className={`text-sm font-black w-5 ${i < 2 ? 'text-amber-500' : 'text-slate-300'}`}>
                    {i + 1}
                  </span>
                  <Avatar member={memberById[c.id]} size={28} />
                  <span className="text-sm font-bold flex-1 truncate text-slate-700 dark:text-white/80">
                    {memberById[c.id]?.name ?? '?'}
                  </span>
                  {c.tied && (
                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                      tie
                    </span>
                  )}
                  {i < 2 && <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
                </div>
              ))}
              <p className="text-[11px] text-slate-500 dark:text-white/60 mt-2">
                Order only — vote counts are never shown in the app.
                {league.revealed.some(c => c.tied) && (
                  <> Level pegging is split on <b>SCC Rankings rating</b>, then a coin toss 🪙</>
                )}
              </p>

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
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/70">
                          Team {i + 1} · name TBD
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar member={memberById[cid]} size={34} ring="rgba(255,255,255,.6)" />
                          <div className="min-w-0">
                            <p className="font-black text-sm truncate flex items-center gap-1">
                              <Crown className="w-3 h-3" fill="currentColor" />
                              {memberById[cid]?.name?.split(' ')[0] ?? '?'}
                            </p>
                            <p className="text-white/75 text-[10px]">Captain</p>
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

        {/* ── RULEBOOK ─────────────────────────────────────────────────── */}
        <div className="glass rounded-3xl p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-600 dark:text-white/70 mb-1 flex items-center gap-1.5">
            <ScrollText className="w-4 h-4" /> The rulebook
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
            Everything settled up front so auction night is arguments about <i>players</i>, not rules 😄
          </p>

          {/* Key numbers at a glance */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { v: formatPrice(PURSE_LAKH), l: 'Purse / team', c: 'from-amber-400 to-orange-500' },
              { v: String(SQUAD_SIZE), l: 'Players / squad', c: 'from-violet-500 to-purple-600' },
              { v: String(SQUAD_TARGET), l: 'Needed to start', c: 'from-emerald-500 to-teal-500' },
            ].map(k => (
              <div key={k.l} className={`rounded-2xl p-3 text-center text-white bg-gradient-to-br ${k.c} shadow-md`}>
                <p className="font-display text-lg font-extrabold leading-none">{k.v}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/80 mt-1">{k.l}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {ALL_RULES.map(section => (
              <details key={section.title} className="group rounded-2xl bg-white/60 dark:bg-white/5 overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none">
                  <span className="text-lg">{section.emoji}</span>
                  <span className="flex-1 font-bold text-sm text-slate-800 dark:text-white">{section.title}</span>
                  <span className="text-[10px] font-bold text-slate-400">{section.rules.length} rules</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <ol className="px-4 pb-4 space-y-2">
                  {section.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-white/70">
                      <span className="font-black text-violet-500 shrink-0">{i + 1}.</span>
                      {/* **bold** markers from the rulebook */}
                      <span dangerouslySetInnerHTML={{
                        __html: rule.replace(/\*\*(.+?)\*\*/g, '<b class="text-slate-900 dark:text-white">$1</b>'),
                      }} />
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs pb-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Register → vote → get bought → lift the trophy 🏆
        </p>
      </div>
    </div>
  );
}
