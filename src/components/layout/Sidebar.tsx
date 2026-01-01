import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  BarChart3,
  UserPlus,
  Settings,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../hooks/useRequests';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/matches', icon: Calendar, label: 'Matches' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/requests', icon: UserPlus, label: 'Requests', adminOnly: false, showBadge: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { getPendingCount } = useRequests();
  const pendingCount = getPendingCount();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white">Sangria CC</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cricket Club</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
            {item.showBadge && pendingCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin Status */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isAdmin ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
          <Shield className={`w-5 h-5 ${isAdmin ? 'text-primary-500' : 'text-gray-400'}`} />
          <div>
            <p className={`text-sm font-medium ${isAdmin ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {isAdmin ? 'Admin Mode' : 'View Only'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {isAdmin ? 'Full access enabled' : 'Login for editing'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
