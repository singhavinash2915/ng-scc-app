import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Crown, Sparkles, ChevronRight, Star } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useSeasonFinale, type XIPlayer, type Award, type ReportCard } from '../hooks/useSeasonFinale';
import { ClubWrappedStory } from '../components/ClubWrappedStory';
import type { Member } from '../types';

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
const GRADE_COLOR = (g: string) =>
  g === 'A+' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'
  : g === 'A' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20'
  : g.startsWith('B') ? 'text-sky-500 dark:text-sky-300 bg-sky-500/12 border-sky-400/25'
  : 'text-amber-500 dark:text-amber-300 bg-amber-500/12 border-amber-400/25';

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

function AwardCard({ award, revealed, onReveal }: { award: Award; revealed: boolean; onReveal: () => void }) {
  if (!award.member) return null;
  return (
    <button onClick={onReveal} disabled={revealed}
      className={`relative overflow-hidden rounded-2xl p-4 text-left w-full transition-all ${revealed ? 'glass' : 'bg-gradient-to-br from-violet-600/30 to-indigo-700/20 border border-violet-400/30 hover:from-violet-600/40'}`}>
      <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-slate-500 dark:text-white/50">{award.emoji} {award.title}</p>
      {revealed ? (
        <div className="flex items-center gap-3 mt-2" style={{ animation: 'awardPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <Avatar m={award.member} ring="border-amber-400/50" />
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{award.member.name}</p>
            <p className="text-[11px] font-bold text-amber-500 dark:text-amber-300 tabular-nums">{award.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{award.blurb}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm font-black text-violet-100 mt-3 flex items-center gap-1.5">🥁 Tap to reveal</p>
      )}
    </button>
  );
}

function ReportCardRow({ rc }: { rc: ReportCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-3 py-2.5">
        <Avatar m={rc.member} size="w-9 h-9" />
        <span className="flex-1 text-left text-sm font-black text-slate-900 dark:text-white truncate">{rc.member.name}</span>
        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${GRADE_COLOR(rc.overall)}`}>{rc.overall}</span>
        <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-white/40 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-white/8">
          <div className="grid grid-cols-4 gap-2 my-2">
            {([['Bat', rc.batting], ['Bowl', rc.bowling], ['Field', rc.fielding], ['Impact', rc.impact]] as const).map(([l, g]) => (
              <div key={l} className="text-center rounded-lg bg-slate-50 dark:bg-white/[0.04] py-2">
                <p className={`text-sm font-black ${GRADE_COLOR(g).split(' ')[0]}`}>{g}</p>
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-gray-300 italic">“{rc.note}”</p>
        </div>
      )}
    </div>
  );
}

export function SeasonFinale() {
  const { bestXI, awards, reportCards, clubWrapped } = useSeasonFinale(SEASON);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const revealAll = () => setRevealed(new Set(awards.map(a => a.key)));

  return (
    <div className="aurora-bg min-h-screen">
      <Header title="Season Finale" subtitle={`Sangria Cricket Club · ${SEASON}`} />
      <div className="p-4 lg:p-8 space-y-4 max-w-2xl mx-auto">

        {/* Hero */}
        <div className="glass rounded-2xl p-5 text-center relative overflow-hidden">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(251,191,36,0.16)' }} />
          <Trophy className="w-10 h-10 text-amber-500 dark:text-amber-300 mx-auto drop-shadow-[0_0_18px_rgba(251,191,36,0.5)]" fill="currentColor" />
          <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">Season {SEASON} Finale 🏏</h2>
          <p className="text-slate-500 dark:text-white/60 text-sm mt-1">{clubWrapped.played} matches · {clubWrapped.winPct}% win rate · MVP {clubWrapped.mvp?.name ?? '—'}</p>
        </div>

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

        {/* Team of the Season */}
        <BestXISection xi={bestXI} />

        {/* Awards Night */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 dark:text-amber-300" fill="currentColor" />
              <span className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 dark:text-amber-200">Awards Night</span>
            </div>
            {revealed.size < awards.length && (
              <button onClick={revealAll} className="text-[11px] font-bold text-violet-600 dark:text-violet-300 hover:text-violet-200">Reveal all →</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {awards.map(a => (
              <AwardCard key={a.key} award={a} revealed={revealed.has(a.key)}
                onReveal={() => setRevealed(s => new Set(s).add(a.key))} />
            ))}
          </div>
        </div>

        {/* Report Cards */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-sky-500 dark:text-sky-300" />
            <span className="text-[11px] font-black uppercase tracking-[2px] text-sky-600 dark:text-sky-200">Player Report Cards</span>
          </div>
          <div className="space-y-2">
            {reportCards.map(rc => <ReportCardRow key={rc.member.id} rc={rc} />)}
          </div>
        </div>

        <div className="h-4" />
      </div>

      {wrappedOpen && <ClubWrappedStory data={clubWrapped} onClose={() => setWrappedOpen(false)} />}
      <style>{`@keyframes awardPop{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export default SeasonFinale;
