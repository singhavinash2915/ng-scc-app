import { useState, useMemo } from 'react';
import {
  ImageDown,
  Send,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Check,
  X,
  Megaphone,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';
import { SquadGraphicModal } from '../components/SquadGraphicModal';
import { MatchDayMessageModal } from '../components/MatchDayMessageModal';
import type { Match, MatchType, InternalTeam } from '../types';

const TEAM_NAMES: Record<InternalTeam, string> = {
  dhurandars: 'Sangria Dhurandars',
  bazigars: 'Sangria Bazigars',
};

export function MatchDayTools() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { isActive } = useMemberActivity(members, matches);
  const { isAdmin } = useAuth();

  // Form state
  const [matchType, setMatchType] = useState<MatchType>('external');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('');
  const [opponent, setOpponent] = useState('');
  const [matchFee, setMatchFee] = useState(200);

  // Player selection
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerTeams, setPlayerTeams] = useState<Record<string, InternalTeam>>({});
  const [playerFilter, setPlayerFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [showGraphicModal, setShowGraphicModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const filteredMembers = useMemo(() => {
    if (playerFilter === 'active') return members.filter(m => isActive(m.id));
    if (playerFilter === 'inactive') return members.filter(m => !isActive(m.id));
    return members;
  }, [members, isActive, playerFilter]);

  const togglePlayer = (memberId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const setPlayerTeam = (memberId: string, team: InternalTeam) => {
    setPlayerTeams(prev => ({ ...prev, [memberId]: team }));
    if (!selectedPlayers.includes(memberId)) {
      setSelectedPlayers(prev => [...prev, memberId]);
    }
  };

  const removePlayerFromTeam = (memberId: string) => {
    setPlayerTeams(prev => {
      const newTeams = { ...prev };
      delete newTeams[memberId];
      return newTeams;
    });
    setSelectedPlayers(prev => prev.filter(id => id !== memberId));
  };

  const getPlayersByTeam = (team: InternalTeam) => {
    return Object.entries(playerTeams)
      .filter(([, t]) => t === team)
      .map(([memberId]) => memberId);
  };

  const buildTempMatch = (): Match => ({
    id: 'temp-' + Date.now(),
    date,
    venue,
    opponent: matchType === 'external' ? opponent || null : null,
    result: 'upcoming',
    our_score: null,
    opponent_score: null,
    match_fee: matchFee,
    ground_cost: 0,
    other_expenses: 0,
    deduct_from_balance: false,
    notes: null,
    man_of_match_id: null,
    match_type: matchType,
    winning_team: null,
    polling_enabled: false,
    polling_deadline: null,
    captain_id: null,
    vice_captain_id: null,
    created_at: new Date().toISOString(),
    players: selectedPlayers.map(memberId => ({
      id: 'temp-' + memberId,
      match_id: 'temp-' + Date.now(),
      member_id: memberId,
      fee_paid: false,
      team: matchType === 'internal' ? playerTeams[memberId] || null : null,
      member: members.find(m => m.id === memberId),
    })),
  });

  const canGenerate = selectedPlayers.length > 0 && venue.trim() !== '';

  if (!isAdmin) {
    return (
      <div>
        <Header title="Match Day Tools" subtitle="Admin access required" />
        <div className="p-6">
          <Card>
            <CardContent>
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Please login as admin to access Match Day Tools.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Match Day Tools"
        subtitle="Generate squad graphics and match day messages without creating a match"
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <Megaphone className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Fill in the match details and select players to generate squad graphics or match day messages. No match will be created and no balance will be affected.
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardContent>
            <div className="space-y-5">
              {/* Match Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Match Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMatchType('external');
                      setSelectedPlayers([]);
                      setPlayerTeams({});
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      matchType === 'external'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    External Match
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchType('internal');
                      setSelectedPlayers([]);
                      setPlayerTeams({});
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      matchType === 'internal'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Internal Match
                  </button>
                </div>
              </div>

              {/* Date & Venue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Venue
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={e => setVenue(e.target.value)}
                    placeholder="e.g. Four Star Ground"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Opponent (external only) */}
              {matchType === 'external' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    Opponent
                  </label>
                  <input
                    type="text"
                    value={opponent}
                    onChange={e => setOpponent(e.target.value)}
                    placeholder="e.g. Game Changers"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              )}

              {/* Match Fee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <IndianRupee className="w-4 h-4 inline mr-1" />
                  Match Fee (₹)
                </label>
                <input
                  type="number"
                  value={matchFee}
                  onChange={e => setMatchFee(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Player Selection */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                {matchType === 'external' ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Users className="w-4 h-4 inline mr-1" />
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
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
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
                          <span className={`text-sm ${member.balance >= matchFee ? 'text-green-500' : 'text-red-500'}`}>
                            ₹{member.balance}
                          </span>
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
                      <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
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
                            <span className={`text-xs ${member.balance >= matchFee ? 'text-green-500' : 'text-red-500'}`}>
                              ₹{member.balance}
                            </span>
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
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => setShowGraphicModal(true)}
                    disabled={!canGenerate}
                    className="flex items-center justify-center gap-2"
                  >
                    <ImageDown className="w-5 h-5" />
                    Generate Squad Graphic
                  </Button>
                  <Button
                    onClick={() => setShowMessageModal(true)}
                    disabled={!canGenerate}
                    variant="success"
                    className="flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Generate Match Day Message
                  </Button>
                </div>
                {!canGenerate && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                    Select at least one player and enter a venue to generate
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Squad Graphic Modal */}
      {showGraphicModal && (
        <SquadGraphicModal
          isOpen={showGraphicModal}
          onClose={() => setShowGraphicModal(false)}
          match={buildTempMatch()}
        />
      )}

      {/* Match Day Message Modal */}
      {showMessageModal && (
        <MatchDayMessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          match={buildTempMatch()}
          members={members}
        />
      )}
    </div>
  );
}
