import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  Trophy,
  Wallet,
  BarChart3,
  UserPlus,
  Settings,
  Shield,
  LogOut,
  Lock,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const publicNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/matches', icon: Calendar, label: 'Matches' },
  { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/about', icon: Info, label: 'About' },
];

const adminNavItems = [
  { to: '/requests', icon: UserPlus, label: 'Requests', showBadge: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { isAdmin, login, logout } = useAuth();
  const { getPendingCount } = useRequests();
  const pendingCount = getPendingCount();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setShowLoginModal(false);
      setPassword('');
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {/* Logo - Clickable to Dashboard */}
        <Link to="/" className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
          <img
            src="/scc-logo.jpg"
            alt="Sangria CC"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">Sangria CC</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cricket Club</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {publicNavItems.map((item) => (
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
            </NavLink>
          ))}

          {/* Admin-only navigation items */}
          {isAdmin && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              {adminNavItems.map((item) => (
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
            </>
          )}
        </nav>

        {/* Admin Login/Logout Button */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          {isAdmin ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              <Shield className="w-5 h-5 text-primary-500" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-primary-600 dark:text-primary-400">Admin Mode</p>
                <p className="text-xs text-primary-500/70">Click to logout</p>
              </div>
              <LogOut className="w-4 h-4 text-primary-500" />
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Lock className="w-5 h-5 text-gray-500" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Login</p>
                <p className="text-xs text-gray-500">Click to login</p>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Login Modal */}
      <Modal isOpen={showLoginModal} onClose={() => { setShowLoginModal(false); setError(''); setPassword(''); }} title="Admin Login">
        <form onSubmit={handleLogin} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter the admin password to unlock editing features.
          </p>
          <Input
            type="password"
            label="Password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            error={error}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowLoginModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Login
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
