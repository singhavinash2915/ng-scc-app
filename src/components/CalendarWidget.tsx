import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, ChevronRight } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import type { Match } from '../types';

interface CalendarWidgetProps {
  matches: Match[];
}

export function CalendarWidget({ matches }: CalendarWidgetProps) {
  // Get upcoming matches sorted by date
  const upcomingMatches = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return matches
      .filter(m => {
        if (m.result !== 'upcoming') return false;
        const matchDate = new Date(m.date);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate >= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [matches]);

  // Calculate days until match
  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDate = new Date(dateStr);
    matchDate.setHours(0, 0, 0, 0);
    const diffTime = matchDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get label for days until
  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  return (
    <Card>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-500" />
          Upcoming Matches
        </h3>
        <Link
          to="/calendar"
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium group"
        >
          View calendar
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <CardContent className="p-0">
        {upcomingMatches.length === 0 ? (
          <div className="p-6 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No upcoming matches</p>
            <Link
              to="/matches"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-block"
            >
              Schedule a match →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {upcomingMatches.map(match => {
              const daysUntil = getDaysUntil(match.date);
              const daysLabel = getDaysLabel(daysUntil);
              const isUrgent = daysUntil <= 1;

              return (
                <Link
                  key={match.id}
                  to="/calendar"
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                >
                  {/* Date Block */}
                  <div className={`
                    flex flex-col items-center justify-center w-14 h-14 rounded-xl
                    ${isUrgent
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    }
                  `}>
                    <span className="text-xs font-medium uppercase">
                      {new Date(match.date).toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                    <span className="text-xl font-bold">
                      {new Date(match.date).getDate()}
                    </span>
                  </div>

                  {/* Match Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {match.match_type === 'internal'
                          ? 'Dhurandars vs Bazigars'
                          : `vs ${match.opponent || 'TBD'}`}
                      </p>
                      {match.match_type === 'internal' && (
                        <Badge variant="info" size="sm">Internal</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {match.venue}
                      </span>
                    </div>
                  </div>

                  {/* Days Until */}
                  <div className="text-right">
                    <Badge
                      variant={isUrgent ? 'danger' : 'default'}
                      size="sm"
                    >
                      {daysLabel}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
