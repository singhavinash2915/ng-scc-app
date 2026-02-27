import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronLeft,
  Users,
  Send,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMatchPolls } from '../hooks/useMatchPolls';
import { useTheme } from '../context/ThemeContext';
import type { Match, Member, PollResponse } from '../types';

export function MatchPoll() {
  const { matchId } = useParams<{ matchId: string }>();
  const { theme } = useTheme();
  const { polls, fetchPollsByMatch, submitResponse, getPollSummary } = useMatchPolls();

  const [match, setMatch] = useState<Match | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<PollResponse | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch match + members
  useEffect(() => {
    if (!matchId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [matchResult, membersResult] = await Promise.all([
          supabase.from('matches').select('*').eq('id', matchId).single(),
          supabase.from('members').select('*').order('name'),
        ]);

        if (matchResult.error) throw matchResult.error;
        if (membersResult.error) throw membersResult.error;

        setMatch(matchResult.data);
        setMembers(membersResult.data || []);

        await fetchPollsByMatch(matchId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [matchId, fetchPollsByMatch]);

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

  // Poll deadline logic
  const isPollClosed = useMemo(() => {
    if (!match) return false;
    if (!match.polling_enabled) return true;
    if (match.result !== 'upcoming') return true;
    if (match.polling_deadline) {
      return new Date(match.polling_deadline) < new Date();
    }
    return false;
  }, [match]);

  // Countdown timer
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!match?.polling_deadline) return;

    const updateCountdown = () => {
      const deadline = new Date(match.polling_deadline!);
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
  }, [match?.polling_deadline]);

  const handleSubmit = async () => {
    if (!matchId || !selectedMember || !selectedResponse) return;

    try {
      setSubmitting(true);
      await submitResponse(matchId, selectedMember, selectedResponse, note || undefined);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeResponse = () => {
    setSubmitted(false);
  };

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

  // Format match date
  const matchDate = match ? new Date(match.date) : null;
  const formattedDate = matchDate
    ? matchDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Poll Not Found
          </h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {error || 'This poll link may be invalid or expired.'}
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </div>
    );
  }

  const isInternal = match.match_type === 'internal';

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/scc-logo.jpg"
              alt="SCC"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <h1 className="font-bold text-lg">Squad Availability Poll</h1>
              <p className="text-primary-200 text-xs">Sangria Cricket Club</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-primary-200" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary-200" />
              <span>{match.venue}</span>
            </div>
            {match.opponent && !isInternal && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-primary-200" />
                <span>vs {match.opponent}</span>
              </div>
            )}
            {isInternal && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                Internal Match
              </div>
            )}
          </div>

          {/* Deadline */}
          {match.polling_deadline && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${isPollClosed ? 'text-red-200' : 'text-yellow-200'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-medium">{isPollClosed ? 'Poll Closed' : countdown}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Response Summary */}
        <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <h3 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Responses ({polls.length}/{members.length})
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {summary.available}
              </span>
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {summary.maybe}
              </span>
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Maybe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {summary.unavailable}
              </span>
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Can't</span>
            </div>
          </div>
        </div>

        {isPollClosed ? (
          /* Poll Closed State */
          <div className={`rounded-xl p-6 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className={`font-semibold text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Poll Closed
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              This availability poll is no longer accepting responses.
            </p>
          </div>
        ) : submitted ? (
          /* Success State */
          <div className={`rounded-xl p-6 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className={`font-semibold text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Response Submitted!
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              You marked yourself as{' '}
              <span className={`font-semibold ${
                selectedResponse === 'available'
                  ? 'text-green-600'
                  : selectedResponse === 'maybe'
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}>
                {selectedResponse === 'available' ? 'Available' : selectedResponse === 'maybe' ? 'Maybe' : 'Not Available'}
              </span>
              {note && <span> — "{note}"</span>}
            </p>
            <button
              onClick={handleChangeResponse}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Change Response
            </button>
          </div>
        ) : (
          <>
            {/* Step 1: Select Member */}
            <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
              <h3 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                1. Who are you?
              </h3>
              <input
                type="text"
                placeholder="Search your name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm mb-3 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-primary-500`}
              />
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {filteredMembers.map((member) => {
                  const hasResponse = polls.some(p => p.member_id === member.id);
                  const memberResponse = polls.find(p => p.member_id === member.id);

                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                        selectedMember === member.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
                          : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {member.name}
                        </p>
                        {hasResponse && (
                          <span className={`text-[10px] font-medium ${
                            memberResponse?.response === 'available'
                              ? 'text-green-600'
                              : memberResponse?.response === 'maybe'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}>
                            {memberResponse?.response === 'available' ? '✅ Available' : memberResponse?.response === 'maybe' ? '🤔 Maybe' : '❌ Can\'t'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Response (shown after member selection) */}
            {selectedMember && (
              <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                <h3 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  2. Are you available?
                  {existingResponse && (
                    <span className="ml-2 text-xs font-normal text-amber-500">(Updating existing response)</span>
                  )}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedResponse('available')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedResponse === 'available'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : theme === 'dark'
                        ? 'border-gray-700 hover:border-green-500/50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <CheckCircle2 className={`w-8 h-8 ${selectedResponse === 'available' ? 'text-green-600' : 'text-green-400'}`} />
                    <span className={`text-sm font-semibold ${
                      selectedResponse === 'available'
                        ? 'text-green-700 dark:text-green-400'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Available
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedResponse('maybe')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedResponse === 'maybe'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : theme === 'dark'
                        ? 'border-gray-700 hover:border-amber-500/50'
                        : 'border-gray-200 hover:border-amber-300'
                    }`}
                  >
                    <HelpCircle className={`w-8 h-8 ${selectedResponse === 'maybe' ? 'text-amber-600' : 'text-amber-400'}`} />
                    <span className={`text-sm font-semibold ${
                      selectedResponse === 'maybe'
                        ? 'text-amber-700 dark:text-amber-400'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Maybe
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedResponse('unavailable')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedResponse === 'unavailable'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : theme === 'dark'
                        ? 'border-gray-700 hover:border-red-500/50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <XCircle className={`w-8 h-8 ${selectedResponse === 'unavailable' ? 'text-red-600' : 'text-red-400'}`} />
                    <span className={`text-sm font-semibold ${
                      selectedResponse === 'unavailable'
                        ? 'text-red-700 dark:text-red-400'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Can't Play
                    </span>
                  </button>
                </div>

                {/* Note */}
                {selectedResponse && (
                  <div className="mt-4">
                    <label className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Add a note (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Will be 15 min late..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                    />
                  </div>
                )}

                {/* Submit */}
                {selectedResponse && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {existingResponse ? 'Update Response' : 'Submit Response'}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center pb-8">
          <Link
            to="/matches"
            className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} hover:text-primary-500 transition-colors`}
          >
            Sangria Cricket Club
          </Link>
        </div>
      </div>
    </div>
  );
}
