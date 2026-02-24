import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';
import type { Match, MatchType, InternalTeam } from '../types';

// Internal team names
const TEAM_NAMES: Record<InternalTeam, string> = {
  dhurandars: 'Sangria Dhurandars',
  bazigars: 'Sangria Bazigars',
};

export function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { matches, loading, addMatch, updateMatch, deleteMatch } = useMatches();
  const { members } = useMembers();
  const { isActive } = useMemberActivity(members, matches);
  const { uploadPhoto, deletePhoto, getPhotosByMatch } = useMatchPhotos();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'external' | 'internal'>('all');
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
    // Match type fields
    match_type: 'external' as MatchType,
    winning_team: '' as string,
  });

  // For internal matches - track which team each player is on
  const [playerTeams, setPlayerTeams] = useState<Record<string, InternalTeam>>({});

  const [resultData, setResultData] = useState({
    result: 'won' as Match['result'],
    our_score: '',
    opponent_score: '',
    man_of_match_id: '' as string,
    winning_team: '' as string,
  });

  // Check if selected date is today or in the past
  const isCurrentOrPastDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.date);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate <= today;
  }, [formData.date]);

  // Handle ?action=add query param from Calendar page
  useEffect(() => {
    if (searchParams.get('action') === 'add' && isAdmin) {
      setShowAddModal(true);
      // Clear the query param
      setSearchParams({});
    }
  }, [searchParams, isAdmin, setSearchParams]);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      // Filter by result status
      if (filter === 'upcoming' && match.result !== 'upcoming') return false;
      if (filter === 'completed' && !['won', 'lost', 'draw'].includes(match.result)) return false;

      // Filter by match type
      if (matchTypeFilter !== 'all' && match.match_type !== matchTypeFilter) return false;

      return true;
    });
  }, [matches, filter, matchTypeFilter]);

  const [playerFilter, setPlayerFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Filter members based on active/inactive toggle
  const filteredMembers = useMemo(() => {
    if (playerFilter === 'active') return members.filter(m => isActive(m.id));
    if (playerFilter === 'inactive') return members.filter(m => !isActive(m.id));
    return members;
  }, [members, isActive, playerFilter]);

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    // For internal matches, determine the opponent string
    const opponentName = formData.match_type === 'internal'
      ? `${TEAM_NAMES.dhurandars} vs ${TEAM_NAMES.bazigars}`
      : formData.opponent || null;

    // For internal matches with result, determine winning team
    const winningTeam = formData.match_type === 'internal' && formData.result === 'won' && formData.winning_team
      ? formData.winning_team as InternalTeam
      : null;

    setIsSubmitting(true);
    try {
      await addMatch(
        {
          date: formData.date,
          venue: formData.venue,
          opponent: opponentName,
          result: isCurrentOrPastDate ? formData.result : 'upcoming',
          our_score: isCurrentOrPastDate && formData.result !== 'upcoming' ? (formData.our_score || null) : null,
          opponent_score: isCurrentOrPastDate && formData.result !== 'upcoming' ? (formData.opponent_score || null) : null,
          match_fee: formData.match_fee,
          ground_cost: formData.ground_cost ? parseFloat(formData.ground_cost) : 0,
          other_expenses: formData.other_expenses ? parseFloat(formData.other_expenses) : 0,
          deduct_from_balance: formData.deduct_from_balance,
          notes: formData.notes || null,
          man_of_match_id: isCurrentOrPastDate && formData.result === 'won' && formData.man_of_match_id ? formData.man_of_match_id : null,
          match_type: formData.match_type,
          winning_team: winningTeam,
        },
        selectedPlayers,
        formData.match_type === 'internal' ? playerTeams : undefined
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
        winning_team: selectedMatch.match_type === 'internal' && resultData.result === 'won' && resultData.winning_team
          ? resultData.winning_team as InternalTeam
          : null,
      });
      setShowResultModal(false);
      setSelectedMatch(null);
      setResultData({ result: 'won', our_score: '', opponent_score: '', man_of_match_id: '', winning_team: '' });
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
      match_type: 'external',
      winning_team: '',
    });
    setSelectedPlayers([]);
    setPlayerTeams({});
  };

  // Toggle player's team for internal matches
  const setPlayerTeam = (memberId: string, team: InternalTeam) => {
    setPlayerTeams(prev => ({ ...prev, [memberId]: team }));
    // Auto-select the player when assigning team
    if (!selectedPlayers.includes(memberId)) {
      setSelectedPlayers(prev => [...prev, memberId]);
    }
  };

  // Remove player from teams
  const removePlayerFromTeam = (memberId: string) => {
    setPlayerTeams(prev => {
      const newTeams = { ...prev };
      delete newTeams[memberId];
      return newTeams;
    });
    setSelectedPlayers(prev => prev.filter(id => id !== memberId));
  };

  // Get players by team
  const getPlayersByTeam = (team: InternalTeam) => {
    return Object.entries(playerTeams)
      .filter(([_, t]) => t === team)
      .map(([memberId]) => memberId);
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
      match_type: match.match_type || 'external',
      winning_team: match.winning_team || '',
    });
    setSelectedPlayers(match.players?.map(p => p.member_id) || []);
    // Restore player teams for internal matches
    if (match.match_type === 'internal' && match.players) {
      const teams: Record<string, InternalTeam> = {};
      match.players.forEach(p => {
        if (p.team) teams[p.member_id] = p.team;
      });
      setPlayerTeams(teams);
    } else {
      setPlayerTeams({});
    }
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
      winning_team: match.winning_team || '',
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

  const getResultBadge = (result: Match['result'], matchType?: MatchType) => {
    switch (result) {
      case 'won':
        return <Badge variant="success">{matchType === 'internal' ? 'COMPLETED' : 'WON'}</Badge>;
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
        <div className="flex flex-col gap-4">
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

          {/* Match Type Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMatchTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                matchTypeFilter === 'all'
                  ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setMatchTypeFilter('external')}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-1 ${
                matchTypeFilter === 'external'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'
              }`}
            >
              <Trophy className="w-4 h-4" /> External
            </button>
            <button
              onClick={() => setMatchTypeFilter('internal')}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-1 ${
                matchTypeFilter === 'internal'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
              }`}
            >
              <Users className="w-4 h-4" /> Internal
            </button>
          </div>
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
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {match.match_type === 'internal' ? (
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          🦁 Dhurandars vs Bazigars 🐅
                        </h3>
                      ) : (
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          vs {match.opponent || 'TBD'}
                        </h3>
                      )}
                      {getResultBadge(match.result, match.match_type)}
                      {match.match_type === 'internal' ? (
                        <Badge variant="default" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          Internal
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          External
                        </Badge>
                      )}
                      {match.match_type === 'internal' && match.winning_team && (
                        <Badge
                          variant="success"
                          className={match.winning_team === 'dhurandars'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }
                        >
                          🏆 {TEAM_NAMES[match.winning_team]}
                        </Badge>
                      )}
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
                          {match.match_type === 'internal' ? (
                            <>🦁 {match.our_score} - {match.opponent_score} 🐅</>
                          ) : (
                            <>{match.our_score} - {match.opponent_score}</>
                          )}
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
          {/* Match Type Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, match_type: 'external', winning_team: '' })}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                formData.match_type === 'external'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              External Match
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, match_type: 'internal', opponent: '' });
                setSelectedPlayers([]);
                setPlayerTeams({});
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                formData.match_type === 'internal'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Internal Match
            </button>
          </div>

          {formData.match_type === 'internal' && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                🏏 {TEAM_NAMES.dhurandars} vs {TEAM_NAMES.bazigars}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Select players and assign them to teams below
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            {formData.match_type === 'external' ? (
              <Input
                label="Opponent"
                placeholder="e.g., Royal Strikers"
                value={formData.opponent}
                onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
              />
            ) : (
              <div className="flex items-end">
                <div className="text-sm text-gray-500 dark:text-gray-400 pb-2">
                  Internal match between SCC teams
                </div>
              </div>
            )}
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
              {formData.match_type === 'internal' ? (
                /* Internal Match Result - Simplified flow */
                <>
                  <Select
                    label="Result"
                    value={formData.result}
                    onChange={(e) => setFormData({ ...formData, result: e.target.value as Match['result'], winning_team: e.target.value === 'draw' ? '' : formData.winning_team })}
                    options={[
                      { value: 'upcoming', label: 'Not Yet Played / TBD' },
                      { value: 'won', label: 'Completed' },
                      { value: 'draw', label: 'Draw' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ]}
                  />
                  {formData.result === 'won' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Winning Team *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, winning_team: 'dhurandars' })}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            formData.winning_team === 'dhurandars'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="font-medium text-blue-700 dark:text-blue-300">🦁 Dhurandars</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, winning_team: 'bazigars' })}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            formData.winning_team === 'bazigars'
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="font-medium text-purple-700 dark:text-purple-300">🐅 Bazigars</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {formData.result !== 'upcoming' && formData.result !== 'cancelled' && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="🦁 Dhurandars Score"
                        placeholder="e.g., 156/4"
                        value={formData.our_score}
                        onChange={(e) => setFormData({ ...formData, our_score: e.target.value })}
                      />
                      <Input
                        label="🐅 Bazigars Score"
                        placeholder="e.g., 142/8"
                        value={formData.opponent_score}
                        onChange={(e) => setFormData({ ...formData, opponent_score: e.target.value })}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* External Match Result */
                <>
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
                </>
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
                            const member = members.find(m => m.id === playerId);
                            return {
                              value: playerId,
                              label: member?.name || 'Unknown Player',
                            };
                          })
                        : members.map(m => ({
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

          {/* Player Selection - Different UI for Internal vs External matches */}
          {formData.match_type === 'external' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Players ({selectedPlayers.length} selected)
                </label>
                <div className="flex gap-1">
                  {(['all', 'active', 'inactive'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPlayerFilter(f)}
                      className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                        playerFilter === f
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                {filteredMembers.map(member => (
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
                    <span className="flex-1 text-left flex items-center gap-2">
                      {member.name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isActive(member.id)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {isActive(member.id) ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                    {formData.deduct_from_balance && (
                      <span className={`text-sm ${member.balance >= formData.match_fee ? 'text-green-500' : 'text-red-500'}`}>
                        ₹{member.balance}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Internal Match - Team Assignment UI */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Dhurandars Team */}
                <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-blue-50/50 dark:bg-blue-900/10">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 text-sm">
                    🦁 {TEAM_NAMES.dhurandars} ({getPlayersByTeam('dhurandars').length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getPlayersByTeam('dhurandars').map(memberId => {
                      const member = members.find(m => m.id === memberId);
                      return member ? (
                        <div key={member.id} className="flex items-center justify-between bg-blue-100 dark:bg-blue-900/30 rounded px-2 py-1 text-sm">
                          <span className="text-blue-800 dark:text-blue-200">{member.name}</span>
                          <button type="button" onClick={() => removePlayerFromTeam(member.id)} className="text-blue-600 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Bazigars Team */}
                <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-3 bg-purple-50/50 dark:bg-purple-900/10">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 text-sm">
                    🐅 {TEAM_NAMES.bazigars} ({getPlayersByTeam('bazigars').length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getPlayersByTeam('bazigars').map(memberId => {
                      const member = members.find(m => m.id === memberId);
                      return member ? (
                        <div key={member.id} className="flex items-center justify-between bg-purple-100 dark:bg-purple-900/30 rounded px-2 py-1 text-sm">
                          <span className="text-purple-800 dark:text-purple-200">{member.name}</span>
                          <button type="button" onClick={() => removePlayerFromTeam(member.id)} className="text-purple-600 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              {/* Available Players */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Add Players to Teams
                  </label>
                  <div className="flex gap-1">
                    {(['all', 'active', 'inactive'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPlayerFilter(f)}
                        className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                          playerFilter === f
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                  {filteredMembers.filter(m => !playerTeams[m.id]).map(member => (
                    <div key={member.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                      <span className="flex-1 text-sm flex items-center gap-1.5">
                        {member.name}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          isActive(member.id)
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {isActive(member.id) ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                      {formData.deduct_from_balance && (
                        <span className={`text-xs ${member.balance >= formData.match_fee ? 'text-green-500' : 'text-red-500'}`}>
                          ₹{member.balance}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPlayerTeam(member.id, 'dhurandars')}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200"
                      >
                        + Dhurandars
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlayerTeam(member.id, 'bazigars')}
                        className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200"
                      >
                        + Bazigars
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Players ({selectedPlayers.length} selected)
              </label>
              <div className="flex gap-1">
                {(['all', 'active', 'inactive'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPlayerFilter(f)}
                    className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                      playerFilter === f
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {filteredMembers.map(member => (
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
                  <span className="flex-1 text-left flex items-center gap-2">
                    {member.name}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive(member.id)
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {isActive(member.id) ? 'Active' : 'Inactive'}
                    </span>
                  </span>
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
              {selectedMatch?.match_type === 'internal'
                ? `🦁 Dhurandars vs Bazigars 🐅 at ${selectedMatch?.venue}`
                : `vs ${selectedMatch?.opponent || 'TBD'} at ${selectedMatch?.venue}`}
            </p>
          </div>
          {selectedMatch?.match_type === 'internal' ? (
            /* Internal Match Result */
            <>
              <Select
                label="Result *"
                value={resultData.result}
                onChange={(e) => setResultData({ ...resultData, result: e.target.value as Match['result'], winning_team: e.target.value === 'draw' ? '' : resultData.winning_team })}
                options={[
                  { value: 'won', label: 'Completed' },
                  { value: 'draw', label: 'Draw' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
              {resultData.result === 'won' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winning Team *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setResultData({ ...resultData, winning_team: 'dhurandars' })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        resultData.winning_team === 'dhurandars'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <span className="font-medium text-blue-700 dark:text-blue-300">🦁 Dhurandars</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultData({ ...resultData, winning_team: 'bazigars' })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        resultData.winning_team === 'bazigars'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <span className="font-medium text-purple-700 dark:text-purple-300">🐅 Bazigars</span>
                    </button>
                  </div>
                </div>
              )}
              {resultData.result !== 'cancelled' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="🦁 Dhurandars Score"
                    placeholder="e.g., 156/4"
                    value={resultData.our_score}
                    onChange={(e) => setResultData({ ...resultData, our_score: e.target.value })}
                  />
                  <Input
                    label="🐅 Bazigars Score"
                    placeholder="e.g., 142/8"
                    value={resultData.opponent_score}
                    onChange={(e) => setResultData({ ...resultData, opponent_score: e.target.value })}
                  />
                </div>
              )}
            </>
          ) : (
            /* External Match Result */
            <>
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
            </>
          )}

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
                  })) || members.map(m => ({
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
