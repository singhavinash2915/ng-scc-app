import { useState, useEffect } from 'react';
import { MessageCircle, Phone, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { generateWhatsAppUrl } from '../utils/phone';
import type { Member } from '../types';

const PAYMENT_LINK = 'https://sangriacricket.club/payment';

interface WhatsAppRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  threshold?: number;
}

export function WhatsAppRemindersModal({
  isOpen,
  onClose,
  members,
  threshold = 1000,
}: WhatsAppRemindersModalProps) {
  const membersWithPhone = members.filter((m) => m.phone);
  const membersWithoutPhone = members.filter((m) => !m.phone);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pre-select all members with phone when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(membersWithPhone.map((m) => m.id)));
    }
  }, [isOpen, members]);

  const getMessage = (member: Member) => {
    const needed = Math.max(0, threshold - member.balance);
    return (
      `Hi ${member.name}, your SCC balance is ₹${member.balance.toFixed(0)}. ` +
      `Please deposit at least ₹${needed.toFixed(0)} to meet the minimum ₹${threshold} requirement. ` +
      `Pay online: ${PAYMENT_LINK} - Sangria Cricket Club`
    );
  };

  const handleSendOne = (member: Member) => {
    if (!member.phone) return;
    const url = generateWhatsAppUrl(member.phone, getMessage(member));
    if (url) window.open(url, '_blank');
  };

  const handleSendSelected = () => {
    const toSend = membersWithPhone.filter((m) => selectedIds.has(m.id));
    toSend.forEach((member, i) => {
      setTimeout(() => {
        const url = generateWhatsAppUrl(member.phone!, getMessage(member));
        if (url) window.open(url, '_blank');
      }, i * 600); // 600ms delay between each to avoid popup blocking
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = membersWithPhone.length > 0 && selectedIds.size === membersWithPhone.length;
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(membersWithPhone.map((m) => m.id)));
    }
  };

  const selectedCount = membersWithPhone.filter((m) => selectedIds.has(m.id)).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="WhatsApp Reminders" size="lg">
      <div className="space-y-4">

        {/* Info banner */}
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {membersWithPhone.length} member{membersWithPhone.length !== 1 ? 's' : ''} with
            balance below ₹{threshold} can be notified. Message includes the payment link.
          </p>
        </div>

        {membersWithPhone.length > 0 && (
          <>
            {/* Select All + Send Selected actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {allSelected
                  ? <CheckSquare className="w-4 h-4 text-primary-500" />
                  : <Square className="w-4 h-4" />
                }
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>

              <Button
                size="sm"
                onClick={handleSendSelected}
                disabled={selectedCount === 0}
                className="!bg-green-600 hover:!bg-green-700 !text-white disabled:opacity-50"
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                Send to Selected ({selectedCount})
              </Button>
            </div>

            {/* Member list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {membersWithPhone.map((member) => {
                const needed = Math.max(0, threshold - member.balance);
                const isSelected = selectedIds.has(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleSelect(member.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400 dark:ring-green-600'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <div className="flex-shrink-0">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-green-500" />
                          : <Square className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                      {/* Avatar */}
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="text-red-500 font-medium">₹{member.balance.toFixed(0)}</span>
                          <span>·</span>
                          <span>Needs ₹{needed.toFixed(0)}</span>
                          <span>·</span>
                          <span className="text-gray-400">{member.phone}</span>
                        </div>
                      </div>
                    </div>
                    {/* Individual Send button */}
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleSendOne(member); }}
                      className="flex-shrink-0 ml-2 !bg-green-600 hover:!bg-green-700 !text-white"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      Send
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Members without phone */}
        {membersWithoutPhone.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {membersWithoutPhone.length} member{membersWithoutPhone.length !== 1 ? 's' : ''} without phone number
              </p>
            </div>
            <div className="space-y-1">
              {membersWithoutPhone.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{member.name}</p>
                      <p className="text-xs text-red-500 font-medium">₹{member.balance.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Phone className="w-3 h-3" />
                    No phone
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            No members with balance below ₹{threshold}.
          </div>
        )}
      </div>
    </Modal>
  );
}
