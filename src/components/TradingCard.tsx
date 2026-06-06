import type { Member, MemberCricketStats } from '../types';

interface Props {
  member: Member;
  stats: MemberCricketStats | null;
  momCount: number;
  rating: number; // 0-99 OVR
  compact?: boolean;
}

const ROLE_COLORS: Record<string, { gradient: string; accent: string; label: string }> = {
  batsman:        { gradient: 'from-blue-600 to-blue-900',    accent: 'text-blue-300',    label: 'BATSMAN' },
  bowler:         { gradient: 'from-purple-600 to-purple-900', accent: 'text-purple-300',  label: 'BOWLER' },
  all_rounder:    { gradient: 'from-amber-600 to-amber-900',  accent: 'text-amber-300',   label: 'ALL-ROUNDER' },
  wicket_keeper:  { gradient: 'from-emerald-600 to-emerald-900', accent: 'text-emerald-300', label: 'KEEPER' },
};

const RATING_TIER = (r: number) =>
  r >= 85 ? { label: 'ELITE', color: 'from-yellow-400 to-amber-500 text-black' }
  : r >= 70 ? { label: 'GOLD', color: 'from-yellow-600 to-yellow-800 text-yellow-100' }
  : r >= 55 ? { label: 'SILVER', color: 'from-gray-400 to-gray-600 text-white' }
  : { label: 'BRONZE', color: 'from-orange-700 to-orange-900 text-orange-200' };

export function TradingCard({ member, stats, momCount, rating, compact = false }: Props) {
  const role = ROLE_COLORS[member.role || 'batsman'] || ROLE_COLORS.batsman;
  const tier = RATING_TIER(rating);
  const s = stats;

  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${role.gradient} p-3 shadow-lg min-w-[140px]`}>
        <div className="flex items-center gap-2">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/20" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-black text-sm">{member.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-black truncate">{member.name.split(' ')[0]}</p>
            <p className={`text-[9px] font-bold uppercase tracking-wider ${role.accent}`}>{role.label}</p>
          </div>
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
            <span className="text-xs font-black">{rating}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${role.gradient} shadow-2xl w-full max-w-[220px]`}>
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='white'/%3E%3C/svg%3E")`,
      }} />

      {/* Rating badge */}
      <div className="absolute top-2 right-2 z-10">
        <div className={`px-2 py-1 rounded-lg bg-gradient-to-r ${tier.color} shadow-lg`}>
          <p className="text-[8px] font-black tracking-wider">{tier.label}</p>
          <p className="text-xl font-black leading-none text-center">{rating}</p>
        </div>
      </div>

      {/* Photo */}
      <div className="relative pt-3 px-4">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.name}
               className="w-full aspect-square object-cover rounded-xl border-2 border-white/20 shadow-lg" />
        ) : (
          <div className="w-full aspect-square rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center">
            <span className="text-5xl font-black text-white/40">{member.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Name & Role */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-white text-sm font-black truncate">{member.name}</p>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-[2px] ${role.accent}`}>{role.label}</span>
          {member.jersey_number && (
            <span className="text-white/40 text-[9px] font-bold">#{member.jersey_number}</span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {s && (
        <div className="grid grid-cols-3 gap-px mx-3 mb-3 mt-1 bg-white/10 rounded-lg overflow-hidden">
          <StatCell label="RUNS" value={s.batting_runs} />
          <StatCell label="WKTS" value={s.bowling_wickets} />
          <StatCell label="CTCH" value={s.fielding_catches} />
          <StatCell label="AVG" value={s.batting_average.toFixed(1)} />
          <StatCell label="SR" value={s.batting_strike_rate.toFixed(0)} />
          <StatCell label="MOM" value={momCount} highlight />
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-black/30 px-1.5 py-1.5 text-center">
      <p className={`text-[10px] font-black tabular-nums ${highlight ? 'text-amber-300' : 'text-white'}`}>{value}</p>
      <p className="text-[7px] text-white/50 font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}
