import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  IndianRupee,
  CheckCircle,
  XCircle,
  Users,
  Target,
  CreditCard,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Handshake,
  MapPin,
  Lock,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useSeasonFund } from '../hooks/useSeasonFund';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';
import type { Season, GroundBooking, MemberTier, FundPaymentMethod } from '../types';

// Member access PIN
const MEMBER_PIN = 'scc';
const PIN_STORAGE_KEY = 'scc-ground-booking-access';

// Four Star Ground config
const GROUND_NAME = 'Four Star Ground';
const TIME_SLOT = '7:00 AM - 9:00 AM';

// Season presets
const SEASON_PRESETS = {
  'oct-may': {
    label: 'Oct–May (Tue/Thu/Sat)',
    name: 'Season 2026-27',
    start_date: '2026-10-01',
    end_date: '2027-05-31',
    days: [2, 4, 6], // Tue, Thu, Sat
    weekday_cost: 5500,
    weekend_cost: 7500,
  },
  'may-only': {
    label: 'May Only (Tue/Thu)',
    name: 'May 2025',
    start_date: '2025-05-01',
    end_date: '2025-05-31',
    days: [2, 4], // Tue, Thu
    weekday_cost: 5000,
    weekend_cost: 5000,
  },
  'custom': {
    label: 'Custom',
    name: '',
    start_date: '',
    end_date: '',
    days: [2, 4, 6],
    weekday_cost: 5500,
    weekend_cost: 7500,
  },
} as const;
type PresetKey = keyof typeof SEASON_PRESETS;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const METHOD_LABELS: Record<FundPaymentMethod, string> = {
  cash: 'Cash',
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

const TIER_LABELS: Record<MemberTier, string> = {
  regular: 'Regular',
  occasional: 'Occasional',
  other: 'Other',
};

type TabType = 'bookings' | 'members';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const formatDate = (date: string) => {
  const d = new Date(date);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

export function SeasonFund() {
  const {
    seasons, payments, loading,
    addSeason, updateSeason, deleteSeason,
    updateBooking, deleteBooking,
    generateSeasonBookings, addBulkBookings,
    setMemberTargets, removeMemberTarget,
    fetchPayments, addPayment, deletePayment,
    getSeasonStats, getMemberFundStatus,
  } = useSeasonFund();
  const { members } = useMembers();
  const { isAdmin } = useAuth();

  // Member PIN access
  const [hasAccess, setHasAccess] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.toLowerCase() === MEMBER_PIN) {
      localStorage.setItem(PIN_STORAGE_KEY, 'true');
      setHasAccess(true);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Ask your team admin for access.');
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>('bookings');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editingBooking, setEditingBooking] = useState<GroundBooking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Season form
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('oct-may');
  const [seasonForm, setSeasonForm] = useState({
    name: 'Season 2026-27',
    start_date: '2026-10-01',
    end_date: '2027-05-31',
    total_budget: '',
    status: 'active' as Season['status'],
    notes: '',
    days: [2, 4, 6] as number[],
    weekday_cost: 5500,
    weekend_cost: 7500,
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as FundPaymentMethod,
    description: '',
  });

  // Target form
  const [targetTier, setTargetTier] = useState<MemberTier>('regular');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Booking edit form
  const [bookingEditForm, setBookingEditForm] = useState({
    cost: '',
    opponent_collection: '',
    opponent_name: '',
    status: 'booked' as GroundBooking['status'],
    payment_status: 'pending' as GroundBooking['payment_status'],
    notes: '',
  });

  // Auto-select season
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      const active = seasons.find(s => s.status === 'active');
      setSelectedSeasonId(active?.id || seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    if (selectedSeasonId) fetchPayments(selectedSeasonId);
  }, [selectedSeasonId, fetchPayments]);

  const selectedSeason = useMemo(() => seasons.find(s => s.id === selectedSeasonId) || null, [seasons, selectedSeasonId]);
  const stats = useMemo(() => selectedSeason ? getSeasonStats(selectedSeason) : null, [selectedSeason, getSeasonStats]);

  // Group bookings by month
  const bookingsByMonth = useMemo(() => {
    if (!selectedSeason?.bookings) return [];
    const groups = new Map<string, GroundBooking[]>();
    const sorted = [...selectedSeason.bookings]
      .filter(b => b.status !== 'cancelled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const booking of sorted) {
      const d = new Date(booking.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(booking);
    }

    return Array.from(groups.entries()).map(([key, bookings]) => {
      const d = new Date(bookings[0].date);
      return {
        key,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        bookings,
        totalCost: bookings.reduce((s, b) => s + Number(b.cost), 0),
        totalOpponent: bookings.reduce((s, b) => s + Number(b.opponent_collection || 0), 0),
        paidCount: bookings.filter(b => b.payment_status === 'paid').length,
      };
    });
  }, [selectedSeason]);

  // Member fund statuses
  const memberFundStatuses = useMemo(() => {
    if (!selectedSeason?.targets) return [];
    return selectedSeason.targets
      .map(t => ({
        ...t,
        ...getMemberFundStatus(selectedSeasonId, t.member_id),
      }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [selectedSeason, selectedSeasonId, getMemberFundStatus]);

  // ---- Handlers ----
  const handleCreateSeason = async () => {
    setIsSubmitting(true);
    try {
      // Store booking config as JSON in notes so generate can use it
      const configJson = JSON.stringify({
        days: seasonForm.days,
        weekday_cost: seasonForm.weekday_cost,
        weekend_cost: seasonForm.weekend_cost,
      });
      await addSeason({
        name: seasonForm.name,
        start_date: seasonForm.start_date,
        end_date: seasonForm.end_date,
        total_budget: Number(seasonForm.total_budget) || 0,
        status: seasonForm.status,
        notes: configJson,
      });
      setShowSeasonModal(false);
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSeason = async () => {
    if (!editingSeason) return;
    setIsSubmitting(true);
    try {
      await updateSeason(editingSeason.id, {
        name: seasonForm.name,
        start_date: seasonForm.start_date,
        end_date: seasonForm.end_date,
        total_budget: Number(seasonForm.total_budget) || 0,
        status: seasonForm.status,
        notes: seasonForm.notes || null,
      });
      setShowSeasonModal(false);
      setEditingSeason(null);
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateBookings = async (days?: number[], weekdayCost?: number, weekendCost?: number) => {
    if (!selectedSeason) return;
    if (selectedSeason.bookings && selectedSeason.bookings.length > 0) {
      alert('Bookings already exist for this season. Delete them first if you want to regenerate.');
      return;
    }
    setIsSubmitting(true);
    try {
      // Try to infer costs from the season's notes (stored as JSON config)
      let config = { days: days || [2, 4, 6], weekdayCost: weekdayCost || 5500, weekendCost: weekendCost || 7500 };
      try {
        const parsed = selectedSeason.notes ? JSON.parse(selectedSeason.notes) : null;
        if (parsed?.days) config.days = parsed.days;
        if (parsed?.weekday_cost) config.weekdayCost = parsed.weekday_cost;
        if (parsed?.weekend_cost) config.weekendCost = parsed.weekend_cost;
      } catch { /* not JSON, use defaults */ }
      if (days) config.days = days;
      if (weekdayCost) config.weekdayCost = weekdayCost;
      if (weekendCost) config.weekendCost = weekendCost;

      const bookings = generateSeasonBookings(
        selectedSeason.id,
        selectedSeason.start_date,
        selectedSeason.end_date,
        {
          venue: GROUND_NAME,
          timeSlot: TIME_SLOT,
          days: config.days,
          weekdayCost: config.weekdayCost,
          weekendCost: config.weekendCost,
        }
      );
      await addBulkBookings(bookings);
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaymentStatus = async (booking: GroundBooking) => {
    if (!isAdmin) return;
    const newStatus = booking.payment_status === 'paid' ? 'pending' : 'paid';
    await updateBooking(booking.id, { payment_status: newStatus });
  };

  const handleSaveBookingEdit = async () => {
    if (!editingBooking) return;
    setIsSubmitting(true);
    try {
      await updateBooking(editingBooking.id, {
        cost: Number(bookingEditForm.cost) || 0,
        opponent_collection: Number(bookingEditForm.opponent_collection) || 0,
        opponent_name: bookingEditForm.opponent_name || null,
        status: bookingEditForm.status,
        payment_status: bookingEditForm.payment_status,
        notes: bookingEditForm.notes || null,
      });
      setShowEditBookingModal(false);
      setEditingBooking(null);
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedSeasonId) return;
    setIsSubmitting(true);
    try {
      await addPayment({
        season_id: selectedSeasonId,
        member_id: paymentForm.member_id,
        amount: Number(paymentForm.amount),
        date: paymentForm.date,
        payment_method: paymentForm.payment_method,
        description: paymentForm.description || undefined,
      });
      setShowPaymentModal(false);
      setPaymentForm({ member_id: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: 'cash', description: '' });
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetTargets = async () => {
    if (!selectedSeasonId || selectedMemberIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await setMemberTargets(
        selectedSeasonId,
        selectedMemberIds.map(id => ({
          member_id: id,
          target_amount: Number(targetAmount) || 0,
          tier: targetTier,
        }))
      );
      setShowTargetModal(false);
      setSelectedMemberIds([]);
      setTargetAmount('');
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'season') {
        await deleteSeason(deleteConfirm.id);
        setSelectedSeasonId('');
      } else if (deleteConfirm.type === 'booking') {
        await deleteBooking(deleteConfirm.id);
      } else if (deleteConfirm.type === 'target') {
        await removeMemberTarget(deleteConfirm.id);
      } else if (deleteConfirm.type === 'payment') {
        await deletePayment(deleteConfirm.id, selectedSeasonId);
      }
      setDeleteConfirm(null);
    } catch { /* ignore */ } finally {
      setIsDeleting(false);
    }
  };

  const openEditBooking = (booking: GroundBooking) => {
    setEditingBooking(booking);
    setBookingEditForm({
      cost: String(booking.cost),
      opponent_collection: String(booking.opponent_collection || 0),
      opponent_name: booking.opponent_name || '',
      status: booking.status,
      payment_status: booking.payment_status,
      notes: booking.notes || '',
    });
    setShowEditBookingModal(true);
  };

  const openEditSeason = (season: Season) => {
    setEditingSeason(season);
    // Try to parse config from notes
    let days = [2, 4, 6];
    let weekday_cost = 5500;
    let weekend_cost = 7500;
    try {
      const parsed = season.notes ? JSON.parse(season.notes) : null;
      if (parsed?.days) days = parsed.days;
      if (parsed?.weekday_cost) weekday_cost = parsed.weekday_cost;
      if (parsed?.weekend_cost) weekend_cost = parsed.weekend_cost;
    } catch { /* not JSON */ }
    setSeasonForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      total_budget: String(season.total_budget),
      status: season.status,
      notes: season.notes || '',
      days,
      weekday_cost,
      weekend_cost,
    });
    setShowSeasonModal(true);
  };

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Get monthly payment breakdown for a member
  const getMemberMonthlyBreakdown = (memberId: string) => {
    const memberPayments = payments.filter(p => p.member_id === memberId);
    const monthMap = new Map<string, { label: string; total: number; payments: typeof payments }>();

    for (const p of memberPayments) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, total: 0, payments: [] as typeof payments };
      existing.total += Number(p.amount);
      existing.payments.push(p);
      monthMap.set(key, existing);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  };

  function renderProgressBar(value: number, max: number, color: string = 'bg-primary-500') {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  // ---- Member PIN Gate (admins bypass) ----
  if (!isAdmin && !hasAccess) {
    return (
      <div>
        <Header title="Ground Booking" subtitle="Four Star Ground — Members Only" />
        <div className="max-w-sm mx-auto mt-12">
          <Card animate>
            <CardContent className="text-center py-10">
              <Lock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Members Only</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Enter the member PIN to view ground bookings and contributions.
              </p>
              <form onSubmit={handlePinSubmit} className="space-y-3">
                <input
                  type="text"
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                  placeholder="Enter member PIN"
                  className="w-full px-4 py-2.5 text-center text-lg tracking-widest border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  autoFocus
                />
                {pinError && <p className="text-sm text-red-500">{pinError}</p>}
                <Button type="submit" className="w-full" disabled={!pinInput.trim()}>
                  Access Ground Booking
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div>
        <Header title="Ground Booking" subtitle={`${GROUND_NAME} — ${TIME_SLOT}`} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </div>
    );
  }

  // ---- No season yet ----
  if (seasons.length === 0) {
    return (
      <div>
        <Header title="Ground Booking" subtitle={`${GROUND_NAME} — ${TIME_SLOT}`} />
        <div className="max-w-lg mx-auto mt-12">
          <Card animate>
            <CardContent className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Season Created</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Create a season for {GROUND_NAME} ({TIME_SLOT}).
              </p>
              {isAdmin ? (
                <Button onClick={() => {
                  setEditingSeason(null);
                  const preset = SEASON_PRESETS['oct-may'];
                  setSelectedPreset('oct-may');
                  setSeasonForm({ name: preset.name, start_date: preset.start_date, end_date: preset.end_date, total_budget: '', status: 'active', notes: '', days: [...preset.days], weekday_cost: preset.weekday_cost, weekend_cost: preset.weekend_cost });
                  setShowSeasonModal(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Season
                </Button>
              ) : (
                <p className="text-sm text-gray-400">Ask an admin to create the season.</p>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Season Modal for empty state */}
        <Modal isOpen={showSeasonModal} onClose={() => { setShowSeasonModal(false); setEditingSeason(null); }} title="Create Season">
          <div className="space-y-4">
            {/* Preset selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quick Setup</label>
              <div className="flex gap-2">
                {(Object.keys(SEASON_PRESETS) as PresetKey[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(key);
                      const p = SEASON_PRESETS[key];
                      setSeasonForm(f => ({
                        ...f,
                        name: p.name || f.name,
                        start_date: p.start_date || f.start_date,
                        end_date: p.end_date || f.end_date,
                        days: [...p.days],
                        weekday_cost: p.weekday_cost,
                        weekend_cost: p.weekend_cost,
                      }));
                    }}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectedPreset === key
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {SEASON_PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Season Name" value={seasonForm.name} onChange={(e) => setSeasonForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" label="Start Date" value={seasonForm.start_date} onChange={(e) => setSeasonForm(f => ({ ...f, start_date: e.target.value }))} />
              <Input type="date" label="End Date" value={seasonForm.end_date} onChange={(e) => setSeasonForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Booking Days</label>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((day, idx) => {
                  const isSelected = seasonForm.days.includes(idx);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSeasonForm(f => ({
                          ...f,
                          days: isSelected ? f.days.filter(d => d !== idx) : [...f.days, idx].sort(),
                        }));
                        setSelectedPreset('custom');
                      }}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                        isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" label="Weekday Cost (₹)" value={String(seasonForm.weekday_cost)} onChange={(e) => setSeasonForm(f => ({ ...f, weekday_cost: Number(e.target.value) || 0 }))} />
              <Input type="number" label="Weekend Cost (₹)" value={String(seasonForm.weekend_cost)} onChange={(e) => setSeasonForm(f => ({ ...f, weekend_cost: Number(e.target.value) || 0 }))} />
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{GROUND_NAME} · {TIME_SLOT}</p>
              <p>{seasonForm.days.map(d => DAY_NAMES[d]).join(', ')} — Weekday ₹{seasonForm.weekday_cost.toLocaleString()} | Weekend ₹{seasonForm.weekend_cost.toLocaleString()}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowSeasonModal(false)} className="flex-1" disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleCreateSeason} className="flex-1" disabled={isSubmitting || !seasonForm.name || !seasonForm.start_date || !seasonForm.end_date || seasonForm.days.length === 0}>
                {isSubmitting ? 'Creating...' : 'Create Season'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ---- Main Page ----
  const tabs: { key: TabType; label: string; icon: typeof Calendar }[] = [
    { key: 'bookings', label: 'Ground Bookings', icon: Calendar },
    { key: 'members', label: 'Member Contributions', icon: Users },
  ];

  return (
    <div>
      <Header title="Ground Booking" subtitle={`${GROUND_NAME} — ${TIME_SLOT}`} />

      {/* Season Selector + Add New */}
      <div className="flex items-center gap-3 mb-4">
        {seasons.length > 1 && (
          <Select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="!w-auto min-w-[200px]"
            options={seasons.map(s => ({ value: s.id, label: `${s.name}${s.status === 'active' ? ' (Active)' : ''}` }))}
          />
        )}
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => {
            setEditingSeason(null);
            const preset = SEASON_PRESETS['oct-may'];
            setSelectedPreset('oct-may');
            setSeasonForm({ name: preset.name, start_date: preset.start_date, end_date: preset.end_date, total_budget: '', status: 'active', notes: '', days: [...preset.days], weekday_cost: preset.weekday_cost, weekend_cost: preset.weekend_cost });
            setShowSeasonModal(true);
          }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Season
          </Button>
        )}
      </div>

      {selectedSeason && (
        <div className="space-y-6">

          {/* ===== STATS CARDS ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card animate delay={0}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Landmark className="w-3.5 h-3.5 text-orange-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ground Cost</p>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.totalSpent || 0)}</p>
              </CardContent>
            </Card>
            <Card animate delay={1}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Handshake className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Opponent</p>
                </div>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats?.totalOpponentCollection || 0)}</p>
              </CardContent>
            </Card>
            <Card animate delay={2}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3.5 h-3.5 text-purple-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Net Cost</p>
                </div>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats?.netCost || 0)}</p>
              </CardContent>
            </Card>
            <Card animate delay={3}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Collected</p>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(stats?.totalCollected || 0)}</p>
              </CardContent>
            </Card>
            <Card animate delay={4}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-red-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding</p>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(Math.max(0, stats?.outstanding || 0))}</p>
              </CardContent>
            </Card>
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats && stats.totalTarget > 0 && (
              <Card animate delay={5}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Member Collection</p>
                    <p className="text-xs text-gray-500">{formatCurrency(stats.totalCollected)} / {formatCurrency(stats.totalTarget)} ({Math.round((stats.totalCollected / stats.totalTarget) * 100)}%)</p>
                  </div>
                  {renderProgressBar(stats.totalCollected, stats.totalTarget, 'bg-green-500')}
                </CardContent>
              </Card>
            )}
            {stats && stats.bookingCount > 0 && (
              <Card animate delay={6}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Ground Owner Paid</p>
                    <p className="text-xs text-gray-500">{formatCurrency(stats.groundOwnerPaid)} / {formatCurrency(stats.totalSpent)} ({stats.paidBookingCount}/{stats.bookingCount})</p>
                  </div>
                  {renderProgressBar(stats.groundOwnerPaid, stats.totalSpent, 'bg-orange-500')}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== TABS ===== */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 flex-1 justify-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ===== BOOKINGS TAB ===== */}
          {activeTab === 'bookings' && (
            <div>
              {isAdmin && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    {selectedSeason.bookings && selectedSeason.bookings.length === 0 && (
                      <Button size="sm" onClick={() => handleGenerateBookings()} disabled={isSubmitting}>
                        <Calendar className="w-3.5 h-3.5 mr-1" />
                        {isSubmitting ? 'Generating...' : 'Generate All Bookings'}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEditSeason(selectedSeason)}>
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Season
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ type: 'season', id: selectedSeason.id, name: selectedSeason.name })}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Season
                    </Button>
                  </div>
                </div>
              )}

              {bookingsByMonth.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No bookings yet</p>
                    {isAdmin && <p className="text-xs text-gray-400 mt-1">Click "Generate All Bookings" to auto-create Tue/Thu/Sat schedule</p>}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bookingsByMonth.map(group => {
                    const isCollapsed = collapsedMonths.has(group.key);
                    return (
                      <Card key={group.key} animate>
                        <CardContent className="p-0">
                          {/* Month header */}
                          <button
                            onClick={() => toggleMonth(group.key)}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-t-xl"
                          >
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</span>
                              <Badge variant="info" size="sm">{group.bookings.length} sessions</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-gray-500">{formatCurrency(group.totalCost)}</span>
                              {group.totalOpponent > 0 && <span className="text-blue-500">Opp: +{formatCurrency(group.totalOpponent)}</span>}
                              <span className="text-green-600">{group.paidCount}/{group.bookings.length} paid</span>
                            </div>
                          </button>

                          {/* Booking rows */}
                          {!isCollapsed && (
                            <div className="border-t border-gray-100 dark:border-gray-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    <th className="text-left py-2 px-3 font-medium">Date</th>
                                    <th className="text-right py-2 px-2 font-medium">Cost</th>
                                    <th className="text-right py-2 px-2 font-medium">Opponent</th>
                                    <th className="text-right py-2 px-2 font-medium">Net</th>
                                    <th className="text-center py-2 px-2 font-medium">Paid</th>
                                    {isAdmin && <th className="text-center py-2 px-2 font-medium w-16"></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.bookings.map(booking => {
                                    const d = new Date(booking.date);
                                    const isSat = d.getDay() === 6;
                                    const net = Number(booking.cost) - Number(booking.opponent_collection || 0);
                                    const isPast = d < new Date();

                                    return (
                                      <tr
                                        key={booking.id}
                                        className={`border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                                          booking.status === 'cancelled' ? 'opacity-40 line-through' : ''
                                        }`}
                                      >
                                        <td className="py-2 px-3">
                                          <div>
                                            <span className={`font-medium ${isSat ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                              {formatDate(booking.date)}
                                            </span>
                                            {!isPast && booking.status !== 'cancelled' && (
                                              <Badge variant="info" size="sm" className="ml-1">upcoming</Badge>
                                            )}
                                          </div>
                                          {booking.opponent_name && (
                                            <span className="text-xs text-blue-500">vs {booking.opponent_name}</span>
                                          )}
                                          {booking.notes && !booking.opponent_name && (
                                            <span className="text-xs text-gray-400">{booking.notes}</span>
                                          )}
                                        </td>
                                        <td className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">
                                          {formatCurrency(Number(booking.cost))}
                                        </td>
                                        <td className="text-right py-2 px-2">
                                          {Number(booking.opponent_collection) > 0 ? (
                                            <span className="text-blue-600 dark:text-blue-400">+{formatCurrency(Number(booking.opponent_collection))}</span>
                                          ) : (
                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                          )}
                                        </td>
                                        <td className="text-right py-2 px-2 font-medium text-gray-900 dark:text-white">
                                          {formatCurrency(net)}
                                        </td>
                                        <td className="text-center py-2 px-2">
                                          {isAdmin ? (
                                            <button
                                              onClick={() => handleTogglePaymentStatus(booking)}
                                              className="inline-flex items-center justify-center"
                                              title={booking.payment_status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
                                            >
                                              {booking.payment_status === 'paid' ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                              ) : (
                                                <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-amber-500" />
                                              )}
                                            </button>
                                          ) : (
                                            booking.payment_status === 'paid' ? (
                                              <CheckCircle className="w-4 h-4 text-green-500 inline" />
                                            ) : (
                                              <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 inline" />
                                            )
                                          )}
                                        </td>
                                        {isAdmin && (
                                          <td className="text-center py-2 px-2">
                                            <div className="flex gap-0.5 justify-center">
                                              <button onClick={() => openEditBooking(booking)} className="p-1 text-gray-400 hover:text-gray-600">
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => setDeleteConfirm({ type: 'booking', id: booking.id, name: formatDate(booking.date) })} className="p-1 text-gray-400 hover:text-red-500">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== MEMBERS TAB ===== */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Actions */}
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setPaymentForm({ member_id: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: 'cash', description: '' }); setShowPaymentModal(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Record Payment
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setSelectedMemberIds([]); setTargetAmount(''); setShowTargetModal(true); }}>
                    <Target className="w-3.5 h-3.5 mr-1" /> Set Targets
                  </Button>
                </div>
              )}

              {/* Member Contributions Table */}
              {memberFundStatuses.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No member targets set</p>
                    {isAdmin && <p className="text-xs text-gray-400 mt-1">Click "Set Targets" to assign advance payment amounts</p>}
                  </CardContent>
                </Card>
              ) : (
                <Card animate>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left py-2.5 px-3 font-medium">Member</th>
                          <th className="text-right py-2.5 px-2 font-medium">Target</th>
                          <th className="text-right py-2.5 px-2 font-medium">Paid</th>
                          <th className="text-right py-2.5 px-2 font-medium">Due</th>
                          <th className="py-2.5 px-2 font-medium w-24">Progress</th>
                          {isAdmin && <th className="text-center py-2.5 px-2 font-medium w-16"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllMembers ? memberFundStatuses : memberFundStatuses.slice(0, 10)).map(m => {
                          const pct = m.target > 0 ? Math.round((m.paid / m.target) * 100) : 0;
                          const barColor = pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500';
                          const isExpanded = expandedMemberId === m.member_id;
                          const colCount = isAdmin ? 6 : 5;

                          return (
                            <React.Fragment key={m.member_id}>
                              <tr
                                className={`border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer ${isExpanded ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}
                                onClick={() => setExpandedMemberId(isExpanded ? null : m.member_id)}
                              >
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                    {m.member?.avatar_url ? (
                                      <img src={m.member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                        <span className="text-xs text-gray-500">{m.member?.name?.[0]}</span>
                                      </div>
                                    )}
                                    <span className="text-gray-700 dark:text-gray-300">{m.member?.name}</span>
                                    <Badge variant={m.tier === 'regular' ? 'success' : m.tier === 'occasional' ? 'warning' : 'info'} size="sm">
                                      {TIER_LABELS[m.tier]}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">{formatCurrency(m.target)}</td>
                                <td className="text-right py-2 px-2 font-medium text-green-600">{formatCurrency(m.paid)}</td>
                                <td className="text-right py-2 px-2 font-medium text-red-600">
                                  {m.outstanding > 0 ? formatCurrency(m.outstanding) : <CheckCircle className="w-4 h-4 text-green-500 inline" />}
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1.5">
                                    {renderProgressBar(m.paid, m.target, barColor)}
                                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                                  </div>
                                </td>
                                {isAdmin && (
                                  <td className="text-center py-2 px-2">
                                    <div className="flex gap-0.5 justify-center" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => {
                                          setPaymentForm(prev => ({ ...prev, member_id: m.member_id }));
                                          setShowPaymentModal(true);
                                        }}
                                        className="p-1 text-gray-400 hover:text-green-600"
                                        title="Record payment"
                                      >
                                        <IndianRupee className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setDeleteConfirm({ type: 'target', id: m.id, name: m.member?.name || '' })} className="p-1 text-gray-400 hover:text-red-500">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {/* Monthly breakdown row */}
                              {isExpanded && (() => {
                                const monthly = getMemberMonthlyBreakdown(m.member_id);
                                return (
                                  <tr>
                                    <td colSpan={colCount} className="px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50">
                                      {monthly.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-2">No payments recorded yet</p>
                                      ) : (
                                        <div className="space-y-1.5 pl-8">
                                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monthly Breakdown</p>
                                          {monthly.map(month => (
                                            <div key={month.label} className="flex items-center justify-between text-xs">
                                              <span className="text-gray-600 dark:text-gray-400">{month.label}</span>
                                              <div className="flex items-center gap-3">
                                                <span className="text-green-600 font-medium">{formatCurrency(month.total)}</span>
                                                <span className="text-gray-400">
                                                  {month.payments.length} payment{month.payments.length > 1 ? 's' : ''}
                                                  {' · '}
                                                  {month.payments.map(p => METHOD_LABELS[p.payment_method]).join(', ')}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-700">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
                                            <span className="font-bold text-green-600">{formatCurrency(m.paid)}</span>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {memberFundStatuses.length > 10 && (
                      <button
                        onClick={() => setShowAllMembers(!showAllMembers)}
                        className="w-full py-2 text-xs text-primary-500 hover:text-primary-600 font-medium"
                      >
                        {showAllMembers ? 'Show less' : `Show all ${memberFundStatuses.length} members`}
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Payments */}
              {payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-primary-500" />
                    Recent Payments
                    <Badge variant="info" size="sm">{payments.length}</Badge>
                  </h3>
                  <Card animate>
                    <CardContent className="p-0 divide-y divide-gray-100 dark:divide-gray-700">
                      {payments.slice(0, 15).map(payment => (
                        <div key={payment.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <div className="flex items-center gap-2">
                            {payment.member?.avatar_url ? (
                              <img src={payment.member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                <span className="text-xs text-gray-500">{payment.member?.name?.[0]}</span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{payment.member?.name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span>{formatDate(payment.date)}</span>
                                <Badge variant="info" size="sm">{METHOD_LABELS[payment.payment_method]}</Badge>
                                {payment.description && <span>· {payment.description}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-green-600">+{formatCurrency(Number(payment.amount))}</span>
                            {isAdmin && (
                              <button onClick={() => setDeleteConfirm({ type: 'payment', id: payment.id, name: `${payment.member?.name} — ${formatCurrency(Number(payment.amount))}` })} className="p-1 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== MODALS ===== */}

      {/* Season Modal */}
      <Modal isOpen={showSeasonModal} onClose={() => { setShowSeasonModal(false); setEditingSeason(null); }} title={editingSeason ? 'Edit Season' : 'Create Season'}>
        <div className="space-y-4">
          {/* Preset selector (only for new seasons) */}
          {!editingSeason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quick Setup</label>
              <div className="flex gap-2">
                {(Object.keys(SEASON_PRESETS) as PresetKey[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(key);
                      const p = SEASON_PRESETS[key];
                      setSeasonForm(f => ({
                        ...f,
                        name: p.name || f.name,
                        start_date: p.start_date || f.start_date,
                        end_date: p.end_date || f.end_date,
                        days: [...p.days],
                        weekday_cost: p.weekday_cost,
                        weekend_cost: p.weekend_cost,
                      }));
                    }}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectedPreset === key
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {SEASON_PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input label="Season Name" value={seasonForm.name} onChange={(e) => setSeasonForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label="Start Date" value={seasonForm.start_date} onChange={(e) => setSeasonForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" label="End Date" value={seasonForm.end_date} onChange={(e) => setSeasonForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>

          {/* Day selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Booking Days</label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((day, idx) => {
                const isSelected = seasonForm.days.includes(idx);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setSeasonForm(f => ({
                        ...f,
                        days: isSelected ? f.days.filter(d => d !== idx) : [...f.days, idx].sort(),
                      }));
                      setSelectedPreset('custom');
                    }}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cost fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Weekday Cost (₹)" value={String(seasonForm.weekday_cost)} onChange={(e) => setSeasonForm(f => ({ ...f, weekday_cost: Number(e.target.value) || 0 }))} />
            <Input type="number" label="Weekend Cost (₹)" value={String(seasonForm.weekend_cost)} onChange={(e) => setSeasonForm(f => ({ ...f, weekend_cost: Number(e.target.value) || 0 }))} />
          </div>

          <Input type="number" label="Estimated Budget (₹)" placeholder="Optional" value={seasonForm.total_budget} onChange={(e) => setSeasonForm(f => ({ ...f, total_budget: e.target.value }))} />
          {editingSeason && (
            <Select label="Status" value={seasonForm.status} onChange={(e) => setSeasonForm(f => ({ ...f, status: e.target.value as Season['status'] }))} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }]} />
          )}

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{GROUND_NAME} · {TIME_SLOT}</p>
            <p>{seasonForm.days.map(d => DAY_NAMES[d]).join(', ')} — Weekday ₹{seasonForm.weekday_cost.toLocaleString()} | Weekend ₹{seasonForm.weekend_cost.toLocaleString()}</p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowSeasonModal(false); setEditingSeason(null); }} className="flex-1" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={editingSeason ? handleUpdateSeason : handleCreateSeason} className="flex-1" disabled={isSubmitting || !seasonForm.name || !seasonForm.start_date || !seasonForm.end_date || seasonForm.days.length === 0}>
              {isSubmitting ? 'Saving...' : editingSeason ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal isOpen={showEditBookingModal} onClose={() => { setShowEditBookingModal(false); setEditingBooking(null); }} title={editingBooking ? `Edit — ${formatDate(editingBooking.date)}` : 'Edit Booking'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Cost (₹)" value={bookingEditForm.cost} onChange={(e) => setBookingEditForm(f => ({ ...f, cost: e.target.value }))} />
            <Input type="number" label="Opponent Collection (₹)" placeholder="0" value={bookingEditForm.opponent_collection} onChange={(e) => setBookingEditForm(f => ({ ...f, opponent_collection: e.target.value }))} />
          </div>
          <Input label="Opponent Team Name" placeholder="e.g. Chennai Warriors, Internal Match" value={bookingEditForm.opponent_name} onChange={(e) => setBookingEditForm(f => ({ ...f, opponent_name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" value={bookingEditForm.status} onChange={(e) => setBookingEditForm(f => ({ ...f, status: e.target.value as GroundBooking['status'] }))} options={[{ value: 'booked', label: 'Booked' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} />
            <Select label="Payment" value={bookingEditForm.payment_status} onChange={(e) => setBookingEditForm(f => ({ ...f, payment_status: e.target.value as GroundBooking['payment_status'] }))} options={[{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }]} />
          </div>
          <TextArea label="Notes" placeholder="e.g. External match, cancelled due to rain" value={bookingEditForm.notes} onChange={(e) => setBookingEditForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowEditBookingModal(false); setEditingBooking(null); }} className="flex-1" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSaveBookingEdit} className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment">
        <div className="space-y-4">
          <Select
            label="Member"
            value={paymentForm.member_id}
            onChange={(e) => setPaymentForm(f => ({ ...f, member_id: e.target.value }))}
            options={[
              { value: '', label: 'Select member' },
              ...(selectedSeason?.targets?.length
                ? selectedSeason.targets.filter(t => t.member).map(t => ({ value: t.member_id, label: t.member!.name }))
                : members.filter(m => m.status === 'active').map(m => ({ value: m.id, label: m.name }))
              ),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Amount (₹)" placeholder="0" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
            <Input type="date" label="Date" value={paymentForm.date} onChange={(e) => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <Select label="Payment Method" value={paymentForm.payment_method} onChange={(e) => setPaymentForm(f => ({ ...f, payment_method: e.target.value as FundPaymentMethod }))} options={[{ value: 'cash', label: 'Cash' }, { value: 'online', label: 'Online' }, { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'other', label: 'Other' }]} />
          <Input label="Description" placeholder="e.g. Oct-Nov advance" value={paymentForm.description} onChange={(e) => setPaymentForm(f => ({ ...f, description: e.target.value }))} />

          {/* Show member status */}
          {paymentForm.member_id && selectedSeasonId && (() => {
            const status = getMemberFundStatus(selectedSeasonId, paymentForm.member_id);
            if (status.target > 0) {
              return (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Target: {formatCurrency(status.target)}</span>
                    <span className="text-green-600">Paid: {formatCurrency(status.paid)}</span>
                    <span className="text-red-600">Due: {formatCurrency(Math.max(0, status.outstanding))}</span>
                  </div>
                  {renderProgressBar(status.paid, status.target, status.paid >= status.target ? 'bg-green-500' : 'bg-amber-500')}
                </div>
              );
            }
            return null;
          })()}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)} className="flex-1" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleAddPayment} className="flex-1" disabled={isSubmitting || !paymentForm.member_id || !paymentForm.amount || Number(paymentForm.amount) <= 0}>
              {isSubmitting ? 'Saving...' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Set Targets Modal */}
      <Modal isOpen={showTargetModal} onClose={() => setShowTargetModal(false)} title="Set Member Targets" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tier" value={targetTier} onChange={(e) => setTargetTier(e.target.value as MemberTier)} options={[{ value: 'regular', label: 'Regular' }, { value: 'occasional', label: 'Occasional' }, { value: 'other', label: 'Other' }]} />
            <Input type="number" label="Target Amount (₹)" placeholder="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Members</label>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-primary-500 hover:text-primary-600" onClick={() => {
                  const existingIds = new Set(selectedSeason?.targets?.map(t => t.member_id) || []);
                  setSelectedMemberIds(members.filter(m => m.status === 'active' && !existingIds.has(m.id)).map(m => m.id));
                }}>Select All New</button>
                <button type="button" className="text-xs text-gray-400 hover:text-gray-500" onClick={() => setSelectedMemberIds([])}>Clear</button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
              {members.filter(m => m.status === 'active').map(member => {
                const hasTarget = selectedSeason?.targets?.some(t => t.member_id === member.id);
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <label key={member.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                    <input type="checkbox" checked={isSelected} onChange={(e) => {
                      if (e.target.checked) setSelectedMemberIds(prev => [...prev, member.id]);
                      else setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                    }} className="rounded border-gray-300" />
                    <div className="flex items-center gap-2 flex-1">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-xs">{member.name[0]}</span>
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-300">{member.name}</span>
                    </div>
                    {hasTarget && <Badge variant="info" size="sm">Has target</Badge>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">{selectedMemberIds.length} selected</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowTargetModal(false)} className="flex-1" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSetTargets} className="flex-1" disabled={isSubmitting || selectedMemberIds.length === 0 || !targetAmount}>
              {isSubmitting ? 'Saving...' : `Set for ${selectedMemberIds.length} Members`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            {deleteConfirm?.type === 'season' && ' This will also delete all bookings, targets, and payments.'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1" disabled={isDeleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
