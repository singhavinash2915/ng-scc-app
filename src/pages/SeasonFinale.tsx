import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Crown, Sparkles, Star } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useSeasonFinale, type XIPlayer, type Award, type ClubWrapped } from '../hooks/useSeasonFinale';
import { ClubWrappedStory } from '../components/ClubWrappedStory';
import { AwardsPresentation } from '../components/AwardsPresentation';
import { SeasonQuiz } from '../components/SeasonQuiz';
import { AwardCertificateModal } from '../components/AwardCertificateModal';
import { SeasonWrappedButton } from '../components/SeasonWrappedButton';
import { useSeasonAwards } from '../hooks/useSeasonAwards';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';
import { AWARDS_NIGHT, awardsRevealed, isAdminPreview } from '../config/awardsNight';
import type { Member } from '../types';

const AWARDS_NIGHT_DATE = AWARDS_NIGHT.date;

const SEASON = '2025-26';

const Avatar = ({ m, size = 'w-10 h-10', ring = 'border-slate-200 dark:border-white/15' }: { m: Member; size?: string; ring?: string }) =>
  m.avatar_url ? (
    <img src={m.avatar_url} alt="" className={`${size} rounded-xl object-cover border ${ring} flex-shrink-0`} />
  ) : (
    <div className={`${size} rounded-xl flex items-center justify-center border ${ring} bg-white/8 flex-shrink-0`}>
      <span className="text-sm font-black text-white">{m.name.charAt(0)}</span>
    </div>
  );

const ROLE_LABEL: Record<XIPlayer['role'], string> = {
  keeper: '🧤 Wicketkeeper', batter: '🏏 Batters', 'all-rounder': '⚡ All-rounders', bowler: '🎯 Bowlers',
};
function BestXISection({ xi }: { xi: XIPlayer[] }) {
  const order: XIPlayer['role'][] = ['keeper', 'batter', 'all-rounder', 'bowler'];
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-amber-500 dark:text-amber-300" fill="currentColor" />
        <span className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-200">Team of the Season</span>
      </div>
      {order.map(role => {
        const group = xi.filter(p => p.role === role);
        if (!group.length) return null;
        return (
          <div key={role} className="mb-3 last:mb-0">
            <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-slate-400 dark:text-white/40 mb-1.5">{ROLE_LABEL[role]}</p>
            <div className="space-y-1.5">
              {group.map(p => (
                <Link to={`/profile/${p.member.id}`} key={p.member.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 px-3 py-2 hover:bg-slate-100 dark:bg-white/[0.08] transition-colors">
                  <Avatar m={p.member} size="w-9 h-9" ring={p.isCaptain ? 'border-amber-400/60' : 'border-slate-200 dark:border-white/15'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {p.member.name}
                      {p.isCaptain && <span className="text-[8px] font-black bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">C</span>}
                      {p.isVice && <span className="text-[8px] font-black bg-slate-200 text-slate-700 dark:bg-white/20 dark:text-white px-1.5 py-0.5 rounded">VC</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold tabular-nums">{p.line}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AwardCard({ award, revealed, onReveal, onGetCertificate }: { award: Award; revealed: boolean; onReveal: () => void; onGetCertificate: () => void }) {
  if (!award.member) return null;
  return (
    <div
      onClick={!revealed ? onReveal : undefined}
      role={!revealed ? 'button' : undefined}
      tabIndex={!revealed ? 0 : undefined}
      className={`relative overflow-hidden rounded-2xl p-4 text-left w-full transition-all ${revealed ? 'glass' : 'bg-gradient-to-br from-violet-600/30 to-indigo-700/20 border border-violet-400/30 hover:from-violet-600/40 cursor-pointer'}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-slate-500 dark:text-white/50">{award.emoji} {award.title}</p>
      {revealed ? (
        <>
          <div className="flex items-center gap-3 mt-2" style={{ animation: 'awardPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <Avatar m={award.member} ring="border-amber-400/50" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate">{award.member.name}</p>
              <p className="text-[11px] font-bold text-amber-500 dark:text-amber-300 tabular-nums">{award.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{award.blurb}</p>
            </div>
          </div>
          <button
            onClick={onGetCertificate}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg py-1.5 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
          >
            🎖️ Get Certificate
          </button>
        </>
      ) : (
        <p className="text-sm font-black text-violet-100 mt-3 flex items-center gap-1.5">🥁 Tap to reveal</p>
      )}
    </div>
  );
}

// Explains why the "Player of the Season" here can differ from the top name on
// the Leaderboard's Overall board — they deliberately measure different things.
function MvpExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className="text-lg">🧮</span>
        <span className="flex-1 text-sm font-bold text-slate-800 dark:text-white">How is the Player of the Season decided?</span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-[13px] leading-relaxed text-slate-600 dark:text-white/70 space-y-2.5">
          <p>
            The <span className="font-semibold text-slate-800 dark:text-white">Player of the Season</span> here uses an
            <span className="font-semibold"> ICC-style rating</span> — the same one on the <span className="font-semibold">SCC Rankings</span> page.
            It's the <span className="font-semibold">geometric mean</span> of your batting and bowling ratings (plus fielding &amp; Man-of-the-Match),
            and it's <span className="font-semibold">opposition-adjusted</span> — runs and wickets against stronger teams count for more.
            Because it multiplies bat × ball, you have to contribute with <span className="font-semibold">both</span> to top it.
          </p>
          <p>
            The <span className="font-semibold text-slate-800 dark:text-white">Leaderboard → Overall</span> board is a simpler tally:
            <span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded mx-1">runs + wickets×20 + dismissals×10</span>.
            It rewards <span className="font-semibold">volume</span> in a single discipline, so a heavy run-scorer or wicket-taker can lead it.
          </p>
          <p className="text-slate-500 dark:text-white/60">
            👉 That's why the two can crown <span className="font-semibold">different players</span> — it's not a bug, they answer different
            questions: <em>“most complete all-round match-winner”</em> vs <em>“biggest raw contributor”</em>.
          </p>
        </div>
      )}
    </div>
  );
}

function AwardsNightCountdown({ targetDate, clubWrapped }: { targetDate: string; clubWrapped: ClubWrapped }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const teasers = [
    clubWrapped.topScorer ? `🏏 ${clubWrapped.topScorer.name} smashed ${clubWrapped.topScorer.runs} runs this season` : null,
    clubWrapped.topWicket ? `🎯 ${clubWrapped.topWicket.name} took ${clubWrapped.topWicket.wkts} wickets this season` : null,
    clubWrapped.mostMom ? `👑 ${clubWrapped.mostMom.name} bagged ${clubWrapped.mostMom.count} Man of the Match awards` : null,
    `🏆 SCC won ${clubWrapped.winPct}% of matches this season`,
    `🥊 El Clásico: ${clubWrapped.elClasico?.verdict ?? 'still to be settled'}`,
  ].filter(Boolean) as string[];

  const [teaserIdx, setTeaserIdx] = useState(0);
  useEffect(() => {
    if (teasers.length < 2) return;
    const id = setInterval(() => setTeaserIdx(i => (i + 1) % teasers.length), 3500);
    return () => clearInterval(id);
  }, [teasers.length]);

  const diffMs = new Date(targetDate).getTime() - now;
  const isPast = diffMs <= 0;
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  const hours = Math.max(0, Math.floor((diffMs % 86_400_000) / 3_600_000));

  return (
    <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg,#7c2d12,#a16207 55%,#78350f)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[2px] text-amber-200">🎉 Awards Night</p>
          <p className="font-display text-xl font-extrabold mt-0.5">
            {isPast ? "It's party time! 🥳" : `${days}d ${hours}h to go`}
          </p>
        </div>
        {!isPast && (
          <div className="flex gap-1.5">
            {[{ v: days, l: 'Days' }, { v: hours, l: 'Hrs' }].map(({ v, l }) => (
              <div key={l} className="text-center bg-white/15 rounded-xl px-3 py-1.5 min-w-[52px]">
                <p className="font-display text-lg font-extrabold tabular-nums leading-none">{String(v).padStart(2, '0')}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-amber-100">{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {teasers.length > 0 && (
        <p key={teaserIdx} className="text-[12px] text-amber-100 mt-3 font-medium" style={{ animation: 'awardPop 0.4s ease' }}>
          {teasers[teaserIdx]}
        </p>
      )}
    </div>
  );
}

export function SeasonFinale() {
  const { bestXI, awards, clubWrapped } = useSeasonFinale(SEASON);
  const { members } = useMembers();
  const { categories: awardCategories, getResults: getAwardResults } = useSeasonAwards(SEASON);
  const { isAdmin } = useAuth();
  // Whole Awards Night reveal (on-page cards, big-screen reveals, People's picks)
  // stays sealed until the party date — admins can preview anytime.
  const revealUnlocked = awardsRevealed(isAdmin);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [peoplesPresentOpen, setPeoplesPresentOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [certAward, setCertAward] = useState<Award | null>(null);
  const [myId, setMyId] = useState<string>(() => localStorage.getItem('scc-my-profile-id') || '');

  const revealAll = () => setRevealed(new Set(awards.map(a => a.key)));

  // The People's Awards, transformed into the same Award[] shape so we can
  // reuse AwardsPresentation for a live "reveal the crowd's pick" screen.
  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);
  const peoplesAwards: Award[] = useMemo(() => awardCategories
    .map(cat => {
      const top = getAwardResults(cat.id)[0];
      const member = top ? memberById[top.nominee_id] ?? null : null;
      return {
        key: cat.id, title: cat.name, emoji: cat.emoji || '🏆', member,
        value: top ? `${top.count} vote${top.count === 1 ? '' : 's'}` : '—',
        blurb: 'Voted by the squad',
      };
    })
    .filter(a => a.member),
  [awardCategories, getAwardResults, memberById]);

  return (
    <div className="aurora-bg min-h-screen">
      <Header title="Season Finale" subtitle={`Sangria Cricket Club · ${SEASON}`} />
      <div className="p-4 lg:p-8 space-y-4 max-w-2xl mx-auto">

        {/* Hero */}
        <div className="glass rounded-2xl p-5 text-center relative overflow-hidden">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(251,191,36,0.16)' }} />
          <Trophy className="w-10 h-10 text-amber-500 dark:text-amber-300 mx-auto drop-shadow-[0_0_18px_rgba(251,191,36,0.5)]" fill="currentColor" />
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">Season {SEASON} Finale 🏏</h2>
          <p className="text-slate-500 dark:text-white/60 text-sm mt-1">
            {clubWrapped.played} matches · {clubWrapped.winPct}% win rate · MVP {revealUnlocked ? (clubWrapped.mvp?.name ?? '—') : '🔒 sealed'}
          </p>
        </div>

        {/* Awards Night countdown teaser */}
        <AwardsNightCountdown targetDate={AWARDS_NIGHT_DATE} clubWrapped={clubWrapped} />

        {/* How the Player of the Season (MVP) is decided */}
        <MvpExplainer />

        {/* Club Wrapped launcher */}
        <button onClick={() => setWrappedOpen(true)}
          className="w-full relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-3 text-left shadow-lg"
          style={{ background: 'linear-gradient(110deg,#7c3aed,#db2777 55%,#f59e0b)' }}>
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0"><Sparkles className="w-6 h-6 text-white" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">Club Season Wrapped ✨</p>
            <p className="text-white/80 text-xs font-medium">The whole team's year in review — tap to play</p>
          </div>
          <span className="text-white/90 text-xl">→</span>
        </button>

        {/* My Season Wrapped — personal shortcut, right next to the club-wide one */}
        {myId ? (
          <SeasonWrappedButton memberId={myId} season={SEASON} variant="banner" label="Your Season Wrapped" />
        ) : (
          <div className="glass rounded-2xl p-3">
            <select
              value=""
              onChange={e => { if (e.target.value) { setMyId(e.target.value); localStorage.setItem('scc-my-profile-id', e.target.value); } }}
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
            >
              <option value="">👋 Select your name for your personal Wrapped</option>
              {members.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Awards Night party tools ──────────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-200 mb-3 flex items-center gap-1.5">🎉 Awards Night — Party Mode</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button onClick={() => revealUnlocked && setPresentOpen(true)} disabled={!revealUnlocked}
              className="rounded-xl p-3 text-left text-white shadow-md disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#f59e0b,#db2777)' }}>
              <p className="text-2xl">{revealUnlocked ? '🏆' : '🔒'}</p>
              <p className="font-black text-sm mt-1 leading-tight">Awards Reveal</p>
              <p className="text-white/80 text-[11px]">{revealUnlocked ? 'Big-screen, tap to reveal each winner' : `Unlocks ${AWARDS_NIGHT.label}`}</p>
            </button>
            <button onClick={() => setQuizOpen(true)}
              className="rounded-xl p-3 text-left text-white shadow-md" style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)' }}>
              <p className="text-2xl">🧠</p>
              <p className="font-black text-sm mt-1 leading-tight">Season Quiz</p>
              <p className="text-white/80 text-[11px]">How well do you know the season?</p>
            </button>
            <Link to="/vote"
              className="rounded-xl p-3 text-left text-white shadow-md block" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
              <p className="text-2xl">🗳️</p>
              <p className="font-black text-sm mt-1 leading-tight">People's Awards</p>
              <p className="text-white/80 text-[11px]">Open voting — share with everyone!</p>
            </Link>
            <button onClick={() => revealUnlocked && setPeoplesPresentOpen(true)} disabled={!revealUnlocked || peoplesAwards.length === 0}
              className="rounded-xl p-3 text-left text-white shadow-md disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>
              <p className="text-2xl">{revealUnlocked ? '🏅' : '🔒'}</p>
              <p className="font-black text-sm mt-1 leading-tight">Reveal People's Picks</p>
              <p className="text-white/80 text-[11px]">{!revealUnlocked ? `Unlocks ${AWARDS_NIGHT.label}` : peoplesAwards.length > 0 ? 'Big-screen reveal of the crowd\'s winners' : 'No votes yet'}</p>
            </button>
          </div>
        </div>

        {/* Team of the Season */}
        <BestXISection xi={bestXI} />

        {/* Awards Night — sealed until the party date (admins can preview) */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 dark:text-amber-300" fill="currentColor" />
              <span className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-200">Awards Night</span>
            </div>
            {revealUnlocked && revealed.size < awards.length && (
              <button onClick={revealAll} className="text-[11px] font-bold text-violet-600 dark:text-violet-300 hover:text-violet-200">Reveal all →</button>
            )}
          </div>
          {revealUnlocked ? (
            <>
              {isAdminPreview(isAdmin) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-300 mb-3">🔓 Admin preview — sealed for everyone else until {AWARDS_NIGHT.label}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {awards.map(a => (
                  <AwardCard key={a.key} award={a} revealed={revealed.has(a.key)}
                    onReveal={() => setRevealed(s => new Set(s).add(a.key))}
                    onGetCertificate={() => setCertAward(a)} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl">🔒</div>
              <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-2">Sealed until Awards Night</p>
              <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
                The winners drop on <span className="font-bold">{AWARDS_NIGHT.label}</span>. No peeking! 🤫
              </p>
              <Link to="/vote" className="inline-block mt-4 rounded-xl bg-amber-400 text-slate-900 font-black text-sm px-5 py-2.5">
                🗳️ Cast your People's Award votes
              </Link>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {wrappedOpen && <ClubWrappedStory data={clubWrapped} onClose={() => setWrappedOpen(false)} />}
      {revealUnlocked && presentOpen && <AwardsPresentation awards={awards} season={SEASON} onClose={() => setPresentOpen(false)} />}
      {revealUnlocked && peoplesPresentOpen && <AwardsPresentation awards={peoplesAwards} season={SEASON} onClose={() => setPeoplesPresentOpen(false)} />}
      {quizOpen && <SeasonQuiz awards={awards} clubWrapped={clubWrapped} members={members} season={SEASON} onClose={() => setQuizOpen(false)} />}
      {certAward && <AwardCertificateModal isOpen={!!certAward} onClose={() => setCertAward(null)} award={certAward} season={SEASON} />}
      <style>{`@keyframes awardPop{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export default SeasonFinale;
