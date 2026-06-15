import { useState, useEffect, useMemo } from 'react';
import { Swords } from 'lucide-react';
import { useRivalry, suggestRival } from '../hooks/useRivalry';
import type { Member, MemberCricketStats } from '../types';

interface Props {
  viewedId: string;
  stats: MemberCricketStats[];
  members: Member[];
  momCounts: Record<string, number>;
  seasonLabel?: string;
}

const rivalKey = (id: string) => `scc-rival-for-${id}`;

const Avatar = ({ m, ring }: { m: Member; ring: string }) =>
  m.avatar_url ? (
    <img src={m.avatar_url} alt="" className={`w-12 h-12 rounded-2xl object-cover border-2 ${ring}`} />
  ) : (
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${ring} bg-gray-100 dark:bg-gray-800`}>
      <span className="text-base font-black text-gray-600 dark:text-gray-300">{m.name.charAt(0)}</span>
    </div>
  );

/**
 * Teammate Rivalry — head-to-head between the viewed player and a chosen rival.
 * Defaults to the closest teammate by overall strength; pick changes are remembered.
 */
export function RivalryCard({ viewedId, stats, members, momCounts, seasonLabel = '2025-26' }: Props) {
  // Eligible rivals: members who have stats this season (and aren't the viewed player)
  const eligible = useMemo(() => {
    const ids = new Set(stats.map(s => s.member_id));
    return members
      .filter(m => m.id !== viewedId && ids.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, stats, viewedId]);

  const [rivalId, setRivalId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(rivalKey(viewedId));
    if (saved && eligible.some(m => m.id === saved)) { setRivalId(saved); return; }
    setRivalId(suggestRival(viewedId, stats, members, momCounts));
  }, [viewedId, eligible, stats, members, momCounts]);

  const rivalry = useRivalry(viewedId, rivalId, stats, members, momCounts);

  const pick = (id: string) => {
    setRivalId(id);
    localStorage.setItem(rivalKey(viewedId), id);
  };

  if (eligible.length === 0) return null;
  if (!rivalry) return null;

  const { a, b, categories, aWins, bWins, leader, banter } = rivalry;
  const total = aWins + bWins || 1;
  const aPct = Math.round((aWins / total) * 100);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-rose-500" />
          <span className="text-[11px] font-black uppercase tracking-[2px] text-gray-700 dark:text-gray-300">Rivalry</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{seasonLabel}</span>
      </div>

      <div className="p-4">
        {/* Players */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Avatar m={a.member} ring={leader === 'a' ? 'border-emerald-400' : 'border-gray-200 dark:border-gray-700'} />
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-white truncate">{a.member.name.split(' ')[0]}</p>
              <p className="text-[10px] text-gray-400 font-semibold">{aWins} categories</p>
            </div>
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex-shrink-0">
            <span className="text-[10px] font-black text-rose-500">VS</span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-sm font-black text-gray-900 dark:text-white truncate">{b.member.name.split(' ')[0]}</p>
              <p className="text-[10px] text-gray-400 font-semibold">{bWins} categories</p>
            </div>
            <Avatar m={b.member} ring={leader === 'b' ? 'border-emerald-400' : 'border-gray-200 dark:border-gray-700'} />
          </div>
        </div>

        {/* Who's-ahead meter */}
        <div className="flex h-2 rounded-full overflow-hidden mb-1 bg-gray-100 dark:bg-gray-800">
          <div className="bg-emerald-500 transition-[width] duration-700" style={{ width: `${aPct}%` }} />
          <div className="bg-rose-500 transition-[width] duration-700" style={{ width: `${100 - aPct}%` }} />
        </div>

        {/* Banter */}
        <p className="text-[12px] text-gray-600 dark:text-gray-300 font-medium text-center my-3">{banter}</p>

        {/* Category rows */}
        <div className="space-y-1.5">
          {categories.map(c => (
            <div key={c.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <span className={`text-right font-black tabular-nums ${c.winner === 'a' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{c.aText}</span>
              <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 text-center min-w-[72px]">{c.label}</span>
              <span className={`text-left font-black tabular-nums ${c.winner === 'b' ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>{c.bText}</span>
            </div>
          ))}
        </div>

        {/* Rival picker */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">Change rival</span>
          <select
            value={rivalId ?? ''}
            onChange={e => pick(e.target.value)}
            className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1.5"
          >
            {eligible.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
