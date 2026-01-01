import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  BarChart3,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { MobileMenu } from './MobileMenu';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/matches', icon: Calendar, label: 'Matches' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/analytics', icon: BarChart3, label: 'Stats' },
];

export function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-gray-500 dark:text-gray-400"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
