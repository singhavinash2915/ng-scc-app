import { MessageCircle, Phone, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { generateWhatsAppUrl } from '../utils/phone';
import type { Member } from '../types';

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
  threshold = 500,
}: WhatsAppRemindersModalProps) {
  const membersWithPhone = members.filter((m) => m.phone);
  const membersWithoutPhone = members.filter((m) => !m.phone);

  const getMessage = (member: Member) => {
    const needed = threshold - member.balance;
    return `Hi ${member.name}, your SCC balance is ₹${member.balance.toFixed(0)}. Please deposit at least ₹${needed.toFixed(0)} to meet the minimum ₹${threshold} requirement. Thank you! - Sangria Cricket Club`;
  };

  const handleSend = (member: Member) => {
    if (!member.phone) return;
    const url = generateWhatsAppUrl(member.phone, getMessage(member));
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="WhatsApp Reminders" size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {membersWithPhone.length} member{membersWithPhone.length !== 1 ? 's' : ''} with
            balance below ₹{threshold} can be notified via WhatsApp.
          </p>
        </div>

        {membersWithPhone.length > 0 && (
          <div className="space-y-2">
            {membersWithPhone.map((member) => {
              const needed = threshold - member.balance;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSend(member)}
                    className="flex-shrink-0 !bg-green-600 hover:!bg-green-700 !text-white"
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    Send
                  </Button>
                </div>
              );
            })}
          </div>
        )}

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
