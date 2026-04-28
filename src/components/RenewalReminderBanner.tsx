import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import type { Member } from '../types';

interface Props {
  members: Member[];
}

/**
 * Shows a banner if any member has membership_expires_at within the next 14 days
 * (or already expired). Only renders when there's something to remind about.
 */
export function RenewalReminderBanner({ members }: Props) {
  const data = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 14);

    const expired: Member[] = [];
    const expiring: Member[] = [];
    for (const m of members) {
      if (!m.membership_expires_at) continue;
      const exp = new Date(m.membership_expires_at);
      exp.setHours(0, 0, 0, 0);
      if (exp < now) expired.push(m);
      else if (exp <= cutoff) expiring.push(m);
    }
    return { expired, expiring, total: expired.length + expiring.length };
  }, [members]);

  if (data.total === 0) return null;

  const isCritical = data.expired.length > 0;
  return (
    <Link
      to="/members"
      className={`relative overflow-hidden rounded-2xl shadow-md border block group transition-transform hover:scale-[1.005] ${
        isCritical
          ? 'border-red-500/30 bg-gradient-to-r from-red-500/15 via-orange-500/10 to-transparent'
          : 'border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent'
      }`}
    >
      <div className="relative p-4 lg:p-5 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isCritical ? 'bg-red-500/20' : 'bg-amber-500/20'
        }`}>
          <AlertCircle className={`w-6 h-6 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-[1.5px] ${
            isCritical ? 'text-red-400' : 'text-amber-400'
          }`}>
            Membership Renewal
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
            {data.expired.length > 0 && (
              <>
                <span className="text-red-500">{data.expired.length} expired</span>
                {data.expiring.length > 0 && <span className="text-gray-400 mx-1">·</span>}
              </>
            )}
            {data.expiring.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {data.expiring.length} expiring this fortnight
              </span>
            )}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {[...data.expired, ...data.expiring].slice(0, 3).map(m => m.name.split(' ')[0]).join(', ')}
            {data.total > 3 && ` + ${data.total - 3} more`}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

export default RenewalReminderBanner;
