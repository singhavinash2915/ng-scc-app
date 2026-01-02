import { useState, useMemo } from 'react';
import {
  Trophy,
  Plus,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  MoreVertical,
  Edit,
  Trash2,
  Award,
  Medal,
  Target,
  Eye,
  X,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useTournaments } from '../hooks/useTournaments';
import { useMatches } from '../hooks/useMatches';
import { useAuth } from '../context/AuthContext';
import type { Tournament, TournamentMatch } from '../types';

export function Tournaments() {
  const { tournaments, loading, addTournament, updateTournament, deleteTournament, addMatchToTournament, removeMatchFromTournament, getTournamentStats } = useTournaments();
  const { matches } = useMatches();
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    venue: '',
    format: 'T20' as Tournament['format'],
    status: 'upcoming' as Tournament['status'],
    total_teams: '',
    entry_fee: 0,
    prize_money: '',
    our_position: '',
    result: '' as Tournament['result'] | '',
    notes: '',
  });

  const [matchFormData, setMatchFormData] = useState({
    match_id: '',
    stage: 'group' as TournamentMatch['stage'],
  });

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(tournament => {
      if (filter === 'all') return true;
      return tournament.status === filter;
    });
  }, [tournaments, filter]);

  // Get matches that are not already in the selected tournament
  const availableMatches = useMemo(() => {
    if (!selectedTournament) return matches;
    const tournamentMatchIds = selectedTournament.matches?.map(m => m.match_id) || [];
    return matches.filter(m => !tournamentMatchIds.includes(m.id));
  }, [matches, selectedTournament]);

  const handleAddTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSubmitting(true);
    try {
      await addTournament({
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        venue: formData.venue,
        format: formData.format,
        status: formData.status,
        total_teams: formData.total_teams ? parseInt(formData.total_teams) : null,
        entry_fee: formData.entry_fee,
        prize_money: formData.prize_money ? parseFloat(formData.prize_money) : null,
        our_position: formData.our_position || null,
        result: formData.result || null,
        notes: formData.notes || null,
      });
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add tournament:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedTournament) return;

    setIsSubmitting(true);
    try {
      await updateTournament(selectedTournament.id, {
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        venue: formData.venue,
        format: formData.format,
        status: formData.status,
        total_teams: formData.total_teams ? parseInt(formData.total_teams) : null,
        entry_fee: formData.entry_fee,
        prize_money: formData.prize_money ? parseFloat(formData.prize_money) : null,
        our_position: formData.our_position || null,
        result: (formData.result || null) as Tournament['result'],
        notes: formData.notes || null,
      });
      setShowEditModal(false);
      setSelectedTournament(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update tournament:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTournament = async (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      try {
        await deleteTournament(id);
      } catch (error) {
        console.error('Failed to delete tournament:', error);
      }
    }
    setMenuOpen(null);
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedTournament || !matchFormData.match_id) return;

    setIsSubmitting(true);
    try {
      await addMatchToTournament(selectedTournament.id, matchFormData.match_id, matchFormData.stage);
      setMatchFormData({ match_id: '', stage: 'group' });
      // Refresh the selected tournament
      const updated = tournaments.find(t => t.id === selectedTournament.id);
      if (updated) setSelectedTournament(updated);
    } catch (error) {
      console.error('Failed to add match:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMatch = async (matchId: string) => {
    if (!isAdmin || !selectedTournament) return;
    try {
      await removeMatchFromTournament(selectedTournament.id, matchId);
    } catch (error) {
      console.error('Failed to remove match:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      venue: '',
      format: 'T20',
      status: 'upcoming',
      total_teams: '',
      entry_fee: 0,
      prize_money: '',
      our_position: '',
      result: '',
      notes: '',
    });
  };

  const openEditModal = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setFormData({
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date || '',
      venue: tournament.venue,
      format: tournament.format,
      status: tournament.status,
      total_teams: tournament.total_teams?.toString() || '',
      entry_fee: tournament.entry_fee,
      prize_money: tournament.prize_money?.toString() || '',
      our_position: tournament.our_position || '',
      result: tournament.result || '',
      notes: tournament.notes || '',
    });
    setShowEditModal(true);
    setMenuOpen(null);
  };

  const openDetailModal = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setShowDetailModal(true);
    setMenuOpen(null);
  };

  const getStatusBadge = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="info">Upcoming</Badge>;
      case 'ongoing':
        return <Badge variant="warning">Ongoing</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getResultBadge = (result: Tournament['result']) => {
    if (!result) return null;
    switch (result) {
      case 'winner':
        return <Badge variant="success">Winner</Badge>;
      case 'runner_up':
        return <Badge variant="info">Runner Up</Badge>;
      case 'semi_finalist':
        return <Badge variant="warning">Semi Finalist</Badge>;
      case 'quarter_finalist':
        return <Badge variant="default">Quarter Finalist</Badge>;
      default:
        return <Badge variant="default">{result.replace('_', ' ')}</Badge>;
    }
  };

  const getResultIcon = (result: Tournament['result']) => {
    switch (result) {
      case 'winner':
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 'runner_up':
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 'semi_finalist':
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <Target className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStageBadge = (stage: TournamentMatch['stage']) => {
    switch (stage) {
      case 'final':
        return <Badge variant="success">Final</Badge>;
      case 'semi_final':
        return <Badge variant="warning">Semi Final</Badge>;
      case 'quarter_final':
        return <Badge variant="info">Quarter Final</Badge>;
      case 'group':
        return <Badge variant="default">Group Stage</Badge>;
      case 'league':
        return <Badge variant="default">League</Badge>;
      default:
        return <Badge>{stage}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Tournaments" subtitle={`${tournaments.length} total tournaments`} />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tournaments Won</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {tournaments.filter(t => t.result === 'winner').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <Medal className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Runner Up</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {tournaments.filter(t => t.result === 'runner_up').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Played</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {tournaments.filter(t => t.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {tournaments.filter(t => t.status === 'upcoming').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'upcoming', 'ongoing', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {isAdmin && (
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tournament
            </Button>
          )}
        </div>

        {/* Tournaments List */}
        <div className="space-y-4">
          {filteredTournaments.map(tournament => {
            const stats = getTournamentStats(tournament);
            return (
              <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Trophy/Result Icon */}
                    <div className="flex items-center gap-4 lg:w-16">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl flex items-center justify-center">
                        {tournament.result ? getResultIcon(tournament.result) : (
                          <Trophy className="w-6 h-6 text-primary-500" />
                        )}
                      </div>
                    </div>

                    {/* Tournament Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                          {tournament.name}
                        </h3>
                        {getStatusBadge(tournament.status)}
                        {getResultBadge(tournament.result)}
                        <Badge variant="default">{tournament.format}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(tournament.start_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{tournament.venue}</span>
                        </div>
                        {tournament.total_teams && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{tournament.total_teams} teams</span>
                          </div>
                        )}
                        {tournament.entry_fee > 0 && (
                          <div className="flex items-center gap-1">
                            <IndianRupee className="w-4 h-4" />
                            <span>Entry: ₹{tournament.entry_fee.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                      {stats.totalMatches > 0 && (
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className="text-gray-500">Matches: {stats.totalMatches}</span>
                          <span className="text-green-500">W: {stats.wins}</span>
                          <span className="text-red-500">L: {stats.losses}</span>
                          {stats.draws > 0 && <span className="text-gray-500">D: {stats.draws}</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDetailModal(tournament)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {isAdmin && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === tournament.id ? null : tournament.id)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-500" />
                          </button>
                          {menuOpen === tournament.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                              <button
                                onClick={() => openEditModal(tournament)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" /> Edit Tournament
                              </button>
                              <button
                                onClick={() => handleDeleteTournament(tournament.id)}
                                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tournaments found</p>
          </div>
        )}
      </div>

      {/* Add Tournament Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Tournament" size="lg">
        <form onSubmit={handleAddTournament} className="space-y-4">
          <Input
            label="Tournament Name *"
            placeholder="e.g., Bangalore Premier League 2024"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date *"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
          <Input
            label="Venue *"
            placeholder="e.g., Chinnaswamy Stadium"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Format *"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value as Tournament['format'] })}
              options={[
                { value: 'T20', label: 'T20' },
                { value: 'ODI', label: 'ODI' },
                { value: 'T10', label: 'T10' },
                { value: 'Tennis Ball', label: 'Tennis Ball' },
                { value: 'Other', label: 'Other' },
              ]}
            />
            <Select
              label="Status *"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Tournament['status'] })}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'ongoing', label: 'Ongoing' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Total Teams"
              type="number"
              placeholder="e.g., 8"
              value={formData.total_teams}
              onChange={(e) => setFormData({ ...formData, total_teams: e.target.value })}
            />
            <Input
              label="Entry Fee (₹)"
              type="number"
              value={formData.entry_fee}
              onChange={(e) => setFormData({ ...formData, entry_fee: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Prize Money (₹)"
              type="number"
              placeholder="e.g., 50000"
              value={formData.prize_money}
              onChange={(e) => setFormData({ ...formData, prize_money: e.target.value })}
            />
          </div>
          {formData.status === 'completed' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Our Position"
                placeholder="e.g., 1st, 2nd"
                value={formData.our_position}
                onChange={(e) => setFormData({ ...formData, our_position: e.target.value })}
              />
              <Select
                label="Result"
                value={formData.result || ''}
                onChange={(e) => setFormData({ ...formData, result: e.target.value as Tournament['result'] })}
                options={[
                  { value: '', label: 'Select result' },
                  { value: 'winner', label: 'Winner' },
                  { value: 'runner_up', label: 'Runner Up' },
                  { value: 'semi_finalist', label: 'Semi Finalist' },
                  { value: 'quarter_finalist', label: 'Quarter Finalist' },
                  { value: 'group_stage', label: 'Group Stage' },
                  { value: 'participated', label: 'Participated' },
                ]}
              />
            </div>
          )}
          <TextArea
            label="Notes"
            placeholder="Any additional notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Tournament
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Tournament Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Tournament" size="lg">
        <form onSubmit={handleEditTournament} className="space-y-4">
          <Input
            label="Tournament Name *"
            placeholder="e.g., Bangalore Premier League 2024"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date *"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
          <Input
            label="Venue *"
            placeholder="e.g., Chinnaswamy Stadium"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Format *"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value as Tournament['format'] })}
              options={[
                { value: 'T20', label: 'T20' },
                { value: 'ODI', label: 'ODI' },
                { value: 'T10', label: 'T10' },
                { value: 'Tennis Ball', label: 'Tennis Ball' },
                { value: 'Other', label: 'Other' },
              ]}
            />
            <Select
              label="Status *"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Tournament['status'] })}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'ongoing', label: 'Ongoing' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Total Teams"
              type="number"
              placeholder="e.g., 8"
              value={formData.total_teams}
              onChange={(e) => setFormData({ ...formData, total_teams: e.target.value })}
            />
            <Input
              label="Entry Fee (₹)"
              type="number"
              value={formData.entry_fee}
              onChange={(e) => setFormData({ ...formData, entry_fee: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Prize Money (₹)"
              type="number"
              placeholder="e.g., 50000"
              value={formData.prize_money}
              onChange={(e) => setFormData({ ...formData, prize_money: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Our Position"
              placeholder="e.g., 1st, 2nd"
              value={formData.our_position}
              onChange={(e) => setFormData({ ...formData, our_position: e.target.value })}
            />
            <Select
              label="Result"
              value={formData.result || ''}
              onChange={(e) => setFormData({ ...formData, result: e.target.value as Tournament['result'] })}
              options={[
                { value: '', label: 'Select result' },
                { value: 'winner', label: 'Winner' },
                { value: 'runner_up', label: 'Runner Up' },
                { value: 'semi_finalist', label: 'Semi Finalist' },
                { value: 'quarter_finalist', label: 'Quarter Finalist' },
                { value: 'group_stage', label: 'Group Stage' },
                { value: 'participated', label: 'Participated' },
              ]}
            />
          </div>
          <TextArea
            label="Notes"
            placeholder="Any additional notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowEditModal(false); setSelectedTournament(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tournament Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedTournament(null); }}
        title={selectedTournament?.name || 'Tournament Details'}
        size="lg"
      >
        {selectedTournament && (
          <div className="space-y-6">
            {/* Tournament Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Venue</p>
                <p className="font-medium">{selectedTournament.venue}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Format</p>
                <p className="font-medium">{selectedTournament.format}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Dates</p>
                <p className="font-medium">
                  {new Date(selectedTournament.start_date).toLocaleDateString('en-IN')}
                  {selectedTournament.end_date && ` - ${new Date(selectedTournament.end_date).toLocaleDateString('en-IN')}`}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <div className="mt-1">{getStatusBadge(selectedTournament.status)}</div>
              </div>
              {selectedTournament.result && (
                <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Result</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getResultIcon(selectedTournament.result)}
                    <span className="font-bold text-lg capitalize">{selectedTournament.result.replace('_', ' ')}</span>
                    {selectedTournament.our_position && (
                      <span className="text-gray-500">({selectedTournament.our_position})</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Matches Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Tournament Matches</h3>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowAddMatchModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Link Match
                  </Button>
                )}
              </div>

              {selectedTournament.matches && selectedTournament.matches.length > 0 ? (
                <div className="space-y-2">
                  {selectedTournament.matches.map(tm => (
                    <div
                      key={tm.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">vs {tm.match?.opponent || 'TBD'}</span>
                          {getStageBadge(tm.stage)}
                          {tm.match?.result && (
                            <Badge variant={tm.match.result === 'won' ? 'success' : tm.match.result === 'lost' ? 'danger' : 'default'}>
                              {tm.match.result.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {tm.match?.venue} • {tm.match && new Date(tm.match.date).toLocaleDateString('en-IN')}
                        </p>
                        {tm.match?.our_score && (
                          <p className="text-sm font-medium mt-1">
                            Score: {tm.match.our_score} - {tm.match.opponent_score}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveMatch(tm.match_id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No matches linked yet</p>
                </div>
              )}
            </div>

            {selectedTournament.notes && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                <p className="text-gray-700 dark:text-gray-300">{selectedTournament.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Match to Tournament Modal */}
      <Modal
        isOpen={showAddMatchModal}
        onClose={() => setShowAddMatchModal(false)}
        title="Link Match to Tournament"
      >
        <form onSubmit={handleAddMatch} className="space-y-4">
          <Select
            label="Select Match *"
            value={matchFormData.match_id}
            onChange={(e) => setMatchFormData({ ...matchFormData, match_id: e.target.value })}
            options={[
              { value: '', label: 'Select a match' },
              ...availableMatches.map(m => ({
                value: m.id,
                label: `vs ${m.opponent || 'TBD'} - ${new Date(m.date).toLocaleDateString('en-IN')} (${m.venue})`,
              })),
            ]}
            required
          />
          <Select
            label="Stage *"
            value={matchFormData.stage}
            onChange={(e) => setMatchFormData({ ...matchFormData, stage: e.target.value as TournamentMatch['stage'] })}
            options={[
              { value: 'group', label: 'Group Stage' },
              { value: 'league', label: 'League' },
              { value: 'quarter_final', label: 'Quarter Final' },
              { value: 'semi_final', label: 'Semi Final' },
              { value: 'final', label: 'Final' },
            ]}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddMatchModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Link Match
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
