import { useEffect, useState } from 'react';
import {
  MessageCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Users,
  Send,
  X,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useMatchPolls } from '../hooks/useMatchPolls';
import { generateWhatsAppUrl } from '../utils/phone';
import type { Match, Member, MatchPoll } from '../types';

interface PollManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  members: Member[];
  isAdmin: boolean;
  onClosePoll?: () => void;
}

const RESPONSE_CONFIG = {
  available: { icon: CheckCircle2, label: 'Available', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  maybe: { icon: HelpCircle, label: 'Maybe', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  unavailable: { icon: XCircle, label: "Can't Play", color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

export function PollManageModal({ isOpen, onClose, match, members, isAdmin, onClosePoll }: PollManageModalProps) {
  const { polls, fetchPollsByMatch, removeResponse, getPollSummary } = useMatchPolls();
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && match.id) {
      fetchPollsByMatch(match.id);
    }
  }, [isOpen, match.id, fetchPollsByMatch]);

  const summary = getPollSummary(polls, members.length);

  const respondedMembers = polls.map(p => ({
    poll: p,
    member: p.member || members.find(m => m.id === p.member_id),
  }));

  const respondedMemberIds = new Set(polls.map(p => p.member_id));
  const nonResponders = members.filter(m => !respondedMemberIds.has(m.id));

  const pollUrl = `${window.location.origin}/poll/${match.id}`;

  const handleRemoveResponse = async (poll: MatchPoll) => {
    try {
      setRemoving(poll.member_id);
      await removeResponse(match.id, poll.member_id);
      await fetchPollsByMatch(match.id);
    } finally {
      setRemoving(null);
    }
  };

  const handleSendReminder = (member: Member) => {
    if (!member.phone) return;

    const matchDate = new Date(match.date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const message =
      `Hi ${member.name}, please mark your availability for the upcoming match!\n\n` +
      `📅 ${matchDate}\n📍 ${match.venue}` +
      (match.opponent ? `\n🏏 vs ${match.opponent}` : '') +
      `\n\n👉 Respond here: ${pollUrl}` +
      `\n\n- Sangria Cricket Club`;

    const url = generateWhatsAppUrl(member.phone, message);
    if (url) window.open(url, '_blank');
  };

  const handleSharePoll = () => {
    const matchDate = new Date(match.date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const message =
      `🏏 *Squad Availability Poll*\n\n` +
      `📅 ${matchDate}\n📍 ${match.venue}` +
      (match.opponent ? `\nvs ${match.opponent}` : '') +
      (match.polling_deadline
        ? `\n⏰ Respond by ${new Date(match.polling_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '') +
      `\n\n👉 Mark your availability:\n${pollUrl}` +
      `\n\n- Sangria Cricket Club`;

    // Try native share first (mobile), fallback to clipboard
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {
        navigator.clipboard.writeText(message);
      });
    } else {
      navigator.clipboard.writeText(message);
      alert('Poll link copied to clipboard!');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Poll" size="lg">
      <div className="space-y-4">
        {/* Summary Bar */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.available}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.maybe}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.unavailable}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{summary.noResponse}</span>
            <span className="text-xs text-gray-400">pending</span>
          </div>
        </div>

        {/* Share + Close Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSharePoll} className="flex-1 !bg-green-600 hover:!bg-green-700 !text-white">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Share Poll Link
          </Button>
          {isAdmin && match.polling_enabled && onClosePoll && (
            <Button size="sm" variant="secondary" onClick={onClosePoll} className="flex-shrink-0">
              <X className="w-3.5 h-3.5 mr-1" />
              Close Poll
            </Button>
          )}
        </div>

        {/* Responded Members */}
        {respondedMembers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Responses ({respondedMembers.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {respondedMembers.map(({ poll, member }) => {
                if (!member) return null;
                const config = RESPONSE_CONFIG[poll.response];
                const Icon = config.icon;

                return (
                  <div
                    key={poll.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </div>
                        {poll.note && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">"{poll.note}"</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveResponse(poll)}
                        disabled={removing === poll.member_id}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Remove response"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Non-Responders */}
        {nonResponders.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Awaiting Response ({nonResponders.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {nonResponders.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-2.5">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</span>
                      {!member.phone && (
                        <p className="text-[10px] text-gray-400">No phone number</p>
                      )}
                    </div>
                  </div>
                  {member.phone && (
                    <Button
                      size="sm"
                      onClick={() => handleSendReminder(member)}
                      className="flex-shrink-0 !bg-green-600 hover:!bg-green-700 !text-white !px-2 !py-1"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      Remind
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {polls.length === 0 && nonResponders.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            No members found.
          </div>
        )}
      </div>
    </Modal>
  );
}
