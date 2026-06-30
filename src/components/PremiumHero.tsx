import { Link } from 'react-router-dom';
import { ArrowRight, Target } from 'lucide-react';

interface Props {
  firstName: string | null;
  profileId: string | null;
  avatarUrl: string | null;
  winRate: number;
  won: number;
  lost: number;
  matchesPlayed: number;
  upcomingCount: number;
  nextOpponent: string | null;
  nextDate: string | null;
  activeMembers: number;
  totalMembers: number;
  streak: { result: string; count: number } | null;
  lastFive: Array<{ id: string; result: string }>;
  myRuns: number | null;
  myWkts: number | null;
  myMoms: number;
  milestone: { away: number; label: string } | null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Premium dashboard hero — theme-aware (light + dark), accent-tinted.
 * Greeting + win-rate donut + CTAs, a personal stat strip (runs/wkts/MOM +
 * next milestone), and a bento stat grid. Carries the member-attracting data
 * the old hero had, in the new design.
 */
export function PremiumHero({ firstName, profileId, avatarUrl, winRate, won, lost, matchesPlayed, upcomingCount, nextOpponent, nextDate, activeMembers, totalMembers, streak, lastFive, myRuns, myWkts, myMoms, milestone }: Props) {
  const circ = 2 * Math.PI * 50;
  const offset = circ - (winRate / 100) * circ;
  const nextDateShort = nextDate ? new Date(nextDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;

  return (
    <div className="space-y-3">
      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-[22px] p-6 lg:p-7
        bg-white border border-slate-200/80 shadow-[0_18px_44px_-22px_rgba(20,33,61,0.28)]
        dark:bg-white/[0.055] dark:border-white/10 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] dark:backdrop-blur-xl">
        <div className="absolute -top-12 -right-8 w-56 h-56 rounded-full accent-glow blur-3xl opacity-50 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-5 flex-wrap">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full accent-soft text-accent">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--a1)' }} />
              Season 2025–26 · live
            </span>
            <h1 className="font-display text-[28px] lg:text-[34px] font-extrabold leading-[1.05] mt-3.5 text-slate-900 dark:text-white">
              {greeting()}, <span className="accent-grad">{firstName || 'Skipper'}</span> 🏏
            </h1>
            <p className="text-slate-500 dark:text-gray-400 text-sm lg:text-[15px] mt-1.5 max-w-md">
              Your club at a glance — {activeMembers} active members
              {streak && streak.count >= 2 ? `, a ${streak.count}-match ${streak.result === 'won' ? 'win' : 'losing'} streak` : ''}.
            </p>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Link to="/matches" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-accent-grad shadow-accent">
                Open Match Centre <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Win-rate donut */}
          <div className="rounded-[16px] px-5 py-4 text-center min-w-[160px]
            bg-slate-50 border border-slate-200/70 dark:bg-white/[0.04] dark:border-white/10">
            <div className="relative w-[120px] h-[120px] mx-auto">
              <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" strokeWidth="11" className="stroke-slate-200 dark:stroke-white/10" />
                <circle cx="60" cy="60" r="50" fill="none" strokeWidth="11" strokeLinecap="round" stroke="url(#hg)"
                  strokeDasharray={circ} strokeDashoffset={offset} />
                <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--a1)" /><stop offset="1" stopColor="var(--a3)" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-display text-[26px] font-extrabold text-slate-900 dark:text-white">{winRate}%</div>
            </div>
            <div className="text-xs text-slate-400 dark:text-gray-500 font-semibold mt-1">Win rate · {won}W–{lost}L</div>
          </div>
        </div>

        {/* ── Personal strip ── */}
        {profileId && (
          <div className="relative mt-5 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-11 h-11 rounded-xl object-cover border-2 border-[color:var(--a1)]/40" />
                : <div className="w-11 h-11 rounded-xl bg-accent-grad flex items-center justify-center font-black">{(firstName || '?')[0]}</div>}
              <div className="min-w-0">
                <p className="font-display font-bold text-slate-900 dark:text-white text-base leading-tight">Hey, {firstName}! 🏏</p>
                <p className="text-[12px] mt-0.5">
                  <span className="text-slate-500 dark:text-gray-300">{myRuns ?? 0} runs · {myWkts ?? 0} wkts</span>
                  {myMoms > 0 && <span className="text-amber-500 dark:text-amber-300 font-bold"> · {myMoms} MOM</span>}
                  <span className="text-slate-400 dark:text-gray-500"> this season</span>
                </p>
                {milestone && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200 text-[10px] font-bold">
                    <Target className="w-3 h-3" /> {milestone.away} more to {milestone.label}
                  </span>
                )}
              </div>
            </div>
            <Link to={`/profile/${profileId}`} className="shrink-0 px-4 py-2 rounded-full bg-accent-grad text-sm font-bold shadow-accent">
              My Profile →
            </Link>
          </div>
        )}
      </div>

      {/* ── Bento stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { v: matchesPlayed, l: 'Matches', tag: 'all-time', accent: false },
          { v: won, l: 'Won', tag: streak && streak.result === 'won' && streak.count >= 2 ? `🔥 ${streak.count} win streak` : 'this season', accent: true },
          { v: `${winRate}%`, l: 'Win %', tag: `${won}W · ${lost}L`, accent: false },
          nextOpponent
            ? { v: <span className="text-[20px] lg:text-[22px]">vs {nextOpponent}</span>, l: 'Next match', tag: nextDateShort ? `🗓️ ${nextDateShort}` : 'upcoming', accent: true }
            : { v: upcomingCount, l: 'Upcoming', tag: `${activeMembers}/${totalMembers} active`, accent: false },
        ].map((s, i) => (
          <div key={i} className="rounded-[18px] p-4
            bg-white border border-slate-200/80 shadow-[0_18px_44px_-26px_rgba(20,33,61,0.22)]
            dark:bg-white/[0.05] dark:border-white/10 dark:shadow-none">
            <div className={`font-display text-[28px] lg:text-[30px] font-extrabold tabular-nums leading-none ${s.accent ? 'accent-grad' : 'text-slate-900 dark:text-white'}`}>{s.v}</div>
            <div className="text-slate-500 dark:text-gray-400 text-[12.5px] font-semibold mt-1">{s.l}</div>
            <span className="inline-block mt-2.5 text-[11px] font-bold px-2.5 py-1 rounded-full accent-soft text-accent">{s.tag}</span>
          </div>
        ))}
      </div>

      {/* ── Form strip ── */}
      {lastFive.length > 0 && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-slate-400 dark:text-gray-500 text-[9px] font-bold uppercase tracking-widest mr-1">Form</span>
          {lastFive.map(m => (
            <div key={m.id} className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-sm ${
              m.result === 'won' ? 'bg-emerald-500' : m.result === 'lost' ? 'bg-rose-500' : 'bg-amber-500'}`}>
              {m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'D'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
