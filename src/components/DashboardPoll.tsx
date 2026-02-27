import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Users,
  Send,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Swords,
  Vote,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMatchPolls } from '../hooks/useMatchPolls';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import type { Match, Member, PollResponse } from '../types';

interface DashboardPollProps {
  matches: Match[];
  members: Member[];
  onMatchUpdate?: () => void;
}

const RESPONSE_CONFIG = {
  available: { icon: CheckCircle2, label: 'Available', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-500', ringColor: 'ring-green-500/30' },
  maybe: { icon: HelpCircle, label: 'Maybe', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-500', ringColor: 'ring-amber-500/30' },
  unavailable: { icon: XCircle, label: "Can't Play", color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500', ringColor: 'ring-red-500/30' },
};

export function DashboardPoll({ matches, members, onMatchUpdate }: DashboardPollProps) {
  const { isAdmin } = useAuth();
  const { polls, fetchPollsByMatch, submitResponse, getPollSummary } = useMatchPolls();

  // State for starting a poll (admin)
  const [startingPollFor, setStartingPollFor] = useState<string | null>(null);
  const [pollDeadline, setPollDeadline] = useState('');

  // State for voting
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<PollResponse | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showResponses, setShowResponses] = useState(false);
  const [showStartPoll, setShowStartPoll] = useState(false);

  // Find active poll match (upcoming match with polling enabled)
  const activePollMatch = useMemo(() => {
    return matches.find(m => m.result === 'upcoming' && m.polling_enabled);
  }, [matches]);

  // Upcoming matches without polling (for admin to start poll)
  const upcomingWithoutPoll = useMemo(() => {
    return matches.filter(m => m.result === 'upcoming' && !m.polling_enabled);
  }, [matches]);

  // Fetch polls when active match changes
  useEffect(() => {
    if (activePollMatch) {
      fetchPollsByMatch(activePollMatch.id);
    }
  }, [activePollMatch, fetchPollsByMatch]);

  // Check if poll is closed (deadline passed)
  const isPollClosed = useMemo(() => {
    if (!activePollMatch) return false;
    if (activePollMatch.polling_deadline) {
      return new Date(activePollMatch.polling_deadline) < new Date();
    }
    return false;
  }, [activePollMatch]);

  // Countdown
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!activePollMatch?.polling_deadline) return;

    const updateCountdown = () => {
      const deadline = new Date(activePollMatch.polling_deadline!);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Poll Closed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m left`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m left`);
      } else {
        setCountdown(`${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [activePollMatch?.polling_deadline]);

  // When member is selected, check if they already responded
  useEffect(() => {
    if (selectedMember && polls.length > 0) {
      const existing = polls.find(p => p.member_id === selectedMember);
      if (existing) {
        setSelectedResponse(existing.response);
        setNote(existing.note || '');
      } else {
        setSelectedResponse(null);
        setNote('');
      }
    }
  }, [selectedMember, polls]);

  const summary = useMemo(() => {
    return getPollSummary(polls, members.length);
  }, [polls, members.length, getPollSummary]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    return members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()));
  }, [members, memberSearch]);

  const existingResponse = useMemo(() => {
    if (!selectedMember) return null;
    return polls.find(p => p.member_id === selectedMember);
  }, [selectedMember, polls]);

  const handleSubmit = async () => {
    if (!activePollMatch || !selectedMember || !selectedResponse) return;

    try {
      setSubmitting(true);
      await submitResponse(activePollMatch.id, selectedMember, selectedResponse, note || undefined);
      setSubmitted(true);
    } catch {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeResponse = () => {
    setSubmitted(false);
  };

  const handleStartPoll = async (matchId: string) => {
    try {
      setStartingPollFor(matchId);
      const updates: Partial<Match> = { polling_enabled: true };
      if (pollDeadline) {
        updates.polling_deadline = new Date(pollDeadline).toISOString();
      }
      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId);

      if (error) throw error;
      setPollDeadline('');
      setShowStartPoll(false);
      onMatchUpdate?.();
    } catch {
      // silently fail
    } finally {
      setStartingPollFor(null);
    }
  };

  const handleClosePoll = useCallback(async () => {
    if (!activePollMatch) return;
    try {
      const { error } = await supabase
        .from('matches')
        .update({ polling_enabled: false })
        .eq('id', activePollMatch.id);

      if (error) throw error;
      onMatchUpdate?.();
    } catch {
      // silently fail
    }
  }, [activePollMatch, onMatchUpdate]);

  const handleSharePoll = () => {
    if (!activePollMatch) return;
    const matchDate = new Date(activePollMatch.date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const pollUrl = `${window.location.origin}/poll/${activePollMatch.id}`;

    const message =
      `🏏 *Squad Availability Poll*\n\n` +
      `📅 ${matchDate}\n📍 ${activePollMatch.venue}` +
      (activePollMatch.opponent ? `\nvs ${activePollMatch.opponent}` : '') +
      (activePollMatch.polling_deadline
        ? `\n⏰ Respond by ${new Date(activePollMatch.polling_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '') +
      `\n\n👉 Mark your availability:\n${pollUrl}` +
      `\n\n- Sangria Cricket Club`;

    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {
        navigator.clipboard.writeText(message);
      });
    } else {
      navigator.clipboard.writeText(message);
      alert('Poll link copied to clipboard!');
    }
  };

  const matchDate = activePollMatch
    ? new Date(activePollMatch.date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

  // If no active poll and not admin, or no upcoming matches at all, don't show anything
  if (!activePollMatch && !isAdmin) return null;
  if (!activePollMatch && upcomingWithoutPoll.length === 0) return null;

  // Admin: start poll UI if no active poll
  if (!activePollMatch && isAdmin) {
    return (
      <Card delay={360} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-primary-500" />
            Squad Availability Poll
          </h3>
          <button
            onClick={() => setShowStartPoll(!showStartPoll)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            Start Poll
            {showStartPoll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <CardContent className="p-6">
          {!showStartPoll ? (
            <div className="text-center py-4">
              <Vote className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No active polls. Start a poll for an upcoming match.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Select an upcoming match to start polling:
              </p>
              {upcomingWithoutPoll.map((match) => {
                const mDate = new Date(match.date).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex-shrink-0">
                        {match.match_type === 'internal' ? (
                          <Swords className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        ) : (
                          <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {match.match_type === 'internal' ? 'Internal Match' : `vs ${match.opponent || 'TBD'}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {mDate} • {match.venue}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartPoll(match.id)}
                      disabled={startingPollFor === match.id}
                    >
                      {startingPollFor === match.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <>
                          <BarChart3 className="w-3.5 h-3.5 mr-1" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
              {/* Optional deadline input */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Poll deadline (optional, applies to next start)
                </label>
                <input
                  type="datetime-local"
                  value={pollDeadline}
                  onChange={(e) => setPollDeadline(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Active poll: show poll card for all users
  const match = activePollMatch!;
  return (
    <Card delay={360} className="overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5" />
            <h3 className="font-semibold">Squad Availability Poll</h3>
          </div>
          {match.polling_deadline && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${isPollClosed ? 'bg-red-500/30 text-red-100' : 'bg-white/20'}`}>
              <Clock className="w-3 h-3 inline mr-1" />
              {isPollClosed ? 'Closed' : countdown}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-primary-100">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {matchDate}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {match.venue}
          </span>
          {match.opponent && match.match_type !== 'internal' && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              vs {match.opponent}
            </span>
          )}
          {match.match_type === 'internal' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-xs">
              <Swords className="w-3 h-3" /> Internal
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Response Summary Bar */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.available}</span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.maybe}</span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">Maybe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.unavailable}</span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">Out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.noResponse}</span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">Pending</span>
          </div>
        </div>

        {/* Progress bar */}
        {polls.length > 0 && (
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {summary.available > 0 && (
              <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(summary.available / summary.total) * 100}%` }} />
            )}
            {summary.maybe > 0 && (
              <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(summary.maybe / summary.total) * 100}%` }} />
            )}
            {summary.unavailable > 0 && (
              <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(summary.unavailable / summary.total) * 100}%` }} />
            )}
          </div>
        )}

        {/* Voting Section */}
        {!isPollClosed && !submitted && (
          <div className="space-y-3">
            {/* Step 1: Select Member */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Select your name
              </p>
              <input
                type="text"
                placeholder="Search member..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {filteredMembers.map((member) => {
                  const memberPoll = polls.find(p => p.member_id === member.id);

                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedMember(member.id);
                        setSubmitted(false);
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-sm ${
                        selectedMember === member.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-gray-900 dark:text-white text-xs">
                          {member.name}
                        </p>
                        {memberPoll && (
                          <span className={`text-[10px] font-medium ${
                            memberPoll.response === 'available'
                              ? 'text-green-600'
                              : memberPoll.response === 'maybe'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}>
                            {memberPoll.response === 'available' ? 'In' : memberPoll.response === 'maybe' ? 'Maybe' : 'Out'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Response */}
            {selectedMember && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Your availability
                  {existingResponse && (
                    <span className="ml-1 text-amber-500 normal-case">(updating)</span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(RESPONSE_CONFIG) as PollResponse[]).map((response) => {
                    const config = RESPONSE_CONFIG[response];
                    const Icon = config.icon;
                    const isSelected = selectedResponse === response;

                    return (
                      <button
                        key={response}
                        onClick={() => setSelectedResponse(response)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? `${config.border} ${config.bg} ring-2 ${config.ringColor}`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${isSelected ? config.color : 'text-gray-400'}`} />
                        <span className={`text-xs font-semibold ${isSelected ? config.color : 'text-gray-500 dark:text-gray-400'}`}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Note + Submit */}
                {selectedResponse && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Add a note (optional)..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      {submitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {existingResponse ? 'Update' : 'Submit'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submitted State */}
        {submitted && selectedResponse && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Response Submitted!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              You marked yourself as{' '}
              <span className={`font-semibold ${
                selectedResponse === 'available' ? 'text-green-600' : selectedResponse === 'maybe' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {RESPONSE_CONFIG[selectedResponse].label}
              </span>
            </p>
            <button
              onClick={handleChangeResponse}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change Response
            </button>
          </div>
        )}

        {/* Poll Closed State */}
        {isPollClosed && !submitted && (
          <div className="text-center py-4">
            <XCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Poll Closed</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This poll is no longer accepting responses.
            </p>
          </div>
        )}

        {/* Toggle Responses List */}
        {polls.length > 0 && (
          <button
            onClick={() => setShowResponses(!showResponses)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              View Responses ({polls.length}/{members.length})
            </span>
            {showResponses ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}

        {/* Responses List */}
        {showResponses && polls.length > 0 && (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {polls.map((poll) => {
              const member = poll.member || members.find(m => m.id === poll.member_id);
              if (!member) return null;
              const config = RESPONSE_CONFIG[poll.response];
              const Icon = config.icon;

              return (
                <div key={poll.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{member.name}</span>
                      {poll.note && (
                        <span className="text-[10px] text-gray-400 truncate block">"{poll.note}"</span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button size="sm" onClick={handleSharePoll} className="flex-1 !bg-green-600 hover:!bg-green-700 !text-white">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Share
            </Button>
            <Button size="sm" variant="secondary" onClick={handleClosePoll} className="flex-shrink-0">
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Close Poll
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
