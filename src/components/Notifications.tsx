import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  X,
  AlertTriangle,
  Calendar,
  Cake,
  IndianRupee,
  ChevronRight,
} from 'lucide-react';
import type { Member, Match } from '../types';
import { getActiveMemberIds } from '../utils/memberActivity';

interface NotificationsProps {
  members: Member[];
  matches: Match[];
}

interface Notification {
  id: string;
  type: 'low_balance' | 'upcoming_match' | 'birthday';
  title: string;
  message: string;
  link?: string;
  priority: 'high' | 'medium' | 'low';
}

export function Notifications({ members, matches }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get active members (played in last 10 matches)
    const activeMemberIds = getActiveMemberIds(matches, 10);
    const isActive = (memberId: string) => activeMemberIds.has(memberId);

    // Low balance warnings (balance < 500) for active members only
    const lowBalanceMembers = members.filter(
      m => isActive(m.id) && m.balance < 500
    );
    lowBalanceMembers.forEach(member => {
      notifs.push({
        id: `low-balance-${member.id}`,
        type: 'low_balance',
        title: 'Low Balance',
        message: `${member.name}'s balance is ₹${member.balance.toLocaleString('en-IN')}`,
        link: '/members',
        priority: member.balance < 0 ? 'high' : 'medium',
      });
    });

    // Upcoming matches (within next 7 days)
    const upcomingMatches = matches.filter(match => {
      if (match.result !== 'upcoming') return false;
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((matchDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
    upcomingMatches.forEach(match => {
      const matchDate = new Date(match.date);
      const diffDays = Math.ceil((matchDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      notifs.push({
        id: `match-${match.id}`,
        type: 'upcoming_match',
        title: diffDays === 0 ? 'Match Today!' : diffDays === 1 ? 'Match Tomorrow' : 'Upcoming Match',
        message: `vs ${match.opponent || 'TBD'} at ${match.venue} on ${matchDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        link: '/matches',
        priority: diffDays <= 1 ? 'high' : 'medium',
      });
    });

    // Birthday notifications (today or within next 7 days) for active members only
    const activeMembersWithBirthday = members.filter(
      m => isActive(m.id) && m.birthday
    );
    activeMembersWithBirthday.forEach(member => {
      if (!member.birthday) return;

      const birthday = new Date(member.birthday);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

      // If birthday has passed this year, check next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffDays = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        notifs.push({
          id: `birthday-${member.id}`,
          type: 'birthday',
          title: diffDays === 0 ? 'Birthday Today!' : 'Upcoming Birthday',
          message: diffDays === 0
            ? `${member.name}'s birthday is today! 🎉`
            : `${member.name}'s birthday is on ${thisYearBirthday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
          link: '/members',
          priority: diffDays === 0 ? 'high' : 'low',
        });
      }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return notifs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [members, matches]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'low_balance':
        return <IndianRupee className="w-5 h-5" />;
      case 'upcoming_match':
        return <Calendar className="w-5 h-5" />;
      case 'birthday':
        return <Cake className="w-5 h-5" />;
    }
  };

  const getIconBg = (type: Notification['type'], priority: Notification['priority']) => {
    if (priority === 'high') {
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    }
    switch (type) {
      case 'low_balance':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'upcoming_match':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'birthday':
        return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
    }
  };

  const highPriorityCount = notifications.filter(n => n.priority === 'high').length;

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        {notifications.length > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-bold text-white rounded-full px-1 ${
            highPriorityCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-primary-500'
          }`}>
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                {notifications.length > 0 && (
                  <span className="text-xs text-gray-500">({notifications.length})</span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[60vh]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                    <Bell className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">All caught up!</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No notifications at the moment</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map(notif => (
                    <Link
                      key={notif.id}
                      to={notif.link || '#'}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                    >
                      <div className={`p-2 rounded-lg ${getIconBg(notif.type, notif.priority)}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {notif.title}
                          </p>
                          {notif.priority === 'high' && (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {notif.message}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Summary Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    {notifications.filter(n => n.type === 'low_balance').length > 0 && (
                      <span className="flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" />
                        {notifications.filter(n => n.type === 'low_balance').length} low balance
                      </span>
                    )}
                    {notifications.filter(n => n.type === 'upcoming_match').length > 0 && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {notifications.filter(n => n.type === 'upcoming_match').length} matches
                      </span>
                    )}
                    {notifications.filter(n => n.type === 'birthday').length > 0 && (
                      <span className="flex items-center gap-1">
                        <Cake className="w-3 h-3" />
                        {notifications.filter(n => n.type === 'birthday').length} birthdays
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
