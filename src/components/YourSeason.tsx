import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import { useMe } from '../context/MemberContext';
import type { Match, Member } from '../types';

// ─── Your season ──────────────────────────────────────────────────────────────
// The first block on the Dashboard once you're signed in, and the point of the
// whole identity layer: the same club data, addressed to one person.
//
// It answers the four questions a member actually opens the app for — am I
// playing, am I picked, do I owe money, how am I doing — and nothing else. The
// club-wide blocks below it haven't changed; this just gets there first.

interface Props {
  matches: Match[];
  members: Member[];
}

/** A single line of "here's where you stand", with somewhere to go about it. */
interface Item {
  label: string;
  value: string;
  detail?: string;
  to: string;
  tone: 'green' | 'amber' | 'slate';
}

export function YourSeason({ matches, members }: Props) {
  const { me, signOut } = useMe();
  const [confirmOut, setConfirmOut] = useState(false);

  const items = useMemo<Item[]>(() => {
    if (!me) return [];
    const out: Item[] = [];

    // ── Next match, and whether you're in the squad ────────────────────────
    const next = matches
      .filter(m => m.result === 'upcoming')
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) {
      const picked = next.players?.some(p => p.member_id === me.id);
      const when = new Date(next.date + 'T00:00:00')
        .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      out.push({
        label: picked ? "You're picked" : 'Next match',
        value: next.opponent || 'SCC',
        detail: picked ? `${when} · ${next.venue ?? ''}`.trim() : `${when} — squad not announced for you yet`,
        to: '/matches',
        tone: picked ? 'green' : 'slate',
      });
    }

    // ── Your wallet ────────────────────────────────────────────────────────
    // Flagged amber below a match fee's worth, since that's the point at which
    // it stops being a number and starts being a problem on match day.
    const low = me.balance < 500;
    out.push({
      label: 'Your balance',
      value: `₹${Math.round(me.balance).toLocaleString('en-IN')}`,
      detail: low ? 'Running low — top up before the next match' : 'You’re covered for the next few matches',
      to: '/payment',
      tone: low ? 'amber' : 'green',
    });

    // ── Where you sit ──────────────────────────────────────────────────────
    // Ranked on matches played this season; the club's real ranking lives on
    // the leaderboard and this is only a nudge towards it.
    const played = matches.filter(m => m.players?.some(p => p.member_id === me.id)).length;
    const ranked = members
      .map(m => ({ id: m.id, n: matches.filter(x => x.players?.some(p => p.member_id === m.id)).length }))
      .sort((a, b) => b.n - a.n);
    const rank = ranked.findIndex(r => r.id === me.id) + 1;
    out.push({
      label: 'Matches played',
      value: String(played),
      detail: rank ? `#${rank} of ${members.length} for appearances` : undefined,
      to: `/profile/${me.id}`,
      tone: 'slate',
    });

    return out;
  }, [me, matches, members]);

  if (!me) return null;

  const first = me.name.split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
      <div className="flex items-center gap-3">
        {me.avatar_url
          ? <img src={me.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" />
          : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
                            flex items-center justify-center font-black text-lg">
              {first[0]}
            </div>
          )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400">{greet}</p>
          <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white truncate">
            {first}
          </p>
        </div>
        <button onClick={() => (confirmOut ? signOut() : setConfirmOut(true))}
          onBlur={() => setConfirmOut(false)}
          className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1 px-2 py-1">
          <LogOut className="w-3.5 h-3.5" />
          {confirmOut ? 'Sure?' : ''}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {items.map(it => (
          <Link key={it.label} to={it.to}
            className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 border group ${
              it.tone === 'green' ? 'border-emerald-200 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-500/10'
              : it.tone === 'amber' ? 'border-amber-200 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-500/10'
              : 'border-slate-200 dark:border-white/10'}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{it.label}</p>
              <p className="font-black text-[15px] text-slate-900 dark:text-white truncate">{it.value}</p>
              {it.detail && (
                <p className="text-[11px] text-slate-500 dark:text-white/50 truncate">{it.detail}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}
