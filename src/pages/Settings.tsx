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
  Save,
  Brain,
  Edit2,
  X,
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
import { useCricketStats } from '../hooks/useCricketStats';
import type { MemberCricketStats } from '../types';

export function Settings() {
  const { isAdmin, loginLoading, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { activeCount } = useMemberActivity(members, matches);
  const { transactions } = useTransactions();
  const { tournaments } = useTournaments();

  const { sponsors, saveSponsor, uploadLogo, removeLogo, removeSponsor } = useSponsor();

  const [statsSeason, setStatsSeason] = useState('2026-27');
  const { stats: cricketStats, upsertStats, deleteStats } = useCricketStats(statsSeason);
  const [editingStatsId, setEditingStatsId] = useState<string | null>(null);
  const [statsForm, setStatsForm] = useState<Partial<MemberCricketStats>>({});
  const [statsMsg, setStatsMsg] = useState('');
  const [statsError, setStatsError] = useState('');
  const [statsSaving, setStatsSaving] = useState(false);

  const openStatsEdit = (memberId: string) => {
    const existing = cricketStats.find(s => s.member_id === memberId);
    setEditingStatsId(memberId);
    setStatsForm(existing ? { ...existing } : {
      batting_matches: 0, batting_innings: 0, batting_runs: 0, batting_highest_score: 0,
      batting_average: 0, batting_strike_rate: 0, batting_fifties: 0, batting_hundreds: 0,
      batting_ducks: 0, batting_fours: 0, batting_sixes: 0,
      bowling_matches: 0, bowling_innings: 0, bowling_overs: 0, bowling_wickets: 0,
      bowling_runs_conceded: 0, bowling_economy: 0, bowling_average: 0, bowling_strike_rate: 0,
      bowling_best_figures: '0/0', bowling_five_wickets: 0,
      fielding_catches: 0, fielding_stumpings: 0, fielding_run_outs: 0,
      cricheroes_profile_url: '',
    });
    setStatsMsg('');
    setStatsError('');
  };

  const handleSaveStats = async () => {
    if (!editingStatsId) return;
    try {
      setStatsSaving(true);
      setStatsError('');
      await upsertStats(editingStatsId, statsForm);
      setStatsMsg('Stats saved successfully!');
      setTimeout(() => { setEditingStatsId(null); setStatsMsg(''); }, 1500);
    } catch {
      setStatsError('Failed to save stats. Please try again.');
    } finally {
      setStatsSaving(false);
    }
  };

  const handleDeleteStats = async (memberId: string) => {
    if (!confirm('Delete cricket stats for this member?')) return;
    try {
      await deleteStats(memberId);
      setStatsMsg('Stats deleted.');
    } catch {
      setStatsError('Failed to delete stats.');
    }
  };

  const updateStatsField = (field: keyof MemberCricketStats, value: string | number) => {
    setStatsForm(prev => ({ ...prev, [field]: value }));
  };

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Sponsor form state
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorTagline, setSponsorTagline] = useState('');
  const [sponsorDescription, setSponsorDescription] = useState('');
  const [sponsorWebsite, setSponsorWebsite] = useState('');
  const [sponsorMemberId, setSponsorMemberId] = useState('');
  const [sponsorSaving, setSponsorSaving] = useState(false);
  const [sponsorLogoUploading, setSponsorLogoUploading] = useState(false);
  const [sponsorMsg, setSponsorMsg] = useState('');
  const [sponsorError, setSponsorError] = useState('');
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUploadSponsorIdRef = useRef<string | null>(null);

  const resetSponsorForm = () => {
    setEditingSponsorId(null);
    setSponsorName('');
    setSponsorTagline('');
    setSponsorDescription('');
    setSponsorWebsite('');
    setSponsorMemberId('');
    setSponsorMsg('');
    setSponsorError('');
    setShowSponsorForm(false);
  };

  const startEditSponsor = (s: typeof sponsors[0]) => {
    setEditingSponsorId(s.id);
    setSponsorName(s.name);
    setSponsorTagline(s.tagline || '');
    setSponsorDescription(s.description || '');
    setSponsorWebsite(s.website_url || '');
    setSponsorMemberId(s.member_id || '');
    setSponsorMsg('');
    setSponsorError('');
    setShowSponsorForm(true);
  };

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
        id: editingSponsorId || undefined,
        name: sponsorName.trim(),
        tagline: sponsorTagline.trim() || null,
        description: sponsorDescription.trim() || null,
        website_url: sponsorWebsite.trim() || null,
        member_id: sponsorMemberId || null,
      });
      setSponsorMsg(editingSponsorId ? 'Sponsor updated!' : 'Sponsor added!');
      setTimeout(() => resetSponsorForm(), 1500);
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
      await uploadLogo(file, logoUploadSponsorIdRef.current || undefined);
      setSponsorMsg('Logo uploaded!');
    } catch {
      setSponsorError('Failed to upload logo');
    } finally {
      setSponsorLogoUploading(false);
      logoUploadSponsorIdRef.current = null;
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async (sponsorId: string) => {
    try {
      setSponsorError('');
      setSponsorMsg('');
      await removeLogo(sponsorId);
      setSponsorMsg('Logo removed');
    } catch {
      setSponsorError('Failed to remove logo');
    }
  };

  const handleRemoveSponsor = async (sponsorId: string) => {
    if (!confirm('Remove this sponsor? This will delete all their data.')) return;
    try {
      setSponsorError('');
      setSponsorMsg('');
      await removeSponsor(sponsorId);
      if (editingSponsorId === sponsorId) resetSponsorForm();
      setSponsorMsg('Sponsor removed');
    } catch {
      setSponsorError('Failed to remove sponsor');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const success = await login(password);
    if (success) {
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

                <Button type="submit" className="w-full" disabled={loginLoading}>
                  <Shield className="w-4 h-4 mr-2" />
                  {loginLoading ? 'Verifying...' : 'Login as Admin'}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Sponsors ({sponsors.length})</h3>
                </div>
                {!showSponsorForm && (
                  <Button size="sm" onClick={() => { resetSponsorForm(); setShowSponsorForm(true); }}>
                    + Add Sponsor
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hidden file input for logo uploads */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />

              {/* Existing Sponsors List */}
              {sponsors.map(s => (
                <div key={s.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="w-14 h-14 object-contain rounded-lg bg-white dark:bg-gray-700 p-1.5 flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</p>
                      {s.tagline && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.tagline}</p>}
                      {s.member && <p className="text-xs text-primary-500">Member: {s.member.name}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {s.website_url && (
                        <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => { logoUploadSponsorIdRef.current = s.id; logoInputRef.current?.click(); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={sponsorLogoUploading ? 'Uploading...' : 'Upload logo'}
                        disabled={sponsorLogoUploading}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      {s.logo_url && (
                        <button
                          onClick={() => handleRemoveLogo(s.id)}
                          className="p-1.5 text-gray-400 hover:text-orange-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Remove logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => startEditSponsor(s)}
                        className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveSponsor(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sponsors.length === 0 && !showSponsorForm && (
                <p className="text-center text-sm text-gray-400 py-4">No sponsors added yet. Click "Add Sponsor" to get started.</p>
              )}

              {/* Feedback Messages */}
              {sponsorError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {sponsorError}
                </div>
              )}

              {sponsorMsg && !showSponsorForm && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {sponsorMsg}
                </div>
              )}

              {/* Add/Edit Sponsor Form */}
              {showSponsorForm && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {editingSponsorId ? 'Edit Sponsor' : 'New Sponsor'}
                  </p>

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

                  <div className="flex gap-3">
                    <Button onClick={handleSaveSponsor} disabled={sponsorSaving} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {sponsorSaving ? 'Saving...' : editingSponsorId ? 'Save Changes' : 'Add Sponsor'}
                    </Button>
                    <Button variant="secondary" onClick={resetSponsorForm}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cricket Stats Management (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Cricket Stats (CricHeroes)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statsSeason}
                    onChange={e => setStatsSeason(e.target.value)}
                    className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1"
                  >
                    {['2026-27', '2025-26', '2024-25'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manually enter or update CricHeroes stats for each member. These power the AI Insights features.
              </p>

              {/* Stats feedback */}
              {statsError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {statsError}
                </div>
              )}
              {statsMsg && !editingStatsId && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {statsMsg}
                </div>
              )}

              {/* Member list with stats */}
              <div className="space-y-2">
                {members.map(member => {
                  const memberStats = cricketStats.find(s => s.member_id === member.id);
                  const isEditing = editingStatsId === member.id;
                  return (
                    <div key={member.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{member.name}</p>
                          {memberStats ? (
                            <p className="text-xs text-gray-500">
                              {memberStats.batting_runs}R · {memberStats.bowling_wickets}W · Synced {new Date(memberStats.last_synced_at).toLocaleDateString()}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">No stats yet</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => isEditing ? setEditingStatsId(null) : openStatsEdit(member.id)}
                            className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={isEditing ? 'Close' : 'Edit stats'}
                          >
                            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                          </button>
                          {memberStats && !isEditing && (
                            <button
                              onClick={() => handleDeleteStats(member.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Delete stats"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stats edit form */}
                      {isEditing && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 space-y-4">
                          {/* Batting Section */}
                          <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Batting</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                { field: 'batting_matches' as keyof MemberCricketStats, label: 'Matches', type: 'number' },
                                { field: 'batting_innings' as keyof MemberCricketStats, label: 'Innings', type: 'number' },
                                { field: 'batting_runs' as keyof MemberCricketStats, label: 'Runs', type: 'number' },
                                { field: 'batting_highest_score' as keyof MemberCricketStats, label: 'High Score', type: 'number' },
                                { field: 'batting_average' as keyof MemberCricketStats, label: 'Average', type: 'number' },
                                { field: 'batting_strike_rate' as keyof MemberCricketStats, label: 'Strike Rate', type: 'number' },
                                { field: 'batting_fifties' as keyof MemberCricketStats, label: '50s', type: 'number' },
                                { field: 'batting_hundreds' as keyof MemberCricketStats, label: '100s', type: 'number' },
                                { field: 'batting_ducks' as keyof MemberCricketStats, label: 'Ducks', type: 'number' },
                                { field: 'batting_fours' as keyof MemberCricketStats, label: 'Fours', type: 'number' },
                                { field: 'batting_sixes' as keyof MemberCricketStats, label: 'Sixes', type: 'number' },
                              ].map(({ field, label, type }) => (
                                <div key={field}>
                                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{label}</label>
                                  <input
                                    type={type}
                                    value={(statsForm[field] as string | number) ?? 0}
                                    onChange={e => updateStatsField(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    min="0"
                                    step={field.includes('average') || field.includes('strike_rate') ? '0.01' : '1'}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Bowling Section */}
                          <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Bowling</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                { field: 'bowling_matches' as keyof MemberCricketStats, label: 'Matches', type: 'number' },
                                { field: 'bowling_innings' as keyof MemberCricketStats, label: 'Innings', type: 'number' },
                                { field: 'bowling_overs' as keyof MemberCricketStats, label: 'Overs', type: 'number' },
                                { field: 'bowling_wickets' as keyof MemberCricketStats, label: 'Wickets', type: 'number' },
                                { field: 'bowling_runs_conceded' as keyof MemberCricketStats, label: 'Runs', type: 'number' },
                                { field: 'bowling_economy' as keyof MemberCricketStats, label: 'Economy', type: 'number' },
                                { field: 'bowling_average' as keyof MemberCricketStats, label: 'Average', type: 'number' },
                                { field: 'bowling_strike_rate' as keyof MemberCricketStats, label: 'Strike Rate', type: 'number' },
                                { field: 'bowling_five_wickets' as keyof MemberCricketStats, label: '5-fers', type: 'number' },
                              ].map(({ field, label, type }) => (
                                <div key={field}>
                                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{label}</label>
                                  <input
                                    type={type}
                                    value={(statsForm[field] as string | number) ?? 0}
                                    onChange={e => updateStatsField(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    min="0"
                                    step={field.includes('economy') || field.includes('average') || field.includes('strike_rate') ? '0.01' : '1'}
                                  />
                                </div>
                              ))}
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Best Figures</label>
                                <input
                                  type="text"
                                  value={(statsForm.bowling_best_figures as string) ?? '0/0'}
                                  onChange={e => updateStatsField('bowling_best_figures', e.target.value)}
                                  placeholder="e.g. 4/22"
                                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Fielding Section */}
                          <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Fielding</p>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { field: 'fielding_catches' as keyof MemberCricketStats, label: 'Catches' },
                                { field: 'fielding_stumpings' as keyof MemberCricketStats, label: 'Stumpings' },
                                { field: 'fielding_run_outs' as keyof MemberCricketStats, label: 'Run Outs' },
                              ].map(({ field, label }) => (
                                <div key={field}>
                                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{label}</label>
                                  <input
                                    type="number"
                                    value={(statsForm[field] as number) ?? 0}
                                    onChange={e => updateStatsField(field, parseInt(e.target.value) || 0)}
                                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    min="0"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* CricHeroes URL */}
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">CricHeroes Profile URL (optional)</label>
                            <input
                              type="url"
                              value={(statsForm.cricheroes_profile_url as string) ?? ''}
                              onChange={e => updateStatsField('cricheroes_profile_url', e.target.value)}
                              placeholder="https://cricheroes.com/player/..."
                              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>

                          {/* Save feedback */}
                          {statsError && (
                            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              {statsError}
                            </div>
                          )}
                          {statsMsg && (
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-xs">
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                              {statsMsg}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={handleSaveStats} disabled={statsSaving} className="flex-1">
                              <Save className="w-4 h-4 mr-2" />
                              {statsSaving ? 'Saving...' : 'Save Stats'}
                            </Button>
                            <Button variant="secondary" onClick={() => { setEditingStatsId(null); setStatsMsg(''); setStatsError(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {members.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">No members found.</p>
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
