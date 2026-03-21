import { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  MapPin,
  Clock,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Users,
  Target,
  CreditCard,
  Search,
  TrendingUp,
  Link2,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useSeasonFund } from '../hooks/useSeasonFund';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAuth } from '../context/AuthContext';
import type { Season, GroundBooking, MemberTier, FundPaymentMethod } from '../types';

type TabType = 'overview' | 'bookings' | 'members' | 'payments';

const TIER_LABELS: Record<MemberTier, string> = {
  regular: 'Regular',
  occasional: 'Occasional',
  other: 'Other',
};

const TIER_COLORS: Record<MemberTier, 'success' | 'warning' | 'info'> = {
  regular: 'success',
  occasional: 'warning',
  other: 'info',
};

const METHOD_LABELS: Record<FundPaymentMethod, string> = {
  cash: 'Cash',
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

export function SeasonFund() {
  const {
    seasons, payments, loading,
    addSeason, updateSeason, deleteSeason,
    addBooking, updateBooking, deleteBooking,
    setMemberTargets, removeMemberTarget,
    fetchPayments, addPayment, deletePayment,
    getSeasonStats, getMemberFundStatus, getVenueBreakdown,
  } = useSeasonFund();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  // Modals
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editingBooking, setEditingBooking] = useState<GroundBooking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [bookingVenueFilter, setBookingVenueFilter] = useState('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [memberTierFilter, setMemberTierFilter] = useState('all');

  // Delete confirmations
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Season form state
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    total_budget: '',
    status: 'upcoming' as Season['status'],
    notes: '',
  });

  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    venue: '',
    time_slot: '',
    cost: '',
    status: 'booked' as GroundBooking['status'],
    payment_status: 'pending' as GroundBooking['payment_status'],
    match_id: '',
    notes: '',
  });

  // Target form state
  const [targetTier, setTargetTier] = useState<MemberTier>('regular');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as FundPaymentMethod,
    description: '',
  });

  // Select first season on load
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      const active = seasons.find(s => s.status === 'active');
      setSelectedSeasonId(active?.id || seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  // Fetch payments when season changes
  useEffect(() => {
    if (selectedSeasonId) {
      fetchPayments(selectedSeasonId);
    }
  }, [selectedSeasonId, fetchPayments]);

  const selectedSeason = useMemo(() =>
    seasons.find(s => s.id === selectedSeasonId) || null
  , [seasons, selectedSeasonId]);

  const stats = useMemo(() =>
    selectedSeason ? getSeasonStats(selectedSeason) : null
  , [selectedSeason, getSeasonStats]);

  const venueBreakdown = useMemo(() =>
    selectedSeason ? getVenueBreakdown(selectedSeason) : []
  , [selectedSeason, getVenueBreakdown]);

  // Unique venues from bookings
  const venues = useMemo(() => {
    if (!selectedSeason?.bookings) return [];
    return [...new Set(selectedSeason.bookings.map(b => b.venue))];
  }, [selectedSeason]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    if (!selectedSeason?.bookings) return [];
    return selectedSeason.bookings
      .filter(b => bookingVenueFilter === 'all' || b.venue === bookingVenueFilter)
      .filter(b => bookingStatusFilter === 'all' || b.status === bookingStatusFilter || b.payment_status === bookingStatusFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedSeason, bookingVenueFilter, bookingStatusFilter]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter(p => !paymentSearch || p.member?.name?.toLowerCase().includes(paymentSearch.toLowerCase()))
      .filter(p => paymentMethodFilter === 'all' || p.payment_method === paymentMethodFilter);
  }, [payments, paymentSearch, paymentMethodFilter]);

  // Member targets with payment status
  const memberFundStatuses = useMemo(() => {
    if (!selectedSeason?.targets) return [];
    return selectedSeason.targets
      .filter(t => memberTierFilter === 'all' || t.tier === memberTierFilter)
      .map(t => ({
        ...t,
        ...getMemberFundStatus(selectedSeasonId, t.member_id),
      }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [selectedSeason, selectedSeasonId, getMemberFundStatus, memberTierFilter]);

  // Unlinked matches (not already linked to a booking)
  const linkedMatchIds = useMemo(() => {
    if (!selectedSeason?.bookings) return new Set<string>();
    return new Set(selectedSeason.bookings.map(b => b.match_id).filter(Boolean) as string[]);
  }, [selectedSeason]);

  const availableMatches = useMemo(() => {
    return matches.filter(m => !linkedMatchIds.has(m.id));
  }, [matches, linkedMatchIds]);

  // ---- Handlers ----
  const handleAddSeason = async () => {
    setIsSubmitting(true);
    try {
      await addSeason({
        name: seasonForm.name,
        start_date: seasonForm.start_date,
        end_date: seasonForm.end_date,
        total_budget: Number(seasonForm.total_budget) || 0,
        status: seasonForm.status,
        notes: seasonForm.notes || null,
      });
      setShowSeasonModal(false);
      resetSeasonForm();
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
      resetSeasonForm();
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBooking = async () => {
    if (!selectedSeasonId) return;
    setIsSubmitting(true);
    try {
      await addBooking({
        season_id: selectedSeasonId,
        date: bookingForm.date,
        venue: bookingForm.venue,
        time_slot: bookingForm.time_slot || null,
        cost: Number(bookingForm.cost) || 0,
        status: bookingForm.status,
        payment_status: bookingForm.payment_status,
        match_id: bookingForm.match_id || null,
        notes: bookingForm.notes || null,
      });
      setShowBookingModal(false);
      resetBookingForm();
    } catch { /* ignore */ } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBooking = async () => {
    if (!editingBooking) return;
    setIsSubmitting(true);
    try {
      await updateBooking(editingBooking.id, {
        date: bookingForm.date,
        venue: bookingForm.venue,
        time_slot: bookingForm.time_slot || null,
        cost: Number(bookingForm.cost) || 0,
        status: bookingForm.status,
        payment_status: bookingForm.payment_status,
        match_id: bookingForm.match_id || null,
        notes: bookingForm.notes || null,
      });
      setShowBookingModal(false);
      setEditingBooking(null);
      resetBookingForm();
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
      setTargetAmount('');
      setSelectedMemberIds([]);
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
      resetPaymentForm();
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

  const openEditSeason = (season: Season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      total_budget: String(season.total_budget),
      status: season.status,
      notes: season.notes || '',
    });
    setShowSeasonModal(true);
  };

  const openEditBooking = (booking: GroundBooking) => {
    setEditingBooking(booking);
    setBookingForm({
      date: booking.date,
      venue: booking.venue,
      time_slot: booking.time_slot || '',
      cost: String(booking.cost),
      status: booking.status,
      payment_status: booking.payment_status,
      match_id: booking.match_id || '',
      notes: booking.notes || '',
    });
    setShowBookingModal(true);
  };

  const openQuickPayment = (memberId: string) => {
    setPaymentForm(prev => ({ ...prev, member_id: memberId }));
    setShowPaymentModal(true);
  };

  const resetSeasonForm = () => {
    setSeasonForm({ name: '', start_date: '', end_date: '', total_budget: '', status: 'upcoming', notes: '' });
    setEditingSeason(null);
  };

  const resetBookingForm = () => {
    setBookingForm({ date: new Date().toISOString().split('T')[0], venue: '', time_slot: '', cost: '', status: 'booked', payment_status: 'pending', match_id: '', notes: '' });
    setEditingBooking(null);
  };

  const resetPaymentForm = () => {
    setPaymentForm({ member_id: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: 'cash', description: '' });
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const tabs: { key: TabType; label: string; icon: typeof Landmark }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'bookings', label: 'Bookings', icon: MapPin },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'payments', label: 'Payments', icon: CreditCard },
  ];

  // Admin-only page
  if (!isAdmin) {
    return (
      <div>
        <Header title="Season Fund" subtitle="Ground booking & advance payments" />
        <div className="max-w-lg mx-auto mt-12">
          <Card animate>
            <CardContent className="text-center py-12">
              <Landmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Admin Access Required</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Please login as admin to access Season Fund management.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <Header title="Season Fund" subtitle="Ground booking & advance payments" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </div>
    );
  }

  // Empty state - no seasons
  if (seasons.length === 0) {
    return (
      <div>
        <Header title="Season Fund" subtitle="Ground booking & advance payments" />
        <div className="max-w-lg mx-auto mt-12">
          <Card animate>
            <CardContent className="text-center py-12">
              <Landmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Season Created</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Create a season to start tracking ground bookings and member advance payments.
              </p>
              {isAdmin && (
                <Button onClick={() => { resetSeasonForm(); setShowSeasonModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Season
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
        {renderSeasonModal()}
      </div>
    );
  }

  function renderProgressBar(value: number, max: number, color: string = 'bg-primary-500') {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  function renderOverviewTab() {
    if (!selectedSeason || !stats) return null;

    return (
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card animate delay={0}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Target</p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalTarget)}</p>
            </CardContent>
          </Card>
          <Card animate delay={1}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Collected</p>
              </div>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalCollected)}</p>
            </CardContent>
          </Card>
          <Card animate delay={2}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Spent on Grounds</p>
              </div>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.totalSpent)}</p>
            </CardContent>
          </Card>
          <Card animate delay={3}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding</p>
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(Math.max(0, stats.outstanding))}</p>
            </CardContent>
          </Card>
        </div>

        {/* Collection Progress */}
        <Card animate delay={4}>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Collection Progress</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(stats.totalCollected)} / {formatCurrency(stats.totalTarget)}
              </p>
            </div>
            {renderProgressBar(stats.totalCollected, stats.totalTarget, 'bg-green-500')}
            <p className="text-xs text-gray-400 mt-1">
              {stats.totalTarget > 0 ? Math.round((stats.totalCollected / stats.totalTarget) * 100) : 0}% collected
            </p>
          </CardContent>
        </Card>

        {/* Ground Payment Status */}
        <Card animate delay={5}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Ground Owner Payments</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.bookingCount}</p>
                <p className="text-xs text-gray-500">Total Bookings</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{stats.paidBookingCount}</p>
                <p className="text-xs text-gray-500">Paid</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{stats.pendingBookingCount}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
            {stats.groundOwnerPending > 0 && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                {formatCurrency(stats.groundOwnerPending)} pending to ground owners
              </p>
            )}
          </CardContent>
        </Card>

        {/* Venue Breakdown */}
        {venueBreakdown.length > 0 && (
          <Card animate delay={6}>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Venue-wise Spending</h3>
              <div className="space-y-3">
                {venueBreakdown.map(v => (
                  <div key={v.venue}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{v.venue}</span>
                        <span className="text-xs text-gray-400">({v.count} sessions)</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(v.totalCost)}</span>
                    </div>
                    {renderProgressBar(v.paid, v.totalCost, 'bg-green-500')}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Outstanding Members */}
        {memberFundStatuses.length > 0 && (
          <Card animate delay={7}>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Members with Outstanding Dues</h3>
              <div className="space-y-2">
                {memberFundStatuses
                  .filter(m => m.outstanding > 0)
                  .slice(0, 5)
                  .map(m => (
                    <div key={m.member_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.member?.avatar_url ? (
                          <img src={m.member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-xs text-gray-500">{m.member?.name?.[0]}</span>
                          </div>
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300">{m.member?.name}</span>
                      </div>
                      <span className="text-sm font-medium text-red-600">{formatCurrency(m.outstanding)}</span>
                    </div>
                  ))}
                {memberFundStatuses.filter(m => m.outstanding > 0).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">All members are up to date!</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderBookingsTab() {
    return (
      <div className="space-y-4">
        {/* Actions & Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {isAdmin && (
            <Button size="sm" onClick={() => { resetBookingForm(); setShowBookingModal(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Booking
            </Button>
          )}
          {venues.length > 0 && (
            <Select
              value={bookingVenueFilter}
              onChange={(e) => setBookingVenueFilter(e.target.value)}
              className="!w-auto"
              options={[{ value: 'all', label: 'All Venues' }, ...venues.map(v => ({ value: v, label: v }))]}
            />
          )}
          <Select
            value={bookingStatusFilter}
            onChange={(e) => setBookingStatusFilter(e.target.value)}
            className="!w-auto"
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'booked', label: 'Booked' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending Payment' },
            ]}
          />
        </div>

        {/* Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.bookingCount}</p>
              <p className="text-xs text-gray-500">Bookings</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.groundOwnerPaid)}</p>
              <p className="text-xs text-gray-500">Paid</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{formatCurrency(stats.groundOwnerPending)}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </CardContent></Card>
          </div>
        )}

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">No bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map(booking => (
              <Card key={booking.id} animate>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(booking.date)}</span>
                        <Badge variant={booking.status === 'completed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'info'} size="sm">
                          {booking.status}
                        </Badge>
                        <Badge variant={booking.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                          {booking.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {booking.venue}</span>
                        {booking.time_slot && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {booking.time_slot}</span>}
                        <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> {formatCurrency(Number(booking.cost))}</span>
                      </div>
                      {booking.match && (
                        <p className="text-xs text-primary-500 mt-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Linked: vs {booking.match.opponent || 'Internal'} ({formatDate(booking.match.date)})
                        </p>
                      )}
                      {booking.notes && <p className="text-xs text-gray-400 mt-1">{booking.notes}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 ml-2">
                        {booking.payment_status === 'pending' && (
                          <Button size="sm" variant="success" onClick={() => updateBooking(booking.id, { payment_status: 'paid' })}>
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditBooking(booking)}>
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ type: 'booking', id: booking.id, name: `${booking.venue} on ${formatDate(booking.date)}` })}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderMembersTab() {
    return (
      <div className="space-y-4">
        {/* Actions & Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {isAdmin && (
            <Button size="sm" onClick={() => { setSelectedMemberIds([]); setTargetAmount(''); setShowTargetModal(true); }}>
              <Target className="w-4 h-4 mr-1" /> Set Targets
            </Button>
          )}
          <Select
            value={memberTierFilter}
            onChange={(e) => setMemberTierFilter(e.target.value)}
            className="!w-auto"
            options={[
              { value: 'all', label: 'All Tiers' },
              { value: 'regular', label: 'Regular' },
              { value: 'occasional', label: 'Occasional' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>

        {/* Summary Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedSeason?.targets?.length || 0}</p>
              <p className="text-xs text-gray-500">Members</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalCollected)}</p>
              <p className="text-xs text-gray-500">Collected</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-red-600">{formatCurrency(Math.max(0, stats.outstanding))}</p>
              <p className="text-xs text-gray-500">Outstanding</p>
            </CardContent></Card>
          </div>
        )}

        {/* Member Fund Status List */}
        {memberFundStatuses.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">No member targets set yet</p>
              {isAdmin && <p className="text-xs text-gray-400 mt-1">Click "Set Targets" to assign amounts</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {memberFundStatuses.map(m => {
              const pct = m.target > 0 ? Math.round((m.paid / m.target) * 100) : 0;
              const statusColor = pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-red-600';
              const barColor = pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-500';

              return (
                <Card key={m.member_id} animate>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {m.member?.avatar_url ? (
                          <img src={m.member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm text-gray-500">{m.member?.name?.[0]}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{m.member?.name}</p>
                          <Badge variant={TIER_COLORS[m.tier]} size="sm">{TIER_LABELS[m.tier]}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openQuickPayment(m.member_id)}>
                              <IndianRupee className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ type: 'target', id: m.id, name: m.member?.name || '' })}>
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">
                        {formatCurrency(m.paid)} / {formatCurrency(m.target)}
                      </span>
                      <span className={`font-medium ${statusColor}`}>{pct}%</span>
                    </div>
                    {renderProgressBar(m.paid, m.target, barColor)}
                    {m.outstanding > 0 && (
                      <p className="text-xs text-red-500 mt-1">Outstanding: {formatCurrency(m.outstanding)}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderPaymentsTab() {
    const totalFiltered = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    return (
      <div className="space-y-4">
        {/* Actions & Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {isAdmin && (
            <Button size="sm" onClick={() => { resetPaymentForm(); setShowPaymentModal(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Record Payment
            </Button>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by member..."
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <Select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="!w-auto"
            options={[
              { value: 'all', label: 'All Methods' },
              { value: 'cash', label: 'Cash' },
              { value: 'online', label: 'Online' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>

        {/* Total */}
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Total Payments</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalFiltered)}</p>
            <p className="text-xs text-gray-400">{filteredPayments.length} transactions</p>
          </CardContent>
        </Card>

        {/* Payment List */}
        {filteredPayments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">No payments recorded</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredPayments.map(payment => (
              <Card key={payment.id} animate>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {payment.member?.avatar_url ? (
                        <img src={payment.member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm text-gray-500">{payment.member?.name?.[0]}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.member?.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatDate(payment.date)}</span>
                          <Badge variant="info" size="sm">{METHOD_LABELS[payment.payment_method]}</Badge>
                        </div>
                        {payment.description && <p className="text-xs text-gray-400 mt-0.5">{payment.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-600">+{formatCurrency(Number(payment.amount))}</span>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ type: 'payment', id: payment.id, name: `${payment.member?.name} - ${formatCurrency(Number(payment.amount))}` })}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderSeasonModal() {
    return (
      <Modal
        isOpen={showSeasonModal}
        onClose={() => { setShowSeasonModal(false); resetSeasonForm(); }}
        title={editingSeason ? 'Edit Season' : 'Create Season'}
      >
        <div className="space-y-4">
          <Input label="Season Name" placeholder="e.g. Season 2026-27" value={seasonForm.name} onChange={(e) => setSeasonForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label="Start Date" value={seasonForm.start_date} onChange={(e) => setSeasonForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" label="End Date" value={seasonForm.end_date} onChange={(e) => setSeasonForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Input type="number" label="Total Budget (₹)" placeholder="Estimated total ground cost" value={seasonForm.total_budget} onChange={(e) => setSeasonForm(f => ({ ...f, total_budget: e.target.value }))} />
          <Select
            label="Status"
            value={seasonForm.status}
            onChange={(e) => setSeasonForm(f => ({ ...f, status: e.target.value as Season['status'] }))}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
          <TextArea label="Notes" placeholder="Optional notes" value={seasonForm.notes} onChange={(e) => setSeasonForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowSeasonModal(false); resetSeasonForm(); }} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={editingSeason ? handleUpdateSeason : handleAddSeason}
              className="flex-1"
              disabled={isSubmitting || !seasonForm.name || !seasonForm.start_date || !seasonForm.end_date}
            >
              {isSubmitting ? 'Saving...' : editingSeason ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderBookingModal() {
    return (
      <Modal
        isOpen={showBookingModal}
        onClose={() => { setShowBookingModal(false); resetBookingForm(); }}
        title={editingBooking ? 'Edit Booking' : 'Add Ground Booking'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label="Date" value={bookingForm.date} onChange={(e) => setBookingForm(f => ({ ...f, date: e.target.value }))} />
            <Input type="number" label="Cost (₹)" placeholder="0" value={bookingForm.cost} onChange={(e) => setBookingForm(f => ({ ...f, cost: e.target.value }))} />
          </div>
          <Input label="Venue" placeholder="Ground name" value={bookingForm.venue} onChange={(e) => setBookingForm(f => ({ ...f, venue: e.target.value }))} />
          <Input label="Time Slot" placeholder="e.g. 6:00 AM - 9:00 AM" value={bookingForm.time_slot} onChange={(e) => setBookingForm(f => ({ ...f, time_slot: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={bookingForm.status}
              onChange={(e) => setBookingForm(f => ({ ...f, status: e.target.value as GroundBooking['status'] }))}
              options={[
                { value: 'booked', label: 'Booked' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <Select
              label="Payment"
              value={bookingForm.payment_status}
              onChange={(e) => setBookingForm(f => ({ ...f, payment_status: e.target.value as GroundBooking['payment_status'] }))}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          </div>
          <Select
            label="Link to Match (Optional)"
            value={bookingForm.match_id}
            onChange={(e) => setBookingForm(f => ({ ...f, match_id: e.target.value }))}
            options={[
              { value: '', label: 'No linked match' },
              ...availableMatches.map(m => ({
                value: m.id,
                label: `${formatDate(m.date)} - vs ${m.opponent || 'Internal'} (${m.venue})`,
              })),
            ]}
          />
          <TextArea label="Notes" placeholder="Optional notes" value={bookingForm.notes} onChange={(e) => setBookingForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowBookingModal(false); resetBookingForm(); }} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={editingBooking ? handleUpdateBooking : handleAddBooking}
              className="flex-1"
              disabled={isSubmitting || !bookingForm.venue || !bookingForm.date}
            >
              {isSubmitting ? 'Saving...' : editingBooking ? 'Update' : 'Add Booking'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderTargetModal() {
    const activeMembers = members.filter(m => m.status === 'active');
    const existingTargetMemberIds = new Set(selectedSeason?.targets?.map(t => t.member_id) || []);

    return (
      <Modal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Set Member Targets"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tier"
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value as MemberTier)}
              options={[
                { value: 'regular', label: 'Regular' },
                { value: 'occasional', label: 'Occasional' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Input type="number" label="Target Amount (₹)" placeholder="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Members</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-primary-500 hover:text-primary-600"
                  onClick={() => setSelectedMemberIds(activeMembers.filter(m => !existingTargetMemberIds.has(m.id)).map(m => m.id))}
                >
                  Select All New
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-500"
                  onClick={() => setSelectedMemberIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
              {activeMembers.map(member => {
                const hasTarget = existingTargetMemberIds.has(member.id);
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMemberIds(prev => [...prev, member.id]);
                        else setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                      }}
                      className="rounded border-gray-300"
                    />
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
            <Button variant="secondary" onClick={() => setShowTargetModal(false)} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSetTargets}
              className="flex-1"
              disabled={isSubmitting || selectedMemberIds.length === 0 || !targetAmount}
            >
              {isSubmitting ? 'Saving...' : `Set for ${selectedMemberIds.length} Members`}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderPaymentModal() {
    // Members who have targets for this season
    const targetMembers = selectedSeason?.targets?.map(t => t.member) || [];
    const paymentMembers = targetMembers.length > 0 ? targetMembers : members.filter(m => m.status === 'active');

    return (
      <Modal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); resetPaymentForm(); }}
        title="Record Payment"
      >
        <div className="space-y-4">
          <Select
            label="Member"
            value={paymentForm.member_id}
            onChange={(e) => setPaymentForm(f => ({ ...f, member_id: e.target.value }))}
            options={[
              { value: '', label: 'Select member' },
              ...paymentMembers.filter(Boolean).map(m => ({ value: m!.id, label: m!.name })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Amount (₹)" placeholder="0" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
            <Input type="date" label="Date" value={paymentForm.date} onChange={(e) => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <Select
            label="Payment Method"
            value={paymentForm.payment_method}
            onChange={(e) => setPaymentForm(f => ({ ...f, payment_method: e.target.value as FundPaymentMethod }))}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'online', label: 'Online' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input label="Description (Optional)" placeholder="e.g. Oct advance payment" value={paymentForm.description} onChange={(e) => setPaymentForm(f => ({ ...f, description: e.target.value }))} />

          {/* Show member's current status */}
          {paymentForm.member_id && selectedSeasonId && (() => {
            const status = getMemberFundStatus(selectedSeasonId, paymentForm.member_id);
            if (status.target > 0) {
              return (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Current Status</p>
                  <div className="flex justify-between text-sm">
                    <span>Target: {formatCurrency(status.target)}</span>
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
            <Button variant="secondary" onClick={() => { setShowPaymentModal(false); resetPaymentForm(); }} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPayment}
              className="flex-1"
              disabled={isSubmitting || !paymentForm.member_id || !paymentForm.amount || Number(paymentForm.amount) <= 0}
            >
              {isSubmitting ? 'Saving...' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div>
      <Header title="Season Fund" subtitle="Ground booking & advance payments" />

      {/* Season Selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Select
          value={selectedSeasonId}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
          className="!w-auto min-w-[200px]"
          options={seasons.map(s => ({
            value: s.id,
            label: `${s.name}${s.status === 'active' ? ' (Active)' : ''}`,
          }))}
        />
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { resetSeasonForm(); setShowSeasonModal(true); }}>
              <Plus className="w-4 h-4 mr-1" /> New Season
            </Button>
            {selectedSeason && (
              <>
                <Button size="sm" variant="secondary" onClick={() => openEditSeason(selectedSeason)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ type: 'season', id: selectedSeason.id, name: selectedSeason.name })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'bookings' && renderBookingsTab()}
      {activeTab === 'members' && renderMembersTab()}
      {activeTab === 'payments' && renderPaymentsTab()}

      {/* Modals */}
      {renderSeasonModal()}
      {renderBookingModal()}
      {renderTargetModal()}
      {renderPaymentModal()}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            {deleteConfirm?.type === 'season' && ' This will also delete all bookings, targets, and payments for this season.'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1" disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
