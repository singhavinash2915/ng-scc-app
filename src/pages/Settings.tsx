import { useState, useRef } from 'react';
import {
  Shield,
  LogOut,
  Moon,
  Sun,
  Download,
  AlertTriangle,
  Check,
  Lock,
  FileJson,
  FileSpreadsheet,
  Building2,
  Upload,
  Trash2,
  ExternalLink,
  Image,
  Save,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useTournaments } from '../hooks/useTournaments';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useSponsor } from '../hooks/useSponsor';

export function Settings() {
  const { isAdmin, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { activeCount } = useMemberActivity(members, matches);
  const { transactions } = useTransactions();
  const { tournaments } = useTournaments();

  const { sponsor, saveSponsor, uploadLogo, removeLogo, removeSponsor } = useSponsor();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Sponsor form state
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorTagline, setSponsorTagline] = useState('');
  const [sponsorDescription, setSponsorDescription] = useState('');
  const [sponsorWebsite, setSponsorWebsite] = useState('');
  const [sponsorMemberId, setSponsorMemberId] = useState('');
  const [sponsorSaving, setSponsorSaving] = useState(false);
  const [sponsorLogoUploading, setSponsorLogoUploading] = useState(false);
  const [sponsorMsg, setSponsorMsg] = useState('');
  const [sponsorError, setSponsorError] = useState('');
  const [sponsorFormLoaded, setSponsorFormLoaded] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load sponsor data into form when available
  if (sponsor && !sponsorFormLoaded) {
    setSponsorName(sponsor.name);
    setSponsorTagline(sponsor.tagline || '');
    setSponsorDescription(sponsor.description || '');
    setSponsorWebsite(sponsor.website_url || '');
    setSponsorMemberId(sponsor.member_id || '');
    setSponsorFormLoaded(true);
  }

  const handleSaveSponsor = async () => {
    if (!sponsorName.trim()) {
      setSponsorError('Sponsor name is required');
      return;
    }
    try {
      setSponsorSaving(true);
      setSponsorError('');
      setSponsorMsg('');
      await saveSponsor({
        name: sponsorName.trim(),
        tagline: sponsorTagline.trim() || null,
        description: sponsorDescription.trim() || null,
        website_url: sponsorWebsite.trim() || null,
        member_id: sponsorMemberId || null,
      });
      setSponsorMsg(sponsor ? 'Sponsor updated!' : 'Sponsor added!');
    } catch {
      setSponsorError('Failed to save sponsor');
    } finally {
      setSponsorSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSponsorError('Logo must be under 2MB');
      return;
    }
    try {
      setSponsorLogoUploading(true);
      setSponsorError('');
      setSponsorMsg('');
      await uploadLogo(file);
      setSponsorMsg('Logo uploaded!');
    } catch {
      setSponsorError('Failed to upload logo');
    } finally {
      setSponsorLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setSponsorError('');
      setSponsorMsg('');
      await removeLogo();
      setSponsorMsg('Logo removed');
    } catch {
      setSponsorError('Failed to remove logo');
    }
  };

  const handleRemoveSponsor = async () => {
    if (!confirm('Remove sponsor? This will delete all sponsor data.')) return;
    try {
      setSponsorError('');
      setSponsorMsg('');
      await removeSponsor();
      setSponsorName('');
      setSponsorTagline('');
      setSponsorDescription('');
      setSponsorWebsite('');
      setSponsorMemberId('');
      setSponsorFormLoaded(false);
      setSponsorMsg('Sponsor removed');
    } catch {
      setSponsorError('Failed to remove sponsor');
    }
  };

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

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        clubName: 'Sangria Cricket Club',
        members: members.map(m => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          email: m.email,
          status: m.status,
          balance: m.balance,
          matches_played: m.matches_played,
          join_date: m.join_date,
        })),
        matches: matches.map(m => ({
          id: m.id,
          date: m.date,
          venue: m.venue,
          opponent: m.opponent,
          result: m.result,
          our_score: m.our_score,
          opponent_score: m.opponent_score,
          match_fee: m.match_fee,
          ground_cost: m.ground_cost,
          other_expenses: m.other_expenses,
          deduct_from_balance: m.deduct_from_balance,
          notes: m.notes,
          players: m.players?.map(p => p.member?.name) || [],
        })),
        transactions: transactions.map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          member_name: t.member?.name || null,
        })),
        tournaments: tournaments.map(t => ({
          id: t.id,
          name: t.name,
          start_date: t.start_date,
          end_date: t.end_date,
          venue: t.venue,
          format: t.format,
          status: t.status,
          total_teams: t.total_teams,
          entry_fee: t.entry_fee,
          prize_money: t.prize_money,
          our_position: t.our_position,
          result: t.result,
          notes: t.notes,
        })),
        summary: {
          totalMembers: members.length,
          activeMembers: activeCount,
          totalMatches: matches.length,
          totalTournaments: tournaments.length,
          totalDeposits: transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
          totalExpenses: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0),
          clubFunds: members.reduce((sum, m) => sum + m.balance, 0),
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Data exported successfully as JSON!');
    } catch (error) {
      console.error('Failed to export data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Export Members CSV
      const membersCSV = [
        ['Name', 'Phone', 'Email', 'Status', 'Balance', 'Matches Played', 'Join Date'].join(','),
        ...members.map(m => [
          `"${m.name}"`,
          m.phone || '',
          m.email || '',
          m.status,
          m.balance,
          m.matches_played,
          m.join_date || '',
        ].join(','))
      ].join('\n');

      // Export Transactions CSV
      const transactionsCSV = [
        ['Date', 'Type', 'Amount', 'Description', 'Member'].join(','),
        ...transactions.map(t => [
          t.date,
          t.type,
          t.amount,
          `"${t.description || ''}"`,
          `"${t.member?.name || 'Club'}"`,
        ].join(','))
      ].join('\n');

      // Export Matches CSV
      const matchesCSV = [
        ['Date', 'Venue', 'Opponent', 'Result', 'Our Score', 'Opponent Score', 'Match Fee', 'Ground Cost', 'Other Expenses'].join(','),
        ...matches.map(m => [
          m.date,
          `"${m.venue}"`,
          `"${m.opponent || ''}"`,
          m.result,
          m.our_score || '',
          m.opponent_score || '',
          m.match_fee,
          m.ground_cost,
          m.other_expenses,
        ].join(','))
      ].join('\n');

      // Create a zip-like combined CSV with sections
      const combinedCSV = [
        '=== MEMBERS ===',
        membersCSV,
        '',
        '=== TRANSACTIONS ===',
        transactionsCSV,
        '',
        '=== MATCHES ===',
        matchesCSV,
      ].join('\n');

      const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Data exported successfully as CSV!');
    } catch (error) {
      console.error('Failed to export data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
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
              Export your club data for backup or reporting purposes. Choose your preferred format below.
            </p>

            {/* Data Summary */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Members</p>
                <p className="font-semibold text-gray-900 dark:text-white">{members.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Matches</p>
                <p className="font-semibold text-gray-900 dark:text-white">{matches.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Transactions</p>
                <p className="font-semibold text-gray-900 dark:text-white">{transactions.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tournaments</p>
                <p className="font-semibold text-gray-900 dark:text-white">{tournaments.length}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleExportJSON}
                className="flex-1"
                disabled={isExporting}
              >
                <FileJson className="w-4 h-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export JSON'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportCSV}
                className="flex-1"
                disabled={isExporting}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                <Check className="w-4 h-4" />
                {success}
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Tip:</strong> JSON format includes all data with relationships. CSV format is
                spreadsheet-compatible for easy viewing in Excel or Google Sheets.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sponsor Management (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Sponsor Management</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sponsor Logo
                </label>
                <div className="flex items-center gap-4">
                  {sponsor?.logo_url ? (
                    <img
                      src={sponsor.logo_url}
                      alt="Sponsor logo"
                      className="w-20 h-20 object-contain rounded-xl bg-gray-50 dark:bg-gray-700 p-2 border border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={!sponsor || sponsorLogoUploading}
                    >
                      {sponsorLogoUploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {sponsorLogoUploading ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                    {sponsor?.logo_url && (
                      <Button size="sm" variant="danger" onClick={handleRemoveLogo}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {!sponsor && (
                  <p className="text-xs text-gray-400 mt-2">Save sponsor details first, then upload logo</p>
                )}
              </div>

              {/* Form Fields */}
              <Input
                label="Sponsor Name *"
                placeholder="e.g., TechCorp Solutions"
                value={sponsorName}
                onChange={(e) => { setSponsorName(e.target.value); setSponsorError(''); }}
              />

              <Input
                label="Tagline"
                placeholder="e.g., Your trusted technology partner"
                value={sponsorTagline}
                onChange={(e) => setSponsorTagline(e.target.value)}
              />

              <TextArea
                label="Description"
                placeholder="A brief description about the sponsor company..."
                value={sponsorDescription}
                onChange={(e) => setSponsorDescription(e.target.value)}
                rows={3}
              />

              <Input
                label="Website URL"
                placeholder="https://example.com"
                type="url"
                value={sponsorWebsite}
                onChange={(e) => setSponsorWebsite(e.target.value)}
              />

              <Select
                label="Linked Team Member (optional)"
                value={sponsorMemberId}
                onChange={(e) => setSponsorMemberId(e.target.value)}
                options={[
                  { value: '', label: 'None' },
                  ...members.map(m => ({ value: m.id, label: m.name })),
                ]}
              />

              {/* Feedback Messages */}
              {sponsorError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {sponsorError}
                </div>
              )}

              {sponsorMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {sponsorMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button onClick={handleSaveSponsor} disabled={sponsorSaving} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {sponsorSaving ? 'Saving...' : sponsor ? 'Save Changes' : 'Add Sponsor'}
                </Button>
                {sponsor && (
                  <Button variant="danger" onClick={handleRemoveSponsor}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>

              {/* Current Sponsor Preview */}
              {sponsor && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Current Sponsor Preview</p>
                  <div className="flex items-center gap-3">
                    {sponsor.logo_url ? (
                      <img src={sponsor.logo_url} alt={sponsor.name} className="w-12 h-12 object-contain rounded-lg bg-white dark:bg-gray-700 p-1" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{sponsor.name}</p>
                      {sponsor.tagline && <p className="text-xs text-gray-500 truncate">{sponsor.tagline}</p>}
                      {sponsor.member && <p className="text-xs text-primary-500">Team member: {sponsor.member.name}</p>}
                    </div>
                    {sponsor.website_url && (
                      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-500">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
            <p className="text-sm text-gray-500 mb-4">
              A modern web application for managing members, matches, and finances of Sangria
              Cricket Club. Built with React, TypeScript, and Supabase.
            </p>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">
                Created by <span className="font-medium text-gray-700 dark:text-gray-300">Avinash Singh</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
