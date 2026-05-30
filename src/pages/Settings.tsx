import { useState, useRef, useEffect } from 'react';
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
  MapPin,
  Star,
  Plus,
} from 'lucide-react';
import { useGroundSettings } from '../hooks/useGroundSettings';
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
import { useStatSync, loadNameMap, saveNameMap } from '../hooks/useStatSync';
import { useCHTeamSync } from '../hooks/useCHTeamSync';
import { supabase } from '../lib/supabase';
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
  const { progress: syncProgress, sync: syncStats, reset: resetSync } = useStatSync();
  const { state: teamSyncState, fetchTeamMatches, applyLinks, createMissingMatches, reset: resetTeamSync } = useCHTeamSync();
  const [chTeamId, setChTeamId] = useState(() => localStorage.getItem('scc-ch-team-id') ?? '');
  const [syncMode, setSyncMode] = useState<'2025-26' | '2024-25' | '2023-24'>('2025-26');
  const [nameMap, setNameMap] = useState<Record<string, string>>(() => loadNameMap());
  const [deleteTarget, setDeleteTarget] = useState<'all' | '2025-26' | '2024-25' | '2023-24'>('all');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const handleClearAllStats = async () => {
    if (!window.confirm(deleteTarget === 'all'
      ? 'Delete ALL cricket stats for ALL seasons? This cannot be undone.'
      : `Delete cricket stats for season ${deleteTarget}? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const q = supabase.from('member_cricket_stats').delete();
      const { error } = deleteTarget === 'all'
        ? await q.neq('season', '__never__')   // matches all rows
        : await q.eq('season', deleteTarget);
      if (error) throw error;
      setDeleteMsg(deleteTarget === 'all'
        ? '✓ All stats deleted. Re-sync each season from CricHeroes.'
        : `✓ Season ${deleteTarget} stats deleted.`);
    } catch (e) {
      setDeleteMsg(`Error: ${e instanceof Error ? e.message : 'delete failed'}`);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Ground & Testimonials ───────────────────────────────────────────────
  const {
    ground, testimonials, saving: groundSaving, error: groundError,
    fetchSettings, saveGround, uploadGroundImage, removeGroundImage,
    addTestimonial, updateTestimonial, deleteTestimonial,
  } = useGroundSettings();

  // Ground form
  const [groundName, setGroundName]             = useState('');
  const [groundAddress, setGroundAddress]       = useState('');
  const [groundDirections, setGroundDirections] = useState('');
  const [groundFacilities, setGroundFacilities] = useState('');
  const [groundTiming, setGroundTiming]         = useState('');
  const [groundNotes, setGroundNotes]           = useState('');
  const [groundImageUploading, setGroundImageUploading] = useState(false);
  const [groundMsg, setGroundMsg]               = useState('');
  const [groundFormError, setGroundFormError]   = useState('');
  const groundImageRef = useRef<HTMLInputElement>(null);

  // Testimonials form
  const [newTestTeam, setNewTestTeam]     = useState('');
  const [newTestText, setNewTestText]     = useState('');
  const [newTestRating, setNewTestRating] = useState(5);
  const [showAddTestForm, setShowAddTestForm] = useState(false);
  const [testMsg, setTestMsg]   = useState('');
  const [testError, setTestError] = useState('');
  const [testSaving, setTestSaving] = useState(false);

  // Fetch ground settings on mount
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Sync ground form when data loads
  useEffect(() => {
    setGroundName(ground.name);
    setGroundAddress(ground.address);
    setGroundDirections(ground.directions_url);
    setGroundFacilities(ground.facilities);
    setGroundTiming(ground.timing);
    setGroundNotes(ground.notes);
  }, [ground]);

  const handleSaveGround = async () => {
    setGroundFormError('');
    setGroundMsg('');
    const ok = await saveGround({
      name: groundName.trim(),
      address: groundAddress.trim(),
      directions_url: groundDirections.trim(),
      facilities: groundFacilities.trim(),
      timing: groundTiming.trim(),
      notes: groundNotes.trim(),
      image_url: ground.image_url,
      image_urls: ground.image_urls,
    });
    if (ok) {
      setGroundMsg('Ground details saved!');
      setTimeout(() => setGroundMsg(''), 3000);
    } else {
      setGroundFormError(groundError || 'Failed to save');
    }
  };

  const handleGroundImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setGroundFormError('Image must be under 5MB'); return; }
    setGroundImageUploading(true);
    setGroundFormError('');
    const url = await uploadGroundImage(file);
    if (url) {
      // Append new URL to existing gallery
      const updatedUrls = [...ground.image_urls.filter(u => u !== url), url];
      await saveGround({
        name: groundName.trim(), address: groundAddress.trim(),
        directions_url: groundDirections.trim(), facilities: groundFacilities.trim(),
        timing: groundTiming.trim(), notes: groundNotes.trim(),
        image_url: ground.image_url || url,   // keep first as legacy
        image_urls: updatedUrls,
      });
      setGroundMsg('Ground photo added!');
      setTimeout(() => setGroundMsg(''), 3000);
    } else {
      setGroundFormError('Image upload failed');
    }
    setGroundImageUploading(false);
    if (groundImageRef.current) groundImageRef.current.value = '';
  };

  const handleRemoveGroundImage = async (url: string) => {
    if (!confirm('Remove this ground photo?')) return;
    setGroundFormError('');
    const ok = await removeGroundImage(url);
    if (ok) { setGroundMsg('Photo removed'); setTimeout(() => setGroundMsg(''), 3000); }
    else setGroundFormError('Failed to remove photo');
  };

  const handleAddTestimonial = async () => {
    if (!newTestTeam.trim() || !newTestText.trim()) {
      setTestError('Team name and review text are required');
      return;
    }
    setTestSaving(true);
    setTestError('');
    const ok = await addTestimonial({ team: newTestTeam.trim(), text: newTestText.trim(), rating: newTestRating, active: true });
    if (ok) {
      setTestMsg('Testimonial added!');
      setNewTestTeam(''); setNewTestText(''); setNewTestRating(5);
      setShowAddTestForm(false);
      setTimeout(() => setTestMsg(''), 3000);
    } else {
      setTestError('Failed to add testimonial');
    }
    setTestSaving(false);
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm('Remove this testimonial?')) return;
    const ok = await deleteTestimonial(id);
    if (ok) { setTestMsg('Testimonial removed'); setTimeout(() => setTestMsg(''), 3000); }
    else setTestError('Failed to remove');
  };

  const handleToggleTestimonial = async (id: string, active: boolean) => {
    await updateTestimonial(id, { active: !active });
  };

  const [statsSeason, setStatsSeason] = useState('2025-26');
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

        {/* Ground Details (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Ground Details</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Displayed to visiting teams on the Book a Match page.
              </p>

              {/* Ground photo gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Ground Photos ({ground.image_urls.length}/6)</p>
                  <p className="text-xs text-gray-400">Shown as gallery on the booking page. Max 5MB each.</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {ground.image_urls.map((url, i) => (
                    <div key={url} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                      <img src={url} alt={`Ground photo ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleRemoveGroundImage(url)}
                          className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white"
                          title="Remove photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {i === 0 && (
                        <div className="absolute bottom-1 left-1 text-[9px] font-bold bg-primary-500 text-white rounded px-1">MAIN</div>
                      )}
                    </div>
                  ))}
                  {ground.image_urls.length < 6 && (
                    <div
                      onClick={() => groundImageRef.current?.click()}
                      className={`w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition ${groundImageUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {groundImageUploading ? (
                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-5 h-5 text-gray-400" />
                          <span className="text-xs text-gray-400">Add photo</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input ref={groundImageRef} type="file" accept="image/*" onChange={handleGroundImageUpload} className="hidden" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Ground Name"
                  placeholder="e.g., SCC Ground"
                  value={groundName}
                  onChange={e => setGroundName(e.target.value)}
                />
                <Input
                  label="Timing"
                  placeholder="e.g., 6:00 AM – 10:00 PM"
                  value={groundTiming}
                  onChange={e => setGroundTiming(e.target.value)}
                />
              </div>

              <Input
                label="Address"
                placeholder="e.g., Andheri Sports Complex, Mumbai"
                value={groundAddress}
                onChange={e => setGroundAddress(e.target.value)}
              />

              <Input
                label="Google Maps / Directions URL"
                placeholder="https://maps.google.com/..."
                type="url"
                value={groundDirections}
                onChange={e => setGroundDirections(e.target.value)}
              />

              <Input
                label="Facilities"
                placeholder="e.g., Parking, Changing rooms, Floodlights"
                value={groundFacilities}
                onChange={e => setGroundFacilities(e.target.value)}
              />

              <TextArea
                label="Additional Notes"
                placeholder="Any special instructions for visiting teams..."
                value={groundNotes}
                onChange={e => setGroundNotes(e.target.value)}
                rows={3}
              />

              {groundFormError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {groundFormError}
                </div>
              )}
              {groundMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {groundMsg}
                </div>
              )}

              <Button onClick={handleSaveGround} disabled={groundSaving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {groundSaving ? 'Saving...' : 'Save Ground Details'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Booking Testimonials (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Booking Testimonials ({testimonials.length})</h3>
                </div>
                {!showAddTestForm && (
                  <Button size="sm" onClick={() => setShowAddTestForm(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reviews shown on the booking page. Toggle to show/hide each one.
              </p>

              {/* Existing testimonials */}
              {testimonials.length === 0 && !showAddTestForm && (
                <p className="text-center text-sm text-gray-400 py-4">No testimonials yet. Add your first one!</p>
              )}

              <div className="space-y-3">
                {testimonials.map(t => (
                  <div key={t.id} className={`p-3 rounded-xl border transition-opacity ${t.active ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50' : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{t.team}</p>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className={`w-3 h-3 ${n <= t.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{t.text}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleTestimonial(t.id, t.active)}
                          title={t.active ? 'Hide from booking page' : 'Show on booking page'}
                          className={`p-1.5 rounded-lg transition-colors text-xs font-medium ${t.active ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                          {t.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteTestimonial(t.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add form */}
              {showAddTestForm && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Testimonial</p>

                  <Input
                    label="Team Name *"
                    placeholder="e.g., Mumbai Strikers"
                    value={newTestTeam}
                    onChange={e => { setNewTestTeam(e.target.value); setTestError(''); }}
                  />

                  <TextArea
                    label="Review Text *"
                    placeholder="What did they say about playing at SCC?"
                    value={newTestText}
                    onChange={e => { setNewTestText(e.target.value); setTestError(''); }}
                    rows={3}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating</label>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNewTestRating(n)}
                          className="p-0.5 transition-transform hover:scale-110"
                        >
                          <Star className={`w-6 h-6 ${n <= newTestRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-500">{newTestRating}/5</span>
                    </div>
                  </div>

                  {testError && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {testError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleAddTestimonial} disabled={testSaving} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      {testSaving ? 'Adding...' : 'Add Testimonial'}
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowAddTestForm(false); setNewTestTeam(''); setNewTestText(''); setNewTestRating(5); setTestError(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {testMsg && !showAddTestForm && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {testMsg}
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
                    {['2025-26', '2024-25', '2023-24'].map(s => (
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

              {/* ── Import Match IDs from CricHeroes Team ─────────────────── */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Import Match IDs from CricHeroes</p>
                </div>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  Enter your SCC CricHeroes team ID and all your matches will be fetched and auto-linked to app matches by date.
                  Find the team ID in your CricHeroes team profile URL:
                  <span className="font-mono ml-1 text-emerald-700 dark:text-emerald-300">cricheroes.in/team-profile/<strong>12345</strong>/...</span>
                </p>

                {/* Team ID input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="CricHeroes Team ID (e.g. 12345)"
                    value={chTeamId}
                    onChange={e => {
                      setChTeamId(e.target.value);
                      localStorage.setItem('scc-ch-team-id', e.target.value);
                    }}
                    className="flex-1 text-sm rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 outline-none focus:border-emerald-500"
                  />
                  <Button
                    onClick={() => { resetTeamSync(); fetchTeamMatches(chTeamId, matches); }}
                    disabled={!chTeamId.trim() || teamSyncState.fetchStatus === 'fetching'}
                    className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {teamSyncState.fetchStatus === 'fetching' ? 'Fetching…' : 'Fetch Matches'}
                  </Button>
                </div>

                {/* Fetch progress */}
                {teamSyncState.fetchStatus === 'fetching' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 animate-pulse">{teamSyncState.fetchMsg}</p>
                )}

                {/* Results summary */}
                {(teamSyncState.fetchStatus === 'done' || teamSyncState.fetchStatus === 'error') && (
                  <p className={`text-xs font-semibold ${teamSyncState.fetchStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    {teamSyncState.fetchMsg}
                  </p>
                )}

                {/* Save status */}
                {teamSyncState.saveMsg && (
                  <p className={`text-xs font-semibold ${teamSyncState.saveStatus === 'error' ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {teamSyncState.saveMsg}
                  </p>
                )}

                {/* Match list table */}
                {teamSyncState.chMatches.length > 0 && (
                  <div className="space-y-2">
                    {/* Summary chips */}
                    <div className="flex gap-2 flex-wrap text-xs">
                      {[
                        { label: 'Auto-linked',   count: teamSyncState.chMatches.filter(c => c.status === 'matched').length,     color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
                        { label: 'Already set',   count: teamSyncState.chMatches.filter(c => c.status === 'already').length,     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
                        { label: 'No app match',  count: teamSyncState.chMatches.filter(c => c.status === 'no-app-match').length, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
                      ].map(({ label, count, color }) => count > 0 && (
                        <span key={label} className={`px-2 py-0.5 rounded-full font-bold ${color}`}>{count} {label}</span>
                      ))}
                    </div>

                    {/* Scrollable match list */}
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-emerald-200 dark:border-emerald-800 divide-y divide-emerald-100 dark:divide-emerald-900">
                      {teamSyncState.chMatches.map(ch => (
                        <div key={ch.chMatchId} className={`flex items-center gap-2 px-3 py-2 text-xs ${
                          ch.status === 'already'      ? 'bg-blue-50/50 dark:bg-blue-900/10' :
                          ch.status === 'matched'      ? 'bg-emerald-50/50 dark:bg-emerald-900/10' :
                          ch.status === 'no-app-match' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                        }`}>
                          {/* Status icon */}
                          <span className="flex-shrink-0 w-4 text-center">
                            {ch.status === 'already'      ? '🔗' :
                             ch.status === 'matched'      ? '✓' :
                             ch.status === 'no-app-match' ? '?' : '·'}
                          </span>
                          {/* Date */}
                          <span className="text-gray-500 flex-shrink-0 w-20">
                            {ch.date ? new Date(ch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          </span>
                          {/* Opponent / match type */}
                          <span className="flex-1 font-medium text-gray-800 dark:text-gray-200 truncate">
                            {ch.isInternal ? '🏟 Internal' : `vs ${ch.opponent || '?'}`}
                          </span>
                          {/* Score */}
                          {ch.ourScore && (
                            <span className="text-gray-500 flex-shrink-0 tabular-nums">{ch.ourScore}</span>
                          )}
                          {/* Result */}
                          <span className={`flex-shrink-0 font-bold uppercase ${
                            ch.result === 'won'  ? 'text-emerald-600' :
                            ch.result === 'lost' ? 'text-red-500' :
                            ch.result === 'draw' ? 'text-amber-500' : 'text-gray-400'
                          }`}>{ch.result !== 'unknown' ? ch.result : ''}</span>
                          {/* CricHeroes ID */}
                          <span className="text-gray-400 font-mono flex-shrink-0">#{ch.chMatchId}</span>
                        </div>
                      ))}
                    </div>

                    {/* Save matched IDs button */}
                    {teamSyncState.chMatches.some(c => c.status === 'matched') && (
                      <Button
                        onClick={() => applyLinks(teamSyncState.chMatches)}
                        disabled={teamSyncState.saveStatus === 'saving'}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {teamSyncState.saveStatus === 'saving'
                          ? 'Saving…'
                          : `💾 Save ${teamSyncState.chMatches.filter(c => c.status === 'matched').length} Match IDs to App`}
                      </Button>
                    )}

                    {/* Create missing matches button */}
                    {teamSyncState.chMatches.some(c => c.status === 'no-app-match') && (
                      <Button
                        onClick={() => createMissingMatches(teamSyncState.chMatches)}
                        disabled={teamSyncState.saveStatus === 'saving'}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {teamSyncState.saveStatus === 'saving'
                          ? 'Creating…'
                          : `➕ Create ${teamSyncState.chMatches.filter(c => c.status === 'no-app-match').length} Missing Matches from CricHeroes`}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Auto-Sync from CricHeroes ──────────────────────────────── */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <p className="text-sm font-bold text-purple-700 dark:text-purple-300">Auto-Sync from CricHeroes</p>
                </div>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                  Fetches every match scorecard that has a CricHeroes ID, aggregates batting &amp; bowling stats per player, and saves them to the leaderboard.
                </p>

                {/* Season selector — sync one season at a time */}
                {(() => {
                  const SEASON_DATES: Record<string, { start: string; end: string }> = {
                    '2025-26': { start: '2025-10-01', end: '2026-06-30' },
                    '2024-25': { start: '2024-10-01', end: '2025-06-30' },
                    '2023-24': { start: '2023-10-01', end: '2024-06-30' },
                  };
                  return (
                    <div className="space-y-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {(['2025-26', '2024-25', '2023-24'] as const).map(key => (
                          <button
                            key={key}
                            onClick={() => { setSyncMode(key); resetSync(); setDeleteMsg(null); }}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                              syncMode === key
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {key}
                          </button>
                        ))}
                      </div>

                      {/* Coverage indicator for selected season */}
                      {(() => {
                        const { start, end } = SEASON_DATES[syncMode];
                        const seasonMatches = matches.filter(m =>
                          ['won', 'lost', 'draw'].includes(m.result) &&
                          m.date >= start && m.date <= end
                        );
                        const withId  = seasonMatches.filter(m => m.ch_match_id).length;
                        const missing = seasonMatches.length - withId;
                        if (seasonMatches.length === 0) return (
                          <p className="text-xs text-gray-500">No completed matches found in {syncMode} date range.</p>
                        );
                        return (
                          <div className="rounded-lg bg-white/60 dark:bg-gray-800/60 border border-purple-200 dark:border-purple-800 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">CricHeroes coverage — {syncMode}</span>
                              <span className="font-bold text-purple-700 dark:text-purple-300">{withId}/{seasonMatches.length} matches</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full transition-all"
                                style={{ width: `${seasonMatches.length > 0 ? (withId / seasonMatches.length) * 100 : 0}%` }}
                              />
                            </div>
                            {missing > 0 && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                ⚠️ {missing} match{missing > 1 ? 'es' : ''} missing CricHeroes ID — go to{' '}
                                <span className="font-bold">Matches → Edit</span> to add them, then re-sync.
                              </p>
                            )}
                            {missing === 0 && withId > 0 && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ All matches have CricHeroes IDs</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Progress bar */}
                {syncProgress.status === 'running' && (
                  <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: syncProgress.total > 0 ? `${(syncProgress.done / syncProgress.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400">{syncProgress.message}</p>
                  </div>
                )}

                {/* Done summary + Sync Again button (always visible when done) */}
                {syncProgress.status === 'done' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      {syncProgress.message}
                      {syncProgress.errors > 0 && <span className="text-yellow-600 dark:text-yellow-400 text-xs font-normal">({syncProgress.errors} errors)</span>}
                    </div>

                    {/* Unmatched names — collapsible, with ignore option */}
                    {(() => {
                      // Filter out names the user chose to ignore
                      const ignoredNames = JSON.parse(localStorage.getItem('scc-ch-ignored-names') || '[]') as string[];
                      const pendingUnmatched = syncProgress.unmatched.filter(n => !ignoredNames.includes(n) && !nameMap[n]);
                      const mappedCount = syncProgress.unmatched.filter(n => nameMap[n]).length;
                      const ignoredCount = syncProgress.unmatched.filter(n => ignoredNames.includes(n)).length;

                      if (syncProgress.unmatched.length === 0) return null;

                      return (
                        <details className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 overflow-hidden">
                          <summary className="px-3 py-2 cursor-pointer text-xs font-bold text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30">
                            {pendingUnmatched.length > 0
                              ? `⚠️ ${pendingUnmatched.length} unmatched name${pendingUnmatched.length > 1 ? 's' : ''} (old members?) — tap to map or ignore`
                              : `✓ All handled (${mappedCount} mapped, ${ignoredCount} ignored)`}
                          </summary>
                          <div className="px-3 pb-3 space-y-1.5 border-t border-yellow-200 dark:border-yellow-800 pt-2">
                            {syncProgress.unmatched.map(chName => {
                              const isIgnored = ignoredNames.includes(chName);
                              return (
                                <div key={chName} className={`flex items-center gap-2 ${isIgnored ? 'opacity-40' : ''}`}>
                                  <span className="text-xs text-yellow-800 dark:text-yellow-300 font-mono flex-shrink-0 truncate max-w-[120px]" title={chName}>{chName}</span>
                                  <span className="text-yellow-600/50 flex-shrink-0">→</span>
                                  {isIgnored ? (
                                    <span className="text-xs text-gray-400 italic flex-1">ignored</span>
                                  ) : (
                                    <select
                                      value={nameMap[chName] ?? ''}
                                      onChange={e => {
                                        const updated = { ...nameMap, [chName]: e.target.value };
                                        if (!e.target.value) delete updated[chName];
                                        setNameMap(updated);
                                        saveNameMap(updated);
                                      }}
                                      className="flex-1 text-xs rounded-lg border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1"
                                    >
                                      <option value="">— pick member —</option>
                                      {[...members].sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                      ))}
                                    </select>
                                  )}
                                  {nameMap[chName] && <span className="text-emerald-500 text-xs flex-shrink-0">✓</span>}
                                  {!isIgnored && !nameMap[chName] && (
                                    <button
                                      onClick={() => {
                                        const updated = [...ignoredNames, chName];
                                        localStorage.setItem('scc-ch-ignored-names', JSON.stringify(updated));
                                        // Force re-render
                                        setNameMap(prev => ({ ...prev }));
                                      }}
                                      className="text-[10px] text-gray-400 hover:text-red-400 flex-shrink-0"
                                      title="Ignore — not a current member"
                                    >
                                      skip
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })()}
                  </div>
                )}

                {/* Sync button — always visible */}
                <Button
                  onClick={() => {
                    setDeleteMsg(null);
                    const SEASON_DATES_SYNC: Record<string, { start: string; end: string }> = {
                      '2025-26': { start: '2025-10-01', end: '2026-06-30' },
                      '2024-25': { start: '2024-10-01', end: '2025-06-30' },
                      '2023-24': { start: '2023-10-01', end: '2024-06-30' },
                    };
                    syncStats(matches, members, SEASON_DATES_SYNC[syncMode], syncMode, nameMap);
                  }}
                  disabled={syncProgress.status === 'running'}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {syncProgress.status === 'running'
                    ? `Syncing… ${syncProgress.done}/${syncProgress.total}`
                    : syncProgress.status === 'done'
                    ? '↺ Sync Again'
                    : '⚡ Sync Stats from CricHeroes'}
                </Button>

                {/* Delete stats */}
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 p-3 space-y-2">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400">🗑 Clear Stats (before re-sync)</p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={deleteTarget}
                      onChange={e => setDeleteTarget(e.target.value as typeof deleteTarget)}
                      className="flex-1 text-xs rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5"
                    >
                      <option value="all">All seasons</option>
                      <option value="2025-26">Season 2025–26 only</option>
                      <option value="2024-25">Season 2024–25 only</option>
                      <option value="2023-24">Season 2023–24 only</option>
                    </select>
                    <Button
                      onClick={handleClearAllStats}
                      disabled={deleting}
                      variant="danger"
                      className="flex-shrink-0 text-xs py-1.5"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                  {deleteMsg && (
                    <p className={`text-xs font-semibold ${deleteMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      {deleteMsg}
                    </p>
                  )}
                </div>

              </div>

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
