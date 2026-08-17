import { useMemo, useState } from 'react';
import { Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMe } from '../context/MemberContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCardStats } from '../hooks/useCardStats';
import { tierFor, role } from '../lib/playerCard';
import { SignInCard } from '../components/SignInCard';

// ─── Season Wrapped ───────────────────────────────────────────────────────────
// The payoff for two seasons of collecting numbers nobody re-reads. Every figure
// here already existed somewhere in the app; what's new is that it's about YOU,
// in an order that builds, and small enough to send to the group.
//
// Built as full-screen cards rather than a report because that's what gets
// shared. A table of season stats is something you look at once; a card with one
// number on it is something people send each other.

interface Card {
  kicker: string;
  headline: string;
  sub: string;
  bg: string;
}

export function Wrapped() {
  const { me } = useMe();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { all, statsFor } = useCardStats();
  const [i, setI] = useState(0);

  const cards = useMemo<Card[]>(() => {
    if (!me) return [];
    const s = statsFor(me.id);
    const tier = tierFor(s, all);

    // Season window matches the rest of the app: Oct → Sep.
    const season = matches.filter(m => m.date >= '2025-10-01' && m.date <= '2026-09-30');
    const mine = season.filter(m => m.players?.some(p => p.member_id === me.id));
    const won = mine.filter(m => m.result === 'won').length;
    const moms = season.filter(m => m.man_of_match_id === me.id).length;

    // Who you played most alongside — the season's real story is usually a
    // person, not a number.
    const together = new Map<string, number>();
    for (const m of mine) {
      for (const p of m.players ?? []) {
        if (p.member_id !== me.id) together.set(p.member_id, (together.get(p.member_id) ?? 0) + 1);
      }
    }
    const partner = [...together.entries()].sort((a, b) => b[1] - a[1])[0];
    const partnerName = partner ? members.find(x => x.id === partner[0])?.name : null;

    const rankedByMatches = [...members]
      .map(x => ({ id: x.id, n: season.filter(m => m.players?.some(p => p.member_id === x.id)).length }))
      .sort((a, b) => b.n - a.n);
    const turnoutRank = rankedByMatches.findIndex(r => r.id === me.id) + 1;

    const out: Card[] = [
      {
        kicker: 'Your season',
        headline: `${mine.length} matches`,
        sub: turnoutRank
          ? `That's #${turnoutRank} of ${members.length} for turning up. ${mine.length ? 'The club runs on people who show up.' : ''}`
          : 'A quiet one.',
        bg: 'linear-gradient(160deg,#064e3b,#022c22)',
      },
      {
        kicker: 'With the bat',
        headline: `${s.runs} runs`,
        sub: s.runs ? `Off your own bat, across the season.` : 'Next season is wide open.',
        bg: 'linear-gradient(160deg,#7c2d12,#431407)',
      },
      {
        kicker: 'With the ball',
        headline: `${s.wickets} wickets`,
        sub: s.wickets ? 'Every one of them changed a game.' : 'The bowling boots are still in the bag.',
        bg: 'linear-gradient(160deg,#1e3a8a,#172554)',
      },
      {
        kicker: 'Results',
        headline: `${won} wins`,
        sub: mine.length ? `You were on the winning side ${Math.round((won / mine.length) * 100)}% of the time.` : '—',
        bg: 'linear-gradient(160deg,#4c1d95,#2e1065)',
      },
    ];

    if (moms) {
      out.push({
        kicker: 'Man of the Match',
        headline: moms === 1 ? 'Once' : `${moms} times`,
        sub: 'The whole club agreed you won it.',
        bg: 'linear-gradient(160deg,#a16207,#451a03)',
      });
    }
    if (partnerName) {
      out.push({
        kicker: 'Your season partner',
        headline: partnerName,
        sub: `${partner![1]} matches side by side. That's not a coincidence.`,
        bg: 'linear-gradient(160deg,#0f766e,#042f2e)',
      });
    }
    out.push({
      kicker: 'And so',
      headline: tier.label,
      sub: `${role(s)} · Sangria CC 2025–26. See you next season.`,
      bg: 'linear-gradient(160deg,#0c4a6e,#082f49)',
    });
    return out;
  }, [me, members, matches, all, statsFor]);

  const share = async () => {
    const c = cards[i];
    const text = `My Sangria CC season 2025–26:\n\n${c.headline} — ${c.kicker}\n${c.sub}\n\nsangriacricket.club`;
    // Native share where it exists (that's a phone, which is where this gets
    // sent from); clipboard everywhere else.
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* dismissed */ } }
    await navigator.clipboard.writeText(text);
    alert('Copied — paste it into WhatsApp.');
  };

  if (!me) {
    return (
      <div>
        <Header title="Season Wrapped" subtitle="Your 2025–26" />
        <div className="p-4 max-w-md mx-auto"><SignInCard /></div>
      </div>
    );
  }

  const c = cards[i];
  return (
    <div>
      <Header title="Season Wrapped" subtitle={`${me.name.split(' ')[0]}'s 2025–26`} />
      <div className="p-4 max-w-md mx-auto">
        {/* Progress pips — how far through, without a scrollbar. */}
        <div className="flex gap-1 mb-3">
          {cards.map((_, n) => (
            <div key={n} className={`h-1 flex-1 rounded-full ${
              n <= i ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/15'}`} />
          ))}
        </div>

        <div className="relative r-card overflow-hidden text-white shadow-2xl min-h-[380px]
                        flex flex-col justify-end p-7" style={{ background: c.bg }}>
          <p className="t-meta font-black uppercase tracking-[2.5px] text-white/60">{c.kicker}</p>
          <p className="font-display text-5xl font-extrabold leading-[1.05] mt-2">{c.headline}</p>
          <p className="text-white/75 text-sm mt-3 leading-snug">{c.sub}</p>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}
            className="p-3 r-card border border-slate-200 dark:border-white/10 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={share}
            className="flex-1 py-3 r-card bg-emerald-500 text-white font-black text-sm
                       inline-flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> Share this
          </button>
          <button onClick={() => setI(n => Math.min(cards.length - 1, n + 1))}
            disabled={i === cards.length - 1}
            className="p-3 r-card border border-slate-200 dark:border-white/10 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Wrapped;
