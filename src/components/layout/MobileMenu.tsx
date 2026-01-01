import { NavLink } from 'react-router-dom';
import { X, UserPlus, Settings, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { ThemeToggle } from '../ui/ThemeToggle';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { isAdmin } = useAuth();
  const { getPendingCount } = useRequests();
  const pendingCount = getPendingCount();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-xl animate-slideIn">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Menu</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <NavLink
            to="/requests"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`
            }
          >
            <UserPlus className="w-5 h-5" />
            <span className="font-medium">Requests</span>
            {pendingCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`
            }
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </NavLink>
        </div>

        {/* Admin Status */}
        <div className="absolute bottom-20 left-0 right-0 px-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isAdmin ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <Shield className={`w-5 h-5 ${isAdmin ? 'text-primary-500' : 'text-gray-400'}`} />
            <div>
              <p className={`text-sm font-medium ${isAdmin ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {isAdmin ? 'Admin Mode' : 'View Only'}
              </p>
              <p className="text-xs text-gray-500">
                {isAdmin ? 'Full access enabled' : 'Go to Settings to login'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
