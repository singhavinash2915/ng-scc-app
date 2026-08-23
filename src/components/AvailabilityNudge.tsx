import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarOff, ChevronRight } from 'lucide-react';
import { useMe } from '../context/MemberContext';
import { useUnavailability } from '../hooks/useUnavailability';
import { useGroundDates } from '../hooks/useGroundDates';

// ─── Ask once ─────────────────────────────────────────────────────────────────
// An empty availability calendar and a fully free club look identical, and the
// scheduling screens cannot tell them apart. So somebody has to be asked, and
// the honest place to ask is the screen they already open.
//
// It shows only to a member who has entered NOTHING, and only while cricket is
// close enough to matter. Somebody who has already told us they're away should
// never see it again — a prompt that keeps appearing after you have answered it
// is how an app teaches people to ignore its prompts.

/** How far ahead cricket has to be before this is worth mentioning. */
const HORIZON_DAYS = 45;

export function AvailabilityNudge() {
  const { me } = useMe();
  const U = useUnavailability();
  const ground = useGroundDates();

  // Slots inside the horizon, not the whole season: "98 slots are booked" in a
  // sentence about the next few weeks is a season total wearing the wrong hat.
  const soon = useMemo(() => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + HORIZON_DAYS);
    const cutoff = horizon.toLocaleDateString('en-CA');
    return ground.upcoming.filter(b => b.date <= cutoff).length;
  }, [ground.upcoming]);

  const show = useMemo(() => {
    if (!me || U.loading || U.tableMissing) return false;
    if (U.mine(me.id).length > 0) return false;          // already answered
    return soon > 0;
  }, [me, U, soon]);

  if (!show) return null;

  return (
    <Link to="/availability"
      className="flex items-center gap-3 r-card px-3.5 py-3 border border-amber-200
                 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/10 group">
      <div className="w-9 h-9 r-control bg-amber-100 dark:bg-amber-400/20 flex items-center
                      justify-center shrink-0">
        <CalendarOff className="w-4 h-4 text-amber-700 dark:text-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black t-body text-slate-900 dark:text-white">
          Going home for the festivals?
        </p>
        <p className="t-meta text-slate-600 dark:text-white/60">
          {soon} ground slots booked in the next 6 weeks. Block the dates you’re
          away so the squad isn’t picked around you.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
