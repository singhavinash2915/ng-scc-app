import { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Plus,
  MapPin,
  Users,
  Trophy,
  IndianRupee,
  MoreVertical,
  Edit,
  Trash2,
  Check,
  Wallet,
  Banknote,
  Star,
  Camera,
  Image,
  X,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useAuth } from '../context/AuthContext';
import type { Match } from '../types';

export function Matches() {
  const { matches, loading, addMatch, updateMatch, deleteMatch } = useMatches();
  const { members } = useMembers();
  const { uploadPhoto, deletePhoto, getPhotosByMatch } = useMatchPhotos();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    venue: '',
    opponent: '',
    match_fee: 200,
    ground_cost: '',
    other_expenses: '',
    deduct_from_balance: true,
    notes: '',
    // Result fields for current/past date matches
    result: 'upcoming' as Match['result'],
    our_score: '',
    opponent_score: '',
    man_of_match_id: '' as string,
  });

  const [resultData, setResultData] = useState({
    result: 'won' as Match['result'],
    our_score: '',
    opponent_score: '',
    man_of_match_id: '' as string,
  });

  // Check if selected date is today or in the past
  const isCurrentOrPastDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.date);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate <= today;
  }, [formData.date]);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      if (filter === 'upcoming') return match.result === 'upcoming';
      if (filter === 'completed') return ['won', 'lost', 'draw'].includes(match.result);
      return true;
    });
  }, [matches, filter]);

  const activeMembers = useMemo(() => {
    return members.filter(m => m.status === 'active');
  }, [members]);

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSubmitting(true);
    try {
      await addMatch(
        {
          date: formData.date,
          venue: formData.venue,
          opponent: formData.opponent || null,
          result: isCurrentOrPastDate ? formData.result : 'upcoming',
          our_score: isCurrentOrPastDate && formData.result !== 'upcoming' ? (formData.our_score || null) : null,
          opponent_score: isCurrentOrPastDate && formData.result !== 'upcoming' ? (formData.opponent_score || null) : null,
          match_fee: formData.match_fee,
          ground_cost: formData.ground_cost ? parseFloat(formData.ground_cost) : 0,
          other_expenses: formData.other_expenses ? parseFloat(formData.other_expenses) : 0,
          deduct_from_balance: formData.deduct_from_balance,
          notes: formData.notes || null,
          man_of_match_id: isCurrentOrPastDate && formData.result === 'won' && formData.man_of_match_id ? formData.man_of_match_id : null,
        },
        selectedPlayers
      );
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add match:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedMatch) return;

    setIsSubmitting(true);
    try {
      await updateMatch(
        selectedMatch.id,
        {
          date: formData.date,
          venue: formData.venue,
          opponent: formData.opponent || null,
          match_fee: formData.match_fee,
          ground_cost: formData.ground_cost ? parseFloat(formData.ground_cost) : 0,
          other_expenses: formData.other_expenses ? parseFloat(formData.other_expenses) : 0,
          deduct_from_balance: formData.deduct_from_balance,
          notes: formData.notes || null,
        },
        selectedPlayers
      );
      setShowEditModal(false);
      setSelectedMatch(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update match:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedMatch) return;

    setIsSubmitting(true);
    try {
      await updateMatch(selectedMatch.id, {
        result: resultData.result,
        our_score: resultData.our_score || null,
        opponent_score: resultData.opponent_score || null,
        man_of_match_id: resultData.result === 'won' && resultData.man_of_match_id ? resultData.man_of_match_id : null,
      });
      setShowResultModal(false);
      setSelectedMatch(null);
      setResultData({ result: 'won', our_score: '', opponent_score: '', man_of_match_id: '' });
    } catch (error) {
      console.error('Failed to update result:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this match?')) {
      try {
        await deleteMatch(id);
      } catch (error) {
        console.error('Failed to delete match:', error);
      }
    }
    setMenuOpen(null);
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      venue: '',
      opponent: '',
      match_fee: 200,
      ground_cost: '',
      other_expenses: '',
      deduct_from_balance: true,
      notes: '',
      result: 'upcoming',
      our_score: '',
      opponent_score: '',
      man_of_match_id: '',
    });
    setSelectedPlayers([]);
  };

  const openEditModal = (match: Match) => {
    setSelectedMatch(match);
    setFormData({
      date: match.date,
      venue: match.venue,
      opponent: match.opponent || '',
      match_fee: match.match_fee,
      ground_cost: match.ground_cost ? match.ground_cost.toString() : '',
      other_expenses: match.other_expenses ? match.other_expenses.toString() : '',
      deduct_from_balance: match.deduct_from_balance ?? true,
      notes: match.notes || '',
      result: match.result,
      our_score: match.our_score || '',
      opponent_score: match.opponent_score || '',
      man_of_match_id: match.man_of_match_id || '',
    });
    setSelectedPlayers(match.players?.map(p => p.member_id) || []);
    setShowEditModal(true);
    setMenuOpen(null);
  };

  const openResultModal = (match: Match) => {
    setSelectedMatch(match);
    setResultData({
      result: match.result === 'upcoming' ? 'won' : match.result,
      our_score: match.our_score || '',
      opponent_score: match.opponent_score || '',
      man_of_match_id: match.man_of_match_id || '',
    });
    setShowResultModal(true);
    setMenuOpen(null);
  };

  const openPhotoModal = (match: Match) => {
    setSelectedMatch(match);
    setPhotoCaption('');
    setShowPhotoModal(true);
    setMenuOpen(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMatch || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setPhotoUploading(true);
    try {
      await uploadPhoto(selectedMatch.id, file, photoCaption || undefined);
      setPhotoCaption('');
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Delete this photo?')) return;

    try {
      await deletePhoto(photoId);
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  const togglePlayer = (memberId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getResultBadge = (result: Match['result']) => {
    switch (result) {
      case 'won':
        return <Badge variant="success">WON</Badge>;
      case 'lost':
        return <Badge variant="danger">LOST</Badge>;
      case 'draw':
        return <Badge variant="warning">DRAW</Badge>;
      case 'cancelled':
        return <Badge variant="default">CANCELLED</Badge>;
      default:
        return <Badge variant="info">UPCOMING</Badge>;
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
      <Header title="Matches" subtitle={`${matches.length} total matches`} />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {(['all', 'upcoming', 'completed'] as const).map(f => (
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
              Add Match
            </Button>
          )}
        </div>

        {/* Matches List */}
        <div className="space-y-4">
          {filteredMatches.map(match => (
            <Card key={match.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Date */}
                  <div className="flex items-center gap-4 lg:w-32">
                    <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                        {new Date(match.date).toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                      <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                        {new Date(match.date).getDate()}
                      </span>
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        vs {match.opponent || 'TBD'}
                      </h3>
                      {getResultBadge(match.result)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{match.venue}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{match.players?.length || 0} players</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="w-4 h-4" />
                        <span>₹{match.match_fee}/player</span>
                      </div>
                    </div>
                    {match.our_score && (
                      <div className="mt-2 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {match.our_score} - {match.opponent_score}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === match.id ? null : match.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>
                      {menuOpen === match.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                          <button
                            onClick={() => openEditModal(match)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" /> Edit Match
                          </button>
                          {match.result === 'upcoming' && (
                            <button
                              onClick={() => openResultModal(match)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Trophy className="w-4 h-4" /> Update Result
                            </button>
                          )}
                          <button
                            onClick={() => openPhotoModal(match)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Camera className="w-4 h-4" /> Photos ({getPhotosByMatch(match.id).length})
                          </button>
                          <button
                            onClick={() => handleDeleteMatch(match.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMatches.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No matches found</p>
          </div>
        )}
      </div>

      {/* Add Match Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Match" size="lg">
        <form onSubmit={handleAddMatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Opponent"
              placeholder="e.g., Royal Strikers"
              value={formData.opponent}
              onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
            />
          </div>
          <Input
            label="Venue *"
            placeholder="e.g., Central Park Ground"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Match Fee (₹) *"
              type="number"
              value={formData.match_fee}
              onChange={(e) => setFormData({ ...formData, match_fee: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Ground Cost (₹)"
              type="number"
              value={formData.ground_cost}
              onChange={(e) => setFormData({ ...formData, ground_cost: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Other Expenses (₹)"
              type="number"
              value={formData.other_expenses}
              onChange={(e) => setFormData({ ...formData, other_expenses: e.target.value })}
              placeholder="0"
            />
          </div>

          {/* Match Result - Only show for current or past dates */}
          {isCurrentOrPastDate && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl space-y-4">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Match Result (optional - can be added later)
              </p>
              <Select
                label="Result"
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value as Match['result'] })}
                options={[
                  { value: 'upcoming', label: 'Not Yet Played / TBD' },
                  { value: 'won', label: 'Won' },
                  { value: 'lost', label: 'Lost' },
                  { value: 'draw', label: 'Draw' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
              {formData.result !== 'upcoming' && formData.result !== 'cancelled' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Our Score"
                    placeholder="e.g., 156/4"
                    value={formData.our_score}
                    onChange={(e) => setFormData({ ...formData, our_score: e.target.value })}
                  />
                  <Input
                    label="Opponent Score"
                    placeholder="e.g., 142/8"
                    value={formData.opponent_score}
                    onChange={(e) => setFormData({ ...formData, opponent_score: e.target.value })}
                  />
                </div>
              )}
              {/* Man of the Match - Only show for Won matches */}
              {formData.result === 'won' && (
                <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-amber-500" />
                    <label className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Man of the Match
                    </label>
                  </div>
                  <Select
                    value={formData.man_of_match_id}
                    onChange={(e) => setFormData({ ...formData, man_of_match_id: e.target.value })}
                    options={[
                      { value: '', label: 'Select player (optional)' },
                      ...(selectedPlayers.length > 0
                        ? selectedPlayers.map(playerId => {
                            const member = activeMembers.find(m => m.id === playerId);
                            return {
                              value: playerId,
                              label: member?.name || 'Unknown Player',
                            };
                          })
                        : activeMembers.map(m => ({
                            value: m.id,
                            label: m.name,
                          }))
                      ),
                    ]}
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    The Man of the Match will be featured on the Dashboard!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, deduct_from_balance: true })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  formData.deduct_from_balance
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  formData.deduct_from_balance
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Wallet className={`w-5 h-5 ${
                    formData.deduct_from_balance
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${
                    formData.deduct_from_balance
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>From Balance</p>
                  <p className="text-xs text-gray-500">Deduct from member wallet</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, deduct_from_balance: false })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !formData.deduct_from_balance
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  !formData.deduct_from_balance
                    ? 'bg-orange-100 dark:bg-orange-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Banknote className={`w-5 h-5 ${
                    !formData.deduct_from_balance
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${
                    !formData.deduct_from_balance
                      ? 'text-orange-700 dark:text-orange-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>Cash Payment</p>
                  <p className="text-xs text-gray-500">Tournament/adhoc match</p>
                </div>
              </button>
            </div>
          </div>

          <TextArea
            label="Notes"
            placeholder="Any additional notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />

          {/* Player Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Players ({selectedPlayers.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {activeMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => togglePlayer(member.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedPlayers.includes(member.id)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedPlayers.includes(member.id)
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedPlayers.includes(member.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="flex-1 text-left">{member.name}</span>
                  {formData.deduct_from_balance && (
                    <span className={`text-sm ${member.balance >= formData.match_fee ? 'text-green-500' : 'text-red-500'}`}>
                      ₹{member.balance}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Match
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Match Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Match" size="lg">
        <form onSubmit={handleEditMatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Opponent"
              placeholder="e.g., Royal Strikers"
              value={formData.opponent}
              onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
            />
          </div>
          <Input
            label="Venue *"
            placeholder="e.g., Central Park Ground"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Match Fee (₹) *"
              type="number"
              value={formData.match_fee}
              onChange={(e) => setFormData({ ...formData, match_fee: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Ground Cost (₹)"
              type="number"
              value={formData.ground_cost}
              onChange={(e) => setFormData({ ...formData, ground_cost: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Other Expenses (₹)"
              type="number"
              value={formData.other_expenses}
              onChange={(e) => setFormData({ ...formData, other_expenses: e.target.value })}
              placeholder="0"
            />
          </div>

          {/* Payment Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, deduct_from_balance: true })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  formData.deduct_from_balance
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  formData.deduct_from_balance
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Wallet className={`w-5 h-5 ${
                    formData.deduct_from_balance
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${
                    formData.deduct_from_balance
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>From Balance</p>
                  <p className="text-xs text-gray-500">Deduct from member wallet</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, deduct_from_balance: false })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !formData.deduct_from_balance
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  !formData.deduct_from_balance
                    ? 'bg-orange-100 dark:bg-orange-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Banknote className={`w-5 h-5 ${
                    !formData.deduct_from_balance
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${
                    !formData.deduct_from_balance
                      ? 'text-orange-700 dark:text-orange-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>Cash Payment</p>
                  <p className="text-xs text-gray-500">Tournament/adhoc match</p>
                </div>
              </button>
            </div>
          </div>

          <TextArea
            label="Notes"
            placeholder="Any additional notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />

          {/* Player Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Players ({selectedPlayers.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {activeMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => togglePlayer(member.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedPlayers.includes(member.id)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedPlayers.includes(member.id)
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedPlayers.includes(member.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="flex-1 text-left">{member.name}</span>
                  {formData.deduct_from_balance && (
                    <span className={`text-sm ${member.balance >= formData.match_fee ? 'text-green-500' : 'text-red-500'}`}>
                      ₹{member.balance}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowEditModal(false); setSelectedMatch(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Result Modal */}
      <Modal isOpen={showResultModal} onClose={() => setShowResultModal(false)} title="Update Match Result">
        <form onSubmit={handleUpdateResult} className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500">Match</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              vs {selectedMatch?.opponent || 'TBD'} at {selectedMatch?.venue}
            </p>
          </div>
          <Select
            label="Result *"
            value={resultData.result}
            onChange={(e) => setResultData({ ...resultData, result: e.target.value as Match['result'] })}
            options={[
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
              { value: 'draw', label: 'Draw' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Our Score"
              placeholder="e.g., 156/4"
              value={resultData.our_score}
              onChange={(e) => setResultData({ ...resultData, our_score: e.target.value })}
            />
            <Input
              label="Opponent Score"
              placeholder="e.g., 142/8"
              value={resultData.opponent_score}
              onChange={(e) => setResultData({ ...resultData, opponent_score: e.target.value })}
            />
          </div>

          {/* Man of the Match - Only show for Won matches */}
          {resultData.result === 'won' && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-500" />
                <label className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Man of the Match
                </label>
              </div>
              <Select
                value={resultData.man_of_match_id}
                onChange={(e) => setResultData({ ...resultData, man_of_match_id: e.target.value })}
                options={[
                  { value: '', label: 'Select player (optional)' },
                  ...(selectedMatch?.players?.map(p => ({
                    value: p.member_id,
                    label: p.member?.name || 'Unknown Player',
                  })) || activeMembers.map(m => ({
                    value: m.id,
                    label: m.name,
                  }))),
                ]}
              />
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                The Man of the Match will be featured on the Dashboard until the next match!
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowResultModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Update Result
            </Button>
          </div>
        </form>
      </Modal>

      {/* Photo Gallery Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title={`Photos - ${selectedMatch?.opponent || selectedMatch?.venue || 'Match'}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Match Info */}
          {selectedMatch && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    vs {selectedMatch.opponent || 'TBD'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedMatch.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} • {selectedMatch.venue}
                  </p>
                </div>
                {selectedMatch.result !== 'upcoming' && (
                  <Badge variant={
                    selectedMatch.result === 'won' ? 'success' :
                    selectedMatch.result === 'lost' ? 'danger' :
                    selectedMatch.result === 'draw' ? 'warning' : 'default'
                  }>
                    {selectedMatch.result.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Upload Section */}
          {isAdmin && (
            <div className="space-y-3">
              <Input
                label="Caption (optional)"
                placeholder="e.g., Team photo after the match"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="match-photo-upload"
              />
              <label
                htmlFor="match-photo-upload"
                className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-800/50"
              >
                {photoUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <span className="text-sm text-gray-500">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Click to upload team photo
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      JPG, PNG up to 10MB
                    </span>
                  </>
                )}
              </label>
            </div>
          )}

          {/* Photo Gallery */}
          {selectedMatch && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Photos ({getPhotosByMatch(selectedMatch.id).length})
              </h4>
              {getPhotosByMatch(selectedMatch.id).length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No photos uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {getPhotosByMatch(selectedMatch.id).map(photo => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || 'Match photo'}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg truncate">
                          {photo.caption}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPhotoModal(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
