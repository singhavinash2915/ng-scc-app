import { Link } from 'react-router-dom';
import {
  Trophy, ListOrdered, BarChart3, CalendarDays, Users, Brain, Award, ScrollText,
} from 'lucide-react';

// ─── Explore ───────────────────────────────────────────────────────────────────
// Replaces about ten blocks that used to be inlined on the Dashboard — the
// calendar, ground and opponent insights, birthdays, the photo carousel, match
// analytics and the rest. None of it was deleted; every one already had a page
// of its own, and this is one tap to any of them.
//
// A dashboard that shows everything shows nothing. This is the "everything
// else" drawer, so the blocks above it can be the things that actually matter
// today.

const LINKS = [
  { to: '/matches',      icon: CalendarDays, label: 'Matches',    hint: 'Every fixture' },
  { to: '/leaderboard',  icon: ListOrdered,  label: 'Leaderboard',hint: 'Bat · bowl · field' },
  { to: '/honours',      icon: Trophy,       label: 'Records',    hint: 'Club records' },
  { to: '/analytics',    icon: BarChart3,    label: 'Analytics',  hint: 'Form & trends' },
  { to: '/awards',       icon: Award,        label: 'Awards',     hint: 'Season honours' },
  { to: '/ai-insights',  icon: Brain,        label: 'AI Insights',hint: 'Ask anything' },
  { to: '/members',      icon: Users,        label: 'Members',    hint: 'The squad' },
  { to: '/scc-mahasangram', icon: ScrollText, label: 'MahaSangram', hint: 'Squads & stats' },
];

export function ExploreGrid() {
  return (
    <div>
      <p className="t-meta font-black uppercase tracking-[2px] text-slate-400 mb-3">
        Explore
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {LINKS.map(({ to, icon: Icon, label, hint }) => (
          <Link key={to} to={to}
            className="group r-card bg-white dark:bg-white/5 border border-slate-200
                       dark:border-white/10 p-3.5 hover:border-emerald-400 hover:-translate-y-0.5
                       hover:shadow-md transition-all">
            <Icon className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="font-black t-body text-slate-900 dark:text-white leading-tight">
              {label}
            </p>
            <p className="t-micro text-slate-400 mt-0.5 truncate">{hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
