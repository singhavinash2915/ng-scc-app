import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, Flame, Award } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Rankings } from './Rankings';
import { PressureIndex } from './PressureIndex';
import { Records } from './Records';

type Tab = 'rankings' | 'pressure' | 'records';

const TABS: { id: Tab; label: string; short: string; icon: typeof Trophy }[] = [
  { id: 'rankings', label: 'SCC Rankings', short: 'Rankings', icon: Trophy },
  { id: 'pressure', label: 'Pressure Index', short: 'Pressure', icon: Flame },
  { id: 'records',  label: 'Hall of Fame',  short: 'Records',  icon: Award },
];

/**
 * Honours — one home for the three "who's the best" pages that used to sit
 * separately in the nav (SCC Rankings, Pressure Index, Hall of Fame).
 * Deep-linkable via ?tab=pressure so old links keep working.
 */
export function Honours() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('tab') as Tab | null);
  const [tab, setTab] = useState<Tab>(
    initial && TABS.some(t => t.id === initial) ? initial : 'rankings',
  );

  const select = (id: Tab) => {
    setTab(id);
    setSearchParams(id === 'rankings' ? {} : { tab: id }, { replace: true });
  };

  return (
    <div>
      <Header title="Honours" subtitle="Rankings · Pressure Index · Hall of Fame" />

      {/* Tab switcher */}
      <div className="px-4 lg:px-8 pt-4">
        <div className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                tab === t.id
                  ? 'bg-primary-500 text-white shadow'
                  : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Each page renders headerless inside the shared shell */}
      {tab === 'rankings' && <Rankings embedded />}
      {tab === 'pressure' && <PressureIndex embedded />}
      {tab === 'records'  && <Records embedded />}
    </div>
  );
}
