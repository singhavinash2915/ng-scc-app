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
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Handshake,
  MapPin,
  Lock,
  BarChart2,
  Wallet,
  Building2,
  AlertCircle,
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

type TabType = 'bookings' | 'overview' | 'members';

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
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const PAYMENTS_PER_PAGE = 10;

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
    sponsor_income: 0,
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
    if (selectedSeasonId) {
      fetchPayments(selectedSeasonId);
      setPaymentsPage(0);
    }
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

  // Sorted by paid desc for contribution wall (only members who paid > 0)
  const contributionsSorted = useMemo(() =>
    [...memberFundStatuses].sort((a, b) => b.paid - a.paid),
  [memberFundStatuses]);

  // Contribution tier helper
  function getContributorTier(paid: number) {
    if (paid >= 20000) return {
      label: 'Champion', icon: '🏆',
      card: 'border-amber-300 dark:border-amber-600 bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800',
      badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      amount: 'text-amber-600 dark:text-amber-400',
    };
    if (paid >= 10000) return {
      label: 'Star', icon: '⭐',
      card: 'border-blue-200 dark:border-blue-700 bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800',
      badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      amount: 'text-blue-600 dark:text-blue-400',
    };
    if (paid >= 5000) return {
      label: 'Core', icon: '🎯',
      card: 'border-green-200 dark:border-green-700 bg-gradient-to-b from-green-50 to-white dark:from-green-900/10 dark:to-gray-800',
      badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      amount: 'text-green-600 dark:text-green-400',
    };
    return {
      label: 'Supporter', icon: '🤝',
      card: 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800',
      badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
      amount: 'text-gray-700 dark:text-gray-300',
    };
  }

  // ─── Season Finance overview stats ────────────────────────────────────────
  const overviewStats = useMemo(() => {
    if (!selectedSeason) return null;

    const bookings = selectedSeason.bookings?.filter(b => b.status !== 'cancelled') || [];

    // Income
    const memberIncome   = payments.reduce((s, p) => s + Number(p.amount), 0);
    const opponentIncome = bookings.reduce((s, b) => s + Number(b.opponent_collection || 0), 0);
    let sponsorIncome = 0;
    try {
      const parsed = selectedSeason.notes ? JSON.parse(selectedSeason.notes) : null;
      if (parsed?.sponsor_income) sponsorIncome = Number(parsed.sponsor_income) || 0;
    } catch { /* notes not JSON */ }
    const totalIncome = memberIncome + opponentIncome + sponsorIncome;

    // Expenses
    const totalGroundCost   = bookings.reduce((s, b) => s + Number(b.cost), 0);
    const paidToGround      = bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.cost), 0);
    const pendingToGround   = totalGroundCost - paidToGround;

    // Balance
    const netBalance        = totalIncome - totalGroundCost;

    // Session stats
    const totalSessions     = bookings.length;
    const paidSessions      = bookings.filter(b => b.payment_status === 'paid').length;
    const matchesVsOpponent = bookings.filter(b => Number(b.opponent_collection) > 0).length;
    const avgCost           = totalSessions > 0 ? totalGroundCost / totalSessions : 0;
    const avgNetCost        = totalSessions > 0 ? (totalGroundCost - opponentIncome) / totalSessions : 0;

    // Member stats
    const memberTarget      = selectedSeason.targets?.reduce((s, t) => s + Number(t.target_amount), 0) || 0;
    const membersPaidCount  = new Set(payments.map(p => p.member_id)).size;
    const totalMembersCount = selectedSeason.targets?.length || 0;
    const memberOutstanding = Math.max(0, memberTarget - memberIncome);

    // Per-member net cost
    const perMemberCost     = totalMembersCount > 0 ? (totalGroundCost - opponentIncome - sponsorIncome) / totalMembersCount : 0;

    // Proportions
    const memberPct   = totalIncome > 0 ? (memberIncome / totalIncome) * 100 : 0;
    const opponentPct = totalIncome > 0 ? (opponentIncome / totalIncome) * 100 : 0;
    const sponsorPct  = totalIncome > 0 ? (sponsorIncome / totalIncome) * 100 : 0;

    return {
      memberIncome, opponentIncome, sponsorIncome, totalIncome,
      totalGroundCost, paidToGround, pendingToGround, netBalance,
      totalSessions, paidSessions, matchesVsOpponent, avgCost, avgNetCost,
      memberTarget, membersPaidCount, totalMembersCount, memberOutstanding,
      perMemberCost, memberPct, opponentPct, sponsorPct,
    };
  }, [selectedSeason, payments]);

  // ---- Handlers ----
  const handleCreateSeason = async () => {
    setIsSubmitting(true);
    try {
      const configJson = JSON.stringify({
        days: seasonForm.days,
        weekday_cost: seasonForm.weekday_cost,
        weekend_cost: seasonForm.weekend_cost,
        sponsor_income: seasonForm.sponsor_income || 0,
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
      // Preserve existing config, update sponsor_income
      let existingConfig: Record<string, unknown> = {};
      try { existingConfig = editingSeason.notes ? JSON.parse(editingSeason.notes) : {}; } catch { /* */ }
      const updatedNotes = JSON.stringify({
        ...existingConfig,
        days: seasonForm.days,
        weekday_cost: seasonForm.weekday_cost,
        weekend_cost: seasonForm.weekend_cost,
        sponsor_income: seasonForm.sponsor_income || 0,
      });
      await updateSeason(editingSeason.id, {
        name: seasonForm.name,
        start_date: seasonForm.start_date,
        end_date: seasonForm.end_date,
        total_budget: Number(seasonForm.total_budget) || 0,
        status: seasonForm.status,
        notes: updatedNotes,
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
    let days = [2, 4, 6];
    let weekday_cost = 5500;
    let weekend_cost = 7500;
    let sponsor_income = 0;
    try {
      const parsed = season.notes ? JSON.parse(season.notes) : null;
      if (parsed?.days) days = parsed.days;
      if (parsed?.weekday_cost) weekday_cost = parsed.weekday_cost;
      if (parsed?.weekend_cost) weekend_cost = parsed.weekend_cost;
      if (parsed?.sponsor_income) sponsor_income = Number(parsed.sponsor_income) || 0;
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
      sponsor_income,
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
                  setSeasonForm({ name: preset.name, start_date: preset.start_date, end_date: preset.end_date, total_budget: '', status: 'active', notes: '', days: [...preset.days], weekday_cost: preset.weekday_cost, weekend_cost: preset.weekend_cost, sponsor_income: 0 });
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
  // Show Member Contributions only for upcoming/future seasons (not past ones)
  const isSeasonCurrent = selectedSeason ? (
    (selectedSeason.status === 'active' || selectedSeason.status === 'upcoming') &&
    new Date(selectedSeason.end_date) >= new Date()
  ) : false;
  const tabs: { key: TabType; label: string; icon: typeof Calendar }[] = [
    { key: 'bookings', label: 'Ground Bookings', icon: Calendar },
    { key: 'overview', label: 'Season Finance', icon: BarChart2 },
    ...(isSeasonCurrent ? [{ key: 'members' as TabType, label: 'Contributions', icon: Users }] : []),
  ];

  return (
    <div>
      <Header title="Ground Booking" subtitle={`${GROUND_NAME} — ${TIME_SLOT}`} />

      {/* Season Selector + Add New */}
      <div className="flex items-center gap-3 mb-4">
        {seasons.length > 1 && (
          <Select
            value={selectedSeasonId}
            onChange={(e) => { setSelectedSeasonId(e.target.value); setActiveTab('bookings'); }}
            className="!w-auto min-w-[200px]"
            options={seasons.map(s => ({ value: s.id, label: `${s.name}${s.status === 'active' ? ' (Active)' : ''}` }))}
          />
        )}
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => {
            setEditingSeason(null);
            const preset = SEASON_PRESETS['oct-may'];
            setSelectedPreset('oct-may');
            setSeasonForm({ name: preset.name, start_date: preset.start_date, end_date: preset.end_date, total_budget: '', status: 'active', notes: '', days: [...preset.days], weekday_cost: preset.weekday_cost, weekend_cost: preset.weekend_cost, sponsor_income: 0 });
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

          {/* ===== OVERVIEW / SEASON FINANCE TAB ===== */}
          {activeTab === 'overview' && overviewStats && (
            <div className="space-y-4">

              {/* ── 1. Income Breakdown ─────────────────────────────────── */}
              <Card animate>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="w-4 h-4 text-green-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Income Breakdown</h3>
                  </div>

                  {/* Total income hero */}
                  <div className="flex items-end gap-2 mb-5">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(overviewStats.totalIncome)}</span>
                    <span className="text-sm text-gray-400 mb-1">total collected</span>
                  </div>

                  {/* Stacked bar */}
                  {overviewStats.totalIncome > 0 && (
                    <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
                      {overviewStats.memberIncome > 0 && (
                        <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${overviewStats.memberPct}%` }} title={`Members ${Math.round(overviewStats.memberPct)}%`} />
                      )}
                      {overviewStats.opponentIncome > 0 && (
                        <div className="bg-blue-500 transition-all" style={{ width: `${overviewStats.opponentPct}%` }} title={`Opponents ${Math.round(overviewStats.opponentPct)}%`} />
                      )}
                      {overviewStats.sponsorIncome > 0 && (
                        <div className="bg-purple-500 rounded-r-full transition-all" style={{ width: `${overviewStats.sponsorPct}%` }} title={`Sponsors ${Math.round(overviewStats.sponsorPct)}%`} />
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Member contributions */}
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Contributions</span>
                            {overviewStats.totalMembersCount > 0 && (
                              <span className="ml-2 text-xs text-gray-400">
                                {overviewStats.membersPaidCount}/{overviewStats.totalMembersCount} members paid
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-green-600 ml-2">{formatCurrency(overviewStats.memberIncome)}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${overviewStats.memberTarget > 0 ? Math.min((overviewStats.memberIncome / overviewStats.memberTarget) * 100, 100) : 100}%` }} />
                        </div>
                        {overviewStats.memberTarget > 0 && (
                          <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                            <span>Target: {formatCurrency(overviewStats.memberTarget)}</span>
                            <span>{Math.round((overviewStats.memberIncome / overviewStats.memberTarget) * 100)}% collected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Opponent collection */}
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Opponent Fees</span>
                            <span className="ml-2 text-xs text-gray-400">{overviewStats.matchesVsOpponent} match{overviewStats.matchesVsOpponent !== 1 ? 'es' : ''} collected</span>
                          </div>
                          <span className="text-sm font-bold text-blue-600 ml-2">{formatCurrency(overviewStats.opponentIncome)}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${overviewStats.totalIncome > 0 ? overviewStats.opponentPct : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Saves ≈ {formatCurrency(Math.round(overviewStats.opponentIncome / Math.max(overviewStats.totalMembersCount, 1)))} per member</p>
                      </div>
                    </div>

                    {/* Sponsor income */}
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${overviewStats.sponsorIncome > 0 ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sponsor / Other</span>
                            {overviewStats.sponsorIncome === 0 && isAdmin && (
                              <span className="ml-2 text-xs text-primary-500 cursor-pointer hover:underline" onClick={() => openEditSeason(selectedSeason!)}>+ Add via Edit Season</span>
                            )}
                          </div>
                          <span className={`text-sm font-bold ml-2 ${overviewStats.sponsorIncome > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                            {formatCurrency(overviewStats.sponsorIncome)}
                          </span>
                        </div>
                        {overviewStats.sponsorIncome > 0 && (
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${overviewStats.sponsorPct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {overviewStats.memberOutstanding > 0 && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>{formatCurrency(overviewStats.memberOutstanding)}</strong> still outstanding from member contributions
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── 2. Expense Breakdown ────────────────────────────────── */}
              <Card animate delay={1}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-orange-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Ground Expenses</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Paid to owner</p>
                      <p className="text-sm font-bold text-orange-500">{formatCurrency(overviewStats.paidToGround)} / {formatCurrency(overviewStats.totalGroundCost)}</p>
                    </div>
                  </div>

                  {/* Overall paid progress */}
                  <div className="mb-1">{renderProgressBar(overviewStats.paidToGround, overviewStats.totalGroundCost, 'bg-orange-500')}</div>
                  <div className="flex justify-between text-xs text-gray-400 mb-5">
                    <span>{overviewStats.paidSessions}/{overviewStats.totalSessions} sessions paid</span>
                    {overviewStats.pendingToGround > 0 && (
                      <span className="text-amber-500">{formatCurrency(overviewStats.pendingToGround)} pending</span>
                    )}
                  </div>

                  {/* Month-wise breakdown */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Breakdown</p>
                    {bookingsByMonth.map(group => {
                      const allPaid = group.paidCount === group.bookings.length;
                      const nonePaid = group.paidCount === 0;
                      const netCost = group.totalCost - group.totalOpponent;
                      return (
                        <div key={group.key} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                          <div className="w-10 flex-shrink-0">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{group.label.split(' ')[0]}</p>
                            <p className="text-xs text-gray-400">{group.label.split(' ')[1]}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-gray-500">{group.bookings.length} sessions</span>
                              {allPaid ? (
                                <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><CheckCircle className="w-3 h-3" /> All paid</span>
                              ) : nonePaid ? (
                                <span className="text-xs text-gray-400">Not yet paid</span>
                              ) : (
                                <span className="text-xs text-amber-500">{group.paidCount}/{group.bookings.length} paid</span>
                              )}
                            </div>
                            {renderProgressBar(group.paidCount, group.bookings.length, allPaid ? 'bg-green-500' : 'bg-orange-400')}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(group.totalCost)}</p>
                            {group.totalOpponent > 0 && (
                              <p className="text-xs text-blue-500">Net: {formatCurrency(netCost)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* ── 3. Season Balance ───────────────────────────────────── */}
              <Card animate delay={2}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    {overviewStats.netBalance >= 0
                      ? <TrendingUp className="w-4 h-4 text-green-500" />
                      : <TrendingDown className="w-4 h-4 text-red-500" />
                    }
                    <h3 className="font-semibold text-gray-900 dark:text-white">Season Balance</h3>
                  </div>

                  {/* Income vs Expense rows */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Income</span>
                      </div>
                      <span className="text-base font-bold text-green-600">{formatCurrency(overviewStats.totalIncome)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ground Cost</span>
                      </div>
                      <span className="text-base font-bold text-red-600">{formatCurrency(overviewStats.totalGroundCost)}</span>
                    </div>
                  </div>

                  {/* Net balance */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                    overviewStats.netBalance >= 0
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div>
                      <p className={`text-sm font-semibold ${overviewStats.netBalance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {overviewStats.netBalance >= 0 ? '🟢 Surplus' : '🔴 Deficit'}
                      </p>
                      {overviewStats.netBalance < 0 && overviewStats.totalMembersCount > 0 && (
                        <p className="text-xs text-red-500 mt-0.5">
                          ≈ {formatCurrency(Math.ceil(Math.abs(overviewStats.netBalance) / overviewStats.totalMembersCount))} per member still needed
                        </p>
                      )}
                      {overviewStats.netBalance >= 0 && (
                        <p className="text-xs text-green-600 mt-0.5">Season is fully funded ✓</p>
                      )}
                    </div>
                    <span className={`text-2xl font-black ${overviewStats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {overviewStats.netBalance >= 0 ? '+' : ''}{formatCurrency(overviewStats.netBalance)}
                    </span>
                  </div>

                  {/* Quick stats strip */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-0.5">Avg/Session</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Math.round(overviewStats.avgCost))}</p>
                    </div>
                    <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-0.5">Net/Session</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Math.round(overviewStats.avgNetCost))}</p>
                      <p className="text-xs text-blue-500">after opponents</p>
                    </div>
                    <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-0.5">Per Member</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Math.round(overviewStats.perMemberCost))}</p>
                      <p className="text-xs text-gray-400">net season cost</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── 4. Session Stats ────────────────────────────────────── */}
              <Card animate delay={3}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-primary-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Session Summary</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Sessions', value: overviewStats.totalSessions, sub: `${selectedSeason?.name}`, color: 'text-gray-900 dark:text-white' },
                      { label: 'Ground Paid', value: `${overviewStats.paidSessions}/${overviewStats.totalSessions}`, sub: `${overviewStats.totalSessions - overviewStats.paidSessions} pending`, color: overviewStats.paidSessions === overviewStats.totalSessions ? 'text-green-600' : 'text-amber-600' },
                      { label: 'Opponent Matches', value: overviewStats.matchesVsOpponent, sub: `${formatCurrency(overviewStats.opponentIncome)} saved`, color: 'text-blue-600' },
                      { label: 'Members Enrolled', value: `${overviewStats.membersPaidCount}/${overviewStats.totalMembersCount}`, sub: 'at least 1 payment', color: 'text-primary-600' },
                    ].map(item => (
                      <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                        <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {/* ===== MEMBERS TAB ===== */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Admin Actions */}
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

              {memberFundStatuses.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No member targets set</p>
                    {isAdmin && <p className="text-xs text-gray-400 mt-1">Click "Set Targets" to assign advance payment amounts</p>}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* ── Hero collection bar ─────────────────────────────── */}
                  {overviewStats && (
                    <div className="rounded-2xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 p-5 text-white shadow-lg">
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <p className="text-xs font-medium opacity-70 mb-1">Total Member Collection</p>
                          <p className="text-3xl font-black tracking-tight">{formatCurrency(overviewStats.memberIncome)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs opacity-70 mb-1">Target</p>
                          <p className="text-lg font-bold">{formatCurrency(overviewStats.memberTarget)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                        <div
                          className="bg-white h-3 rounded-full transition-all duration-700 shadow"
                          style={{ width: `${overviewStats.memberTarget > 0 ? Math.min((overviewStats.memberIncome / overviewStats.memberTarget) * 100, 100) : 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs opacity-80">
                        <span>{overviewStats.membersPaidCount} of {overviewStats.totalMembersCount} members contributed</span>
                        <span className="font-bold text-sm">
                          {overviewStats.memberTarget > 0
                            ? `${Math.round((overviewStats.memberIncome / overviewStats.memberTarget) * 100)}%`
                            : '—'}
                        </span>
                      </div>
                      {overviewStats.memberOutstanding > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{formatCurrency(overviewStats.memberOutstanding)} still outstanding</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tier legend ─────────────────────────────────────── */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { icon: '🏆', label: 'Champion', sub: '₹20k+', cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300' },
                      { icon: '⭐', label: 'Star',     sub: '₹10k+', cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300' },
                      { icon: '🎯', label: 'Core',     sub: '₹5k+',  cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300' },
                      { icon: '🤝', label: 'Supporter',sub: '< ₹5k', cls: 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300' },
                    ].map(t => (
                      <div key={t.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${t.cls}`}>
                        <span>{t.icon}</span>{t.label} <span className="opacity-60">{t.sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Contribution Wall ───────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {contributionsSorted.map((m, idx) => {
                      const tier  = getContributorTier(m.paid);
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                      const pct   = m.target > 0 ? Math.min((m.paid / m.target) * 100, 100) : 100;
                      const monthly = getMemberMonthlyBreakdown(m.member_id);
                      const paymentCount = payments.filter(p => p.member_id === m.member_id).length;
                      const isExpanded = expandedMemberId === m.member_id;

                      return (
                        <div
                          key={m.member_id}
                          onClick={() => setExpandedMemberId(isExpanded ? null : m.member_id)}
                          className={`relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${tier.card} ${isExpanded ? 'ring-2 ring-primary-400 ring-offset-1' : ''} ${idx < 3 ? 'sm:p-5' : ''}`}
                        >
                          {/* Medal badge */}
                          {medal && (
                            <div className="absolute -top-3 -right-1 text-xl drop-shadow">{medal}</div>
                          )}

                          {/* Avatar */}
                          <div className={`mx-auto mb-3 flex items-center justify-center rounded-full bg-white shadow ${idx < 3 ? 'w-14 h-14' : 'w-10 h-10'}`}>
                            {m.member?.avatar_url ? (
                              <img src={m.member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className={`font-bold text-primary-600 ${idx < 3 ? 'text-xl' : 'text-sm'}`}>
                                {m.member?.name?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Name */}
                          <p className="font-semibold text-gray-900 dark:text-white text-center text-sm leading-tight mb-1 truncate">
                            {m.member?.name?.split(' ')[0]}
                          </p>

                          {/* Amount */}
                          <p className={`text-center font-black mb-2 ${idx < 3 ? 'text-xl' : 'text-base'} ${tier.amount}`}>
                            {formatCurrency(m.paid)}
                          </p>

                          {/* Tier badge */}
                          <div className={`mx-auto w-fit text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${tier.badge}`}>
                            {tier.icon} {tier.label}
                          </div>

                          {/* Mini progress bar */}
                          {m.target > 0 && (
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-1">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}

                          {/* Status line */}
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            {m.outstanding <= 0
                              ? <span className="flex items-center gap-0.5 text-green-600 font-medium"><CheckCircle className="w-3 h-3" /> Fully paid</span>
                              : <span className="text-red-500">{formatCurrency(m.outstanding)} due</span>
                            }
                            {paymentCount > 1 && (
                              <span className="bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5 text-gray-500">{paymentCount}×</span>
                            )}
                          </div>

                          {/* Expanded: monthly breakdown */}
                          {isExpanded && monthly.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1.5">
                              {monthly.map(mo => (
                                <div key={mo.label} className="flex justify-between text-xs">
                                  <span className="text-gray-500">{mo.label}</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(mo.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {isExpanded && monthly.length === 0 && (
                            <p className="mt-2 text-xs text-center text-gray-400">No payments recorded</p>
                          )}

                          {/* Admin quick-add button */}
                          {isAdmin && (
                            <button
                              onClick={e => { e.stopPropagation(); setPaymentForm(p => ({ ...p, member_id: m.member_id })); setShowPaymentModal(true); }}
                              className="mt-3 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary-500 hover:border-primary-400 transition"
                            >
                              <Plus className="w-3 h-3" /> Add payment
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Members who haven't paid yet (admin only) ───────── */}
                  {isAdmin && memberFundStatuses.filter(m => m.paid === 0).length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                          Not Yet Contributed ({memberFundStatuses.filter(m => m.paid === 0).length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {memberFundStatuses.filter(m => m.paid === 0).map(m => (
                            <button
                              key={m.member_id}
                              onClick={() => { setPaymentForm(p => ({ ...p, member_id: m.member_id })); setShowPaymentModal(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition"
                            >
                              {m.member?.avatar_url
                                ? <img src={m.member.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                                : <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs">{m.member?.name?.[0]}</div>
                              }
                              {m.member?.name?.split(' ')[0]}
                              {m.target > 0 && <span className="text-gray-400">· {formatCurrency(m.target)}</span>}
                              <Plus className="w-3 h-3 ml-0.5" />
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
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
                      {payments.slice(paymentsPage * PAYMENTS_PER_PAGE, (paymentsPage + 1) * PAYMENTS_PER_PAGE).map(payment => (
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
                      {payments.length > PAYMENTS_PER_PAGE && (
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <button
                            onClick={() => setPaymentsPage(p => Math.max(0, p - 1))}
                            disabled={paymentsPage === 0}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            <ChevronDown className="w-3.5 h-3.5 rotate-90" /> Prev
                          </button>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {paymentsPage * PAYMENTS_PER_PAGE + 1}–{Math.min((paymentsPage + 1) * PAYMENTS_PER_PAGE, payments.length)} of {payments.length}
                          </span>
                          <button
                            onClick={() => setPaymentsPage(p => Math.min(Math.ceil(payments.length / PAYMENTS_PER_PAGE) - 1, p + 1))}
                            disabled={(paymentsPage + 1) * PAYMENTS_PER_PAGE >= payments.length}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            Next <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                          </button>
                        </div>
                      )}
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

          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Estimated Budget (₹)" placeholder="Optional" value={seasonForm.total_budget} onChange={(e) => setSeasonForm(f => ({ ...f, total_budget: e.target.value }))} />
            <Input type="number" label="Sponsor / Other Income (₹)" placeholder="0" value={seasonForm.sponsor_income ? String(seasonForm.sponsor_income) : ''} onChange={(e) => setSeasonForm(f => ({ ...f, sponsor_income: Number(e.target.value) || 0 }))} />
          </div>
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
              ...members
                .filter(m => m.status === 'active')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => ({ value: m.id, label: m.name })),
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
