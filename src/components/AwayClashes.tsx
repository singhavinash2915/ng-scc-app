import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useUnavailability } from '../hooks/useUnavailability';
import { useMemberActivity } from '../hooks/useMemberActivity';
import type { Match, Member } from '../types';

// ─── Late changes ─────────────────────────────────────────────────────────────
// The point of collecting availability is not the list — it's being told when
// something you already booked stops working. Someone blocking a week in
// November is information; someone blocking a week that contains a fixture they
// are PICKED for is a problem, and it should not be found by scrolling.
//
// Entirely derived, so there is nothing to mark as read and nothing to go
// stale: the warning exists exactly as long as the clash does, and disappears
// the moment the squad or the dates change.

interface Props {
  matches: Match[];
  members: Member[];
  /** Dashboard wants the top couple; the availability page wants all of them. */
  limit?: number;
}

export function AwayClashes({ matches, members, limit }: Props) {
  const U = useUnavailability();
  const { activeMembers } = useMemberActivity(members, matches);
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const clashes = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return matches
      .filter(m => m.result === 'upcoming' && m.date >= today)
      .map(m => {
        const away = U.awayOn(m.date);
        // Picked and away — the actionable case.
        const picked = (m.players ?? [])
          .filter(p => away.has(p.member_id))
          .map(p => byId.get(p.member_id)?.name.split(' ')[0] ?? '—');
        // No squad yet: the useful number is how many regulars are gone.
        const regularsAway = activeMembers.filter(x => away.has(x.id)).length;
        return { match: m, picked, regularsAway, squadPicked: (m.players ?? []).length > 0 };
      })
      .filter(c => (c.squadPicked ? c.picked.length > 0 : c.regularsAway >= 5))
      .sort((a, b) => a.match.date.localeCompare(b.match.date));
  }, [matches, U, byId, activeMembers]);

  if (!clashes.length) return null;
  const shown = limit ? clashes.slice(0, limit) : clashes;

  return (
    <div className="r-card border border-amber-200 dark:border-amber-400/25
                    bg-amber-50/70 dark:bg-amber-500/10 p-4">
      <p className="t-micro font-black uppercase tracking-[1.5px] text-amber-700
                    dark:text-amber-300 inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Needs a look
      </p>
      <div className="mt-2 space-y-2">
        {shown.map(c => (
          <Link key={c.match.id} to="/matches" className="flex items-center gap-2 group">
            <div className="flex-1 min-w-0">
              <p className="font-black t-body text-slate-900 dark:text-white truncate">
                {new Date(c.match.date + 'T00:00:00').toLocaleDateString('en-GB',
                  { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}{c.match.opponent || 'SCC'}
              </p>
              <p className="t-meta text-amber-700 dark:text-amber-300">
                {c.squadPicked
                  ? `${c.picked.join(', ')} ${c.picked.length === 1 ? 'is' : 'are'} away — picked for this match`
                  : `${c.regularsAway} regular${c.regularsAway === 1 ? '' : 's'} away, squad not picked yet`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
        {limit && clashes.length > limit && (
          <Link to="/availability" className="block t-meta font-bold text-amber-700 dark:text-amber-300">
            +{clashes.length - limit} more
          </Link>
        )}
      </div>
    </div>
  );
}
