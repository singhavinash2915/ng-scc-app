import { useMemo } from 'react';
import { Cake, PartyPopper } from 'lucide-react';
import type { Member } from '../types';

interface BirthdayBannerProps {
  members: Member[];
}

/**
 * Shows a celebratory banner ONLY on a member's birthday (matches month + day,
 * year-agnostic). Renders nothing on regular days.
 */
export function BirthdayBanner({ members }: BirthdayBannerProps) {
  const todaysBirthdays = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return members.filter(m => {
      if (!m.birthday) return false;
      const d = new Date(m.birthday);
      // Use UTC parts so timezone shift doesn't move the date by one
      return (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
    });
  }, [members]);

  if (todaysBirthdays.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg">
      {/* Layered gradient + party glow */}
      <div className="absolute inset-0"
           style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f97316 50%, #fbbf24 100%)' }} />
      <div className="absolute inset-0 opacity-30"
           style={{ background: 'radial-gradient(600px circle at 0% 0%, #ffffff80, transparent 50%), radial-gradient(400px circle at 100% 100%, #ffffff60, transparent 60%)' }} />
      {/* Subtle confetti dots */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px),
                          radial-gradient(circle at 70% 60%, white 1px, transparent 1px),
                          radial-gradient(circle at 90% 20%, white 2px, transparent 2px),
                          radial-gradient(circle at 40% 80%, white 1.5px, transparent 1.5px),
                          radial-gradient(circle at 10% 70%, white 1px, transparent 1px)`,
        backgroundSize: '200px 200px',
      }} />

      <div className="relative p-4 lg:p-5 flex items-center gap-4 flex-wrap">
        {/* Cake icon with bounce */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center shadow-lg animate-bounce-in"
               style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}>
            <Cake className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
          </div>
        </div>

        {/* Avatars + names */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <PartyPopper className="w-3.5 h-3.5 text-white/90" />
            <span className="text-white/90 text-[10px] font-bold uppercase tracking-[2px]">
              Happy Birthday
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {todaysBirthdays.slice(0, 3).map(m => (
              <div key={m.id} className="flex items-center gap-2">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name}
                       className="w-9 h-9 lg:w-10 lg:h-10 rounded-full object-cover border-2 border-white/60 shadow-md flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white/30 border-2 border-white/60 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-white">{m.name.charAt(0)}</span>
                  </div>
                )}
                <span className="text-white text-base lg:text-lg font-black tracking-tight">{m.name.split(' ')[0]}</span>
              </div>
            ))}
            {todaysBirthdays.length > 3 && (
              <span className="text-white/80 text-sm font-bold">+ {todaysBirthdays.length - 3} more</span>
            )}
          </div>
        </div>

        <div className="text-3xl lg:text-4xl flex-shrink-0">🎂🎉</div>
      </div>
    </div>
  );
}

export default BirthdayBanner;
