import { useState, useMemo } from 'react';
import { MessageCircle, MapPin, Clock, Car, Briefcase, Copy, Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, TextArea, Select } from './ui/Input';
import type { Match, Member } from '../types';

interface MatchDayMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  members: Member[];
}

export function MatchDayMessageModal({
  isOpen,
  onClose,
  match,
  members,
}: MatchDayMessageModalProps) {
  const [reportingTime, setReportingTime] = useState('');
  const [groundLocation, setGroundLocation] = useState('');
  const [kitBagHolders, setKitBagHolders] = useState<string[]>([]);
  const [carDrivers, setCarDrivers] = useState<string[]>([]);
  const [carsNeeded, setCarsNeeded] = useState('3');
  const [extraNotes, setExtraNotes] = useState('');
  const [copied, setCopied] = useState(false);

  // Get squad members for this match
  const squadMembers = useMemo(() => {
    if (!match.players) return [];
    const memberMap = new Map(members.map(m => [m.id, m]));
    return match.players
      .map(p => memberMap.get(p.member_id))
      .filter((m): m is Member => !!m);
  }, [match.players, members]);

  // Build the WhatsApp message
  const message = useMemo(() => {
    const matchDate = new Date(match.date + 'T00:00:00');
    const dateStr = matchDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const kitHolderNames = kitBagHolders
      .map(id => members.find(m => m.id === id)?.name)
      .filter(Boolean);

    const driverNames = carDrivers
      .map(id => members.find(m => m.id === id)?.name)
      .filter(Boolean);

    const squadNames = squadMembers.map((m, i) => `${i + 1}. ${m.name}`);

    // Fee status
    const paidPlayers = match.players?.filter(p => p.fee_paid) || [];
    const unpaidPlayers = match.players?.filter(p => !p.fee_paid) || [];
    const unpaidNames = unpaidPlayers
      .map(p => members.find(m => m.id === p.member_id)?.name)
      .filter(Boolean);

    let msg = `🏏 *SANGRIA CRICKET CLUB*\n`;
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `*MATCH DAY INFO*\n\n`;

    msg += `📅 *Date:* ${dateStr}\n`;
    msg += `📍 *Venue:* ${match.venue}\n`;

    if (match.opponent) {
      msg += `🆚 *Opponent:* ${match.opponent}\n`;
    }

    if (reportingTime) {
      msg += `⏰ *Reporting Time:* ${reportingTime}\n`;
    }

    if (groundLocation) {
      msg += `📌 *Ground Location:* ${groundLocation}\n`;
    }

    msg += `\n━━━━━━━━━━━━━━━\n`;
    msg += `*SQUAD (${squadNames.length} players)*\n\n`;
    msg += squadNames.join('\n');

    if (kitHolderNames.length > 0) {
      msg += `\n\n━━━━━━━━━━━━━━━\n`;
      msg += `🎒 *Kit Bag:*\n`;
      kitHolderNames.forEach(name => {
        msg += `  • ${name}\n`;
      });
    }

    if (driverNames.length > 0 || parseInt(carsNeeded) > 0) {
      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `🚗 *Transport (Min ${carsNeeded} cars needed):*\n`;
      if (driverNames.length > 0) {
        driverNames.forEach(name => {
          msg += `  🚙 ${name}\n`;
        });
      }
      if (driverNames.length < parseInt(carsNeeded)) {
        const remaining = parseInt(carsNeeded) - driverNames.length;
        msg += `  ⚠️ ${remaining} more car${remaining > 1 ? 's' : ''} needed!\n`;
      }
    }

    if (match.match_fee > 0) {
      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `💰 *Match Fee: ₹${match.match_fee}/player*\n`;
      msg += `✅ Paid: ${paidPlayers.length}/${match.players?.length || 0}\n`;
      if (unpaidNames.length > 0) {
        msg += `❌ Unpaid: ${unpaidNames.join(', ')}\n`;
      }
    }

    if (extraNotes.trim()) {
      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `📝 *Note:* ${extraNotes.trim()}\n`;
    }

    msg += `\n━━━━━━━━━━━━━━━\n`;
    msg += `_Sangria Cricket Club_ 🏏`;

    return msg;
  }, [match, members, squadMembers, reportingTime, groundLocation, kitBagHolders, carDrivers, carsNeeded, extraNotes]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const toggleKitBagHolder = (memberId: string) => {
    setKitBagHolders(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleCarDriver = (memberId: string) => {
    setCarDrivers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Match Day Message" size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form inputs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4" />
            Reporting Time
          </div>
          <Input
            type="time"
            value={reportingTime}
            onChange={e => setReportingTime(e.target.value)}
            placeholder="e.g., 07:00 AM"
          />

          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <MapPin className="w-4 h-4" />
            Ground Location (Google Maps link)
          </div>
          <Input
            value={groundLocation}
            onChange={e => setGroundLocation(e.target.value)}
            placeholder="Paste Google Maps link here"
          />

          {/* Kit Bag Holders */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Briefcase className="w-4 h-4" />
            Who has Kit Bags?
          </div>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {squadMembers.map(m => (
              <button
                key={m.id}
                onClick={() => toggleKitBagHolder(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  kitBagHolders.includes(m.id)
                    ? 'bg-primary-500 text-white ring-2 ring-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Cars */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Car className="w-4 h-4" />
            Transport
          </div>
          <Select
            value={carsNeeded}
            onChange={e => setCarsNeeded(e.target.value)}
            label="Minimum cars needed"
            options={[1, 2, 3, 4, 5, 6].map(n => ({
              value: String(n),
              label: `${n} car${n > 1 ? 's' : ''}`,
            }))}
          />

          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {squadMembers.map(m => (
              <button
                key={m.id}
                onClick={() => toggleCarDriver(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  carDrivers.includes(m.id)
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                🚗 {m.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <TextArea
            value={extraNotes}
            onChange={e => setExtraNotes(e.target.value)}
            placeholder="Any extra notes (optional)..."
            label="Additional Notes"
          />
        </div>

        {/* Right: Message preview */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Message Preview
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-[480px] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
              {message}
            </pre>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleShareWhatsApp}
              className="flex-1 !bg-green-600 hover:!bg-green-700 !text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Share on WhatsApp
            </Button>
            <Button onClick={handleCopy} variant="secondary" className="flex-shrink-0">
              {copied ? (
                <><Check className="w-4 h-4 mr-1" /> Copied</>
              ) : (
                <><Copy className="w-4 h-4 mr-1" /> Copy</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
