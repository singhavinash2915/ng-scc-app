import { useMemo, useState } from 'react';
import { Trophy, Share2, Sparkles } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import { AwardCertificateModal } from '../components/AwardCertificateModal';
import { SEASON_AWARDS, SEASON_AWARDS_YEAR, type SeasonAwardWinner } from '../config/seasonAwards';
import type { Member } from '../types';
import type { Award } from '../hooks/useSeasonFinale';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function SeasonAwards() {
  const { members } = useMembers();
  const [certAward, setCertAward] = useState<Award | null>(null);

  const byName = useMemo(() => {
    const exact: Record<string, Member> = {};
    const first: Record<string, Member> = {};
    members.forEach(m => {
      exact[norm(m.name)] = m;
      const f = norm(m.name.split(' ')[0]);
      if (f && !first[f]) first[f] = m;
    });
    return { exact, first };
  }, [members]);

  const resolve = (w: SeasonAwardWinner): Member | undefined =>
    byName.exact[norm(w.match)] ?? byName.first[norm(w.match.split(' ')[0])];

  const nameOf = (w: SeasonAwardWinner) => w.display ?? resolve(w)?.name ?? w.match;

  const shareCard = (w: SeasonAwardWinner) => {
    const m = resolve(w);
    const member: Member | null = m
      ? { ...m, name: nameOf(w) }
      : ({ id: w.key, name: nameOf(w), avatar_url: null } as unknown as Member);
    setCertAward({ key: w.key, title: w.title, emoji: w.emoji, member, value: w.stat, blurb: `Season ${SEASON_AWARDS_YEAR} · Awards Night` });
  };

  return (
    <div className="min-h-screen aurora-bg">
      <Header title="Season Awards" subtitle={`Our champions of ${SEASON_AWARDS_YEAR}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* Hero */}
        <div className="rounded-3xl p-6 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b 55%,#fde68a)' }}>
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
          <Trophy className="w-11 h-11 mx-auto drop-shadow" fill="currentColor" />
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 drop-shadow">Season {SEASON_AWARDS_YEAR} Champions 🏆</h1>
          <p className="text-white/90 text-sm mt-1.5 font-medium">Awards Night · Barguje Farms · celebrating the season's finest 🎉</p>
        </div>

        {/* Winner cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SEASON_AWARDS.map(w => {
            const m = resolve(w);
            return (
              <div key={w.key} className="rounded-3xl p-5 text-white relative overflow-hidden shadow-lg" style={{ background: w.accent }}>
                <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="flex items-center gap-1.5 text-white/90 text-[10px] font-black uppercase tracking-[2px]">
                  <Sparkles className="w-3.5 h-3.5" /> {w.title}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-white/70 shadow-lg flex-shrink-0 bg-white/15 flex items-center justify-center">
                    {m?.avatar_url
                      ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-3xl font-black">{nameOf(w).charAt(0)}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-3xl leading-none">{w.emoji}</div>
                    <p className="font-display text-xl font-extrabold mt-1 leading-tight truncate">{nameOf(w)}</p>
                    <p className="text-white/85 text-xs font-medium mt-0.5">{w.stat}</p>
                  </div>
                </div>
                <button onClick={() => shareCard(w)}
                  className="mt-4 inline-flex items-center gap-1.5 bg-white/90 text-slate-900 font-black text-xs rounded-full px-3.5 py-2 hover:bg-white transition">
                  <Share2 className="w-3.5 h-3.5" /> Share card
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-slate-400 dark:text-white/40 text-xs pb-6">Congratulations to all our champions 👏 · Sangria Cricket Club</p>
      </div>

      {certAward && <AwardCertificateModal isOpen={!!certAward} onClose={() => setCertAward(null)} award={certAward} season={SEASON_AWARDS_YEAR} />}
    </div>
  );
}
