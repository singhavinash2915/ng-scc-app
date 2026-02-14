import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Users,
  IndianRupee,
  Trophy,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useMatches } from '../hooks/useMatches';
import type { Match } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Calendar() {
  const { matches, loading } = useMatches();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get today's date string for comparison
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Create a map of dates to matches for quick lookup
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach(match => {
      const dateStr = match.date;
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(match);
    });
    return map;
  }, [matches]);

  // Get matches for a specific date
  const getMatchesForDate = (dateStr: string) => {
    return matchesByDate.get(dateStr) || [];
  };

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month (0 = Sunday)
    const firstDay = new Date(year, month, 1).getDay();

    // Number of days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Days from previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: string | null;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month days to fill remaining cells (6 rows x 7 days = 42)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentDate, todayStr]);

  // Navigation functions
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  // Get result badge variant
  const getResultVariant = (result: Match['result']) => {
    switch (result) {
      case 'won': return 'success';
      case 'lost': return 'danger';
      case 'draw': return 'warning';
      case 'upcoming': return 'info';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Get selected date's matches
  const selectedDateMatches = selectedDate ? getMatchesForDate(selectedDate) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Match Calendar" subtitle="View scheduled matches" />

      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4 lg:p-6">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={goToPrevMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>

                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <Button variant="secondary" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                  </div>

                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map(day => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const matchesOnDay = day.date ? getMatchesForDate(day.date) : [];
                    const hasMatch = matchesOnDay.length > 0;
                    const isSelected = day.date === selectedDate;

                    return (
                      <button
                        key={index}
                        onClick={() => day.date && setSelectedDate(day.date)}
                        disabled={!day.isCurrentMonth}
                        className={`
                          aspect-square p-1 rounded-lg relative flex flex-col items-center justify-center
                          transition-all duration-200
                          ${day.isCurrentMonth
                            ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                            : 'opacity-30 cursor-default'
                          }
                          ${day.isToday
                            ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800'
                            : ''
                          }
                          ${isSelected && day.isCurrentMonth
                            ? 'bg-primary-100 dark:bg-primary-900/30'
                            : ''
                          }
                        `}
                      >
                        <span className={`
                          text-sm font-medium
                          ${day.isToday ? 'text-primary-600 dark:text-primary-400 font-bold' : ''}
                          ${!day.isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}
                        `}>
                          {day.dayNum}
                        </span>

                        {/* Match indicators */}
                        {hasMatch && day.isCurrentMonth && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {matchesOnDay.slice(0, 3).map((match, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  match.result === 'upcoming'
                                    ? 'bg-blue-500'
                                    : match.result === 'won'
                                    ? 'bg-green-500'
                                    : match.result === 'lost'
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-600 dark:text-gray-400">Upcoming</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Won</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Lost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-gray-600 dark:text-gray-400">Draw</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Match Details Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Select a date'}
                  </h3>
                </div>

                {!selectedDate ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Click on a date to see match details
                  </p>
                ) : selectedDateMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarDays className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No matches on this date</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDateMatches.map(match => (
                      <div
                        key={match.id}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {match.match_type === 'internal'
                                ? 'Dhurandars vs Bazigars'
                                : `vs ${match.opponent || 'TBD'}`}
                            </p>
                            {match.match_type === 'internal' && (
                              <Badge variant="info" size="sm" className="mt-1">
                                Internal Match
                              </Badge>
                            )}
                          </div>
                          <Badge variant={getResultVariant(match.result)}>
                            {match.result.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4" />
                            <span>{match.venue}</span>
                          </div>

                          {match.players && match.players.length > 0 && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Users className="w-4 h-4" />
                              <span>{match.players.length} players</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <IndianRupee className="w-4 h-4" />
                            <span>₹{match.match_fee} per player</span>
                          </div>

                          {match.our_score && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Trophy className="w-4 h-4" />
                              <span>{match.our_score} - {match.opponent_score}</span>
                            </div>
                          )}
                        </div>

                        <Link
                          to="/matches"
                          className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline inline-block"
                        >
                          View all matches →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Matches Summary */}
            <Card className="mt-6">
              <CardContent className="p-4 lg:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Upcoming Matches
                </h3>
                {matches.filter(m => m.result === 'upcoming').length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No upcoming matches scheduled
                  </p>
                ) : (
                  <div className="space-y-3">
                    {matches
                      .filter(m => m.result === 'upcoming')
                      .slice(0, 5)
                      .map(match => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer"
                          onClick={() => setSelectedDate(match.date)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {match.match_type === 'internal'
                                ? 'Internal Match'
                                : `vs ${match.opponent || 'TBD'}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(match.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
