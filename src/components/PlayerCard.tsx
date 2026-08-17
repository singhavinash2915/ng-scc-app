import { Link } from 'react-router-dom';
import { tierFor, role, type CardStats } from '../lib/playerCard';
import type { Member } from '../types';

// ─── Player card ──────────────────────────────────────────────────────────────
// The signature object of the app: one recognisable thing that shows up on a
// profile, in a squad pick, in the auction and in a comparison, instead of each
// of those inventing its own player row.
//
// Everything on it is earned from match data — tier, role, numbers. Nothing is
// assigned by an admin, which is the point: the card changes through the season
// because the player does, and nobody has to maintain it.

interface Props {
  member: Member;
  stats: CardStats;
  /** The whole squad's stats — a tier is a position among peers, not a score. */
  all: CardStats[];
  /** Compact drops the stat row: for dense grids and pickers. */
  size?: 'full' | 'compact';
  /** Overrides the profile link — e.g. a squad picker wants to select, not navigate. */
  onClick?: () => void;
}

export function PlayerCard({ member, stats, all, size = 'full', onClick }: Props) {
  const tier = tierFor(stats, all);
  const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('');

  const inner = (
    <div className={`relative overflow-hidden r-card border-2 ${tier.ring}
                     bg-white dark:bg-white/5 p-4 h-full
                     transition-transform active:scale-[0.98]`}>
      {/* Tier wash — the card's whole colour identity, kept behind the content. */}
      <div className={`absolute inset-x-0 -top-16 h-32 bg-gradient-to-b ${tier.glow}
                       blur-2xl pointer-events-none`} />

      <div className="relative flex items-start gap-3">
        {member.avatar_url
          ? <img src={member.avatar_url} alt="" className="w-14 h-14 r-card object-cover" />
          : (
            <div className="w-14 h-14 r-card bg-slate-100 dark:bg-white/10 flex items-center
                            justify-center font-black text-slate-500 dark:text-white/60">
              {initials}
            </div>
          )}
        <div className="flex-1 min-w-0">
          <span className={`inline-block t-micro font-black uppercase tracking-[1.5px]
                            px-2 py-0.5 rounded-full ${tier.chip}`}>
            {tier.label}
          </span>
          <p className="font-display font-extrabold text-slate-900 dark:text-white truncate mt-1 leading-tight">
            {member.name}
          </p>
          <p className="t-meta font-semibold text-slate-400">{role(stats)}</p>
        </div>
      </div>

      {size === 'full' && (
        <div className="relative grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
          {[
            { k: 'Runs', v: stats.runs },
            { k: 'Wkts', v: stats.wickets },
            { k: 'Mat', v: stats.matches },
          ].map(s => (
            <div key={s.k} className="text-center">
              <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
                {s.v}
              </p>
              <p className="t-micro font-black uppercase tracking-wider text-slate-400 mt-0.5">{s.k}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} className="text-left w-full">{inner}</button>;
  }
  return <Link to={`/profile/${member.id}`} className="block">{inner}</Link>;
}
