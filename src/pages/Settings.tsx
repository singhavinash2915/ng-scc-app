import { useState } from 'react';
import {
  Shield,
  LogOut,
  Moon,
  Sun,
  Download,
  AlertTriangle,
  Check,
  Lock,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Settings() {
  const { isAdmin, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (login(password)) {
      setSuccess('Successfully logged in as admin!');
      setPassword('');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    setSuccess('Logged out successfully.');
  };

  const handleExportData = async () => {
    try {
      // This would export all data from Supabase
      // For now, show a message
      alert('Data export feature coming soon! Data is stored securely in Supabase.');
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  return (
    <div>
      <Header title="Settings" subtitle="Manage app preferences and admin access" />

      <div className="p-4 lg:p-8 space-y-6 max-w-2xl">
        {/* Admin Authentication */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Admin Access</h3>
            </div>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Check className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Admin Mode Active
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-500">
                      You have full access to add and edit data
                    </p>
                  </div>
                </div>
                <Button variant="danger" onClick={handleLogout} className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Lock className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      Read-Only Mode
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500">
                      Login as admin to add and edit data
                    </p>
                  </div>
                </div>

                <Input
                  type="password"
                  label="Admin Password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                />

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 text-green-500 text-sm">
                    <Check className="w-4 h-4" />
                    {success}
                  </div>
                )}

                <Button type="submit" className="w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  Login as Admin
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-primary-500" />
              ) : (
                <Sun className="w-5 h-5 text-primary-500" />
              )}
              <h3 className="font-semibold text-gray-900 dark:text-white">Appearance</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-gray-500">
                  {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                    theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Data Management</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Your data is securely stored in the cloud using Supabase. All changes are synced
              automatically across devices.
            </p>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleExportData} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Tip:</strong> Data is automatically backed up to Supabase. 2-3 admins can
                add and edit data simultaneously, and changes sync in real-time.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">About</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                  Sangria Cricket Club
                </h4>
                <p className="text-gray-500">Club Management App v1.0</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              A modern web application for managing members, matches, and finances of Sangria
              Cricket Club. Built with React, TypeScript, and Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
