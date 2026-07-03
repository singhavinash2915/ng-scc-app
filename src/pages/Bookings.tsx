import { useEffect, useMemo, useState } from 'react';
import { useMatchBookings } from '../hooks/useMatchBookings';
import { useAuth } from '../context/AuthContext';
import type { MatchBooking, MatchBookingStatus, MatchSlot } from '../types';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Phone,
  Users,
  IndianRupee,
  QrCode,
  Lock,
  ExternalLink,
  RefreshCw,
  Filter,
  CheckCheck,
  AlertCircle,
  Trash2,
  Plus,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status: MatchBookingStatus) {
  switch (status) {
    case 'confirmed': return { label: 'Confirmed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'pending':   return { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    case 'rejected':  return { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
  }
}

function paymentStatusBadge(status: string) {
  switch (status) {
    case 'verified': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'paid':     return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:         return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function Bookings() {
  const { isAdmin } = useAuth();
  const {
    bookings, slots, loading, error,
    fetchBookings,
    fetchSlots,
    createAdminBooking,
    updateBookingStatus,
    confirmBookingAndCreateMatch,
    deleteBooking,
  } = useMatchBookings();

  const [statusFilter, setStatusFilter] = useState<MatchBookingStatus | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<MatchBooking | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    fetchBookings();
    fetchSlots();
  }, [fetchBookings, fetchSlots]);

  // Available slots (today onward), for the manual admin-booking dropdown.
  const availableSlots = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return slots
      .filter(s => s.is_available && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  const filtered = bookings.filter(b =>
    statusFilter === 'all' ? true : b.status === statusFilter
  );

  // Stats
  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    rejected:  bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled').length,
    revenue:   bookings.filter(b => b.payment_status === 'verified').reduce((s, b) => s + b.amount, 0),
  };

  async function handleConfirm() {
    if (!selectedBooking) return;
    setActionLoading(true);
    setActionError(null);
    const result = await confirmBookingAndCreateMatch(selectedBooking.id, adminNotes || undefined);
    setActionLoading(false);
    if (result.success) {
      setSelectedBooking(null);
      setAdminNotes('');
    } else {
      setActionError(result.error ?? 'Failed to confirm');
    }
  }

  async function handleReject() {
    if (!selectedBooking) return;
    setActionLoading(true);
    setActionError(null);
    const result = await updateBookingStatus(selectedBooking.id, 'rejected', adminNotes || undefined);
    setActionLoading(false);
    if (result.success) {
      setSelectedBooking(null);
      setAdminNotes('');
    } else {
      setActionError(result.error ?? 'Failed to reject');
    }
  }

  async function handleDelete() {
    if (!selectedBooking) return;
    setActionLoading(true);
    setActionError(null);
    const result = await deleteBooking(selectedBooking.id);
    setActionLoading(false);
    if (result.success) {
      setSelectedBooking(null);
      setAdminNotes('');
      setShowDeleteConfirm(false);
    } else {
      setActionError(result.error ?? 'Failed to delete');
      setShowDeleteConfirm(false);
    }
  }

  // ─── Not admin ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500 dark:text-gray-400">
        <Lock className="w-10 h-10 opacity-40" />
        <p className="text-center text-sm">Admin access required to manage bookings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Match Bookings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Manage inter-club booking requests · Season 2026–27
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/book-match"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Public Booking Page
          </a>
          <Button onClick={() => setShowManualModal(true)} className="!py-2">
            <Plus className="w-4 h-4" />
            Book for a Team
          </Button>
          <button
            onClick={() => { fetchBookings(); fetchSlots(); }}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: stats.total, icon: CalendarDays, color: 'text-blue-500' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-amber-500' },
          { label: 'Confirmed',      value: stats.confirmed, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'Revenue Verified', value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-primary-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', 'pending', 'confirmed', 'rejected', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
              statusFilter === s
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {s === 'all' ? `All (${bookings.length})` : `${s} (${bookings.filter(b => b.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bookings found</p>
          <p className="text-sm mt-1">Share the booking link to start receiving requests.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Mobile cards / Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Match Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Team</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Payment</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(booking => {
                  const badge = statusBadge(booking.status);
                  return (
                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {booking.slot?.date ? formatDate(booking.slot.date) : '—'}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">
                          {booking.slot?.day_type === 'saturday' ? 'Saturday' : 'Weekday'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{booking.team_name}</div>
                        {booking.cricheroes_team_id && (
                          <a
                            href={booking.cricheroes_team_id.startsWith('http') ? booking.cricheroes_team_id : `https://cricheroes.in/team-profile/${booking.cricheroes_team_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-500 hover:underline flex items-center gap-0.5"
                          >
                            <QrCode className="w-3 h-3" /> CricHeroes
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 dark:text-gray-300">{booking.contact_name}</div>
                        <a href={`tel:${booking.contact_phone}`} className="text-xs text-gray-400 hover:text-primary-500 flex items-center gap-0.5">
                          <Phone className="w-3 h-3" /> {booking.contact_phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        ₹{booking.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize w-fit ${paymentStatusBadge(booking.payment_status)}`}>
                            {booking.payment_status}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">{booking.payment_method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setSelectedBooking(booking); setAdminNotes(booking.admin_notes ?? ''); setActionError(null); }}
                          className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                        >
                          <Eye className="w-3 h-3" /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(booking => {
              const badge = statusBadge(booking.status);
              return (
                <div key={booking.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{booking.team_name}</p>
                      <p className="text-xs text-gray-500">{booking.slot?.date ? formatDate(booking.slot.date) : '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{booking.contact_name} · {booking.contact_phone}</span>
                    <span className="font-semibold">₹{booking.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedBooking(booking); setAdminNotes(booking.admin_notes ?? ''); setActionError(null); }}
                    className="text-xs text-primary-600 dark:text-primary-400 font-medium"
                  >
                    Review →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Review Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedBooking}
        onClose={() => { setSelectedBooking(null); setAdminNotes(''); setActionError(null); setShowDeleteConfirm(false); }}
        title="Review Booking"
        size="lg"
      >
        {selectedBooking && (
          <div className="space-y-5">
            {/* Match date + amount */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Match Date</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selectedBooking.slot?.date ? formatDate(selectedBooking.slot.date) : '—'}
                </p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">
                  {selectedBooking.slot?.day_type === 'saturday' ? 'Saturday slot' : 'Weekday slot'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Amount</p>
                <p className="font-bold text-xl text-primary-600 dark:text-primary-400">
                  ₹{selectedBooking.amount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Team info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Users className="w-4 h-4" /> Visiting Team
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Team Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.team_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Contact Person</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.contact_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                  <a href={`tel:${selectedBooking.contact_phone}`} className="font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedBooking.contact_phone}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">CricHeroes</p>
                  {selectedBooking.cricheroes_team_id ? (
                    <a
                      href={selectedBooking.cricheroes_team_id.startsWith('http') ? selectedBooking.cricheroes_team_id : `https://cricheroes.in/team-profile/${selectedBooking.cricheroes_team_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 dark:text-primary-400 flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="w-3 h-3" /> View Profile
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">Not provided</span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" /> Payment
              </h3>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${paymentStatusBadge(selectedBooking.payment_status)}`}>
                  {selectedBooking.payment_status}
                </span>
                <span className="text-xs text-gray-400 capitalize">via {selectedBooking.payment_method}</span>
              </div>

              {selectedBooking.payment_screenshot_url && (
                <div>
                  <button
                    onClick={() => setShowScreenshot(true)}
                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <Eye className="w-4 h-4" /> View Payment Screenshot
                  </button>
                </div>
              )}
              {!selectedBooking.payment_screenshot_url && selectedBooking.payment_method === 'upi' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> No screenshot uploaded — verify payment manually
                </p>
              )}
            </div>

            {/* Current status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Current status:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(selectedBooking.status).cls}`}>
                {statusBadge(selectedBooking.status).label}
              </span>
              {selectedBooking.match_id && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Match Created
                </span>
              )}
            </div>

            {/* Admin notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Admin Notes <span className="text-gray-400 text-xs">(optional — sent to team on WhatsApp)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Payment verified via UPI. Please confirm 30 mins early."
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
              />
            </div>

            {actionError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {actionError}
              </div>
            )}

            {/* Actions */}
            {selectedBooking.status === 'pending' && (
              <div className="flex gap-3 pt-1">
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </Button>
                <Button
                  variant="success"
                  onClick={handleConfirm}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm + Create Match
                </Button>
              </div>
            )}

            {selectedBooking.status === 'confirmed' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Booking confirmed. Match has been created in the Matches page.
              </div>
            )}

            {(selectedBooking.status === 'rejected' || selectedBooking.status === 'cancelled') && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm text-gray-500 dark:text-gray-400">
                This booking has been {selectedBooking.status}. The slot has been released.
              </div>
            )}

            {/* Delete (hard-delete — for admin testing / duplicates) */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete this booking permanently
                </button>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Are you sure? This will permanently delete the booking and release the slot.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                      {actionLoading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />
                      }
                      Yes, Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Screenshot viewer */}
      <Modal
        isOpen={showScreenshot && !!selectedBooking?.payment_screenshot_url}
        onClose={() => setShowScreenshot(false)}
        title="Payment Screenshot"
        size="lg"
      >
        {selectedBooking?.payment_screenshot_url && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={selectedBooking.payment_screenshot_url}
              alt="Payment screenshot"
              className="max-w-full rounded-xl border border-gray-200 dark:border-gray-600"
            />
            <a
              href={selectedBooking.payment_screenshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open full size
            </a>
          </div>
        )}
      </Modal>

      {/* ── Manual (admin) booking modal ──────────────────────────────────── */}
      <ManualBookingModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        slots={availableSlots}
        onCreate={createAdminBooking}
        onDone={() => { fetchBookings(); fetchSlots(); }}
      />
    </div>
  );
}

// ─── Manual Booking Modal ──────────────────────────────────────────────────────
function ManualBookingModal({
  isOpen,
  onClose,
  slots,
  onCreate,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  slots: MatchSlot[];
  onCreate: ReturnType<typeof useMatchBookings>['createAdminBooking'];
  onDone: () => void;
}) {
  const [slotId, setSlotId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [chTeamId, setChTeamId] = useState('');
  const [amount, setAmount] = useState('');
  const [venue, setVenue] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'verified'>('verified');
  const [confirmNow, setConfirmNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ matchCreated: boolean } | null>(null);

  const selectedSlot = slots.find(s => s.id === slotId);

  // Default the amount to the chosen slot's price (admin can still override after)
  function handleSlotChange(id: string) {
    setSlotId(id);
    const slot = slots.find(s => s.id === id);
    if (slot) setAmount(String(slot.price));
  }

  function reset() {
    setSlotId(''); setTeamName(''); setContactName(''); setContactPhone('');
    setChTeamId(''); setAmount(''); setVenue(''); setPaymentStatus('verified');
    setConfirmNow(true); setNotes(''); setErr(null); setDone(null);
  }

  function handleClose() {
    if (done) onDone();
    reset();
    onClose();
  }

  async function handleSubmit() {
    setErr(null);
    if (!selectedSlot) { setErr('Please choose a match date/slot.'); return; }
    if (!teamName.trim()) { setErr('Team name is required.'); return; }
    if (!contactName.trim() || !contactPhone.trim()) { setErr('Contact name and phone are required.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) { setErr('Enter a valid amount.'); return; }

    setSaving(true);
    const res = await onCreate({
      slotId: selectedSlot.id,
      slotDate: selectedSlot.date,
      amount: amt,
      teamName: teamName.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      chTeamId: chTeamId.trim() || undefined,
      paymentStatus,
      confirmNow,
      venue: venue.trim() || undefined,
      adminNotes: notes.trim() || undefined,
    });
    setSaving(false);
    if (res.success) {
      setDone({ matchCreated: !!res.matchId });
    } else {
      setErr(res.error ?? 'Failed to create booking');
    }
  }

  const inputCls = 'w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Book a Slot for a Team" size="lg">
      {done ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircle2 className="w-14 h-14 text-green-500" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Booking created!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {done.matchCreated
              ? 'The booking is confirmed and an upcoming match has been added to the Matches page.'
              : 'The booking has been saved as pending. Review it in the list to confirm and create the match.'}
          </p>
          <Button onClick={handleClose} className="mt-2">Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use this when a team contacts you directly (phone / WhatsApp). It reserves the slot and records the booking without the public payment step.
          </p>

          {/* Slot */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Match Date / Slot *</label>
            {slots.length === 0 ? (
              <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> No available slots. Open new slots first.
              </div>
            ) : (
              <select value={slotId} onChange={e => handleSlotChange(e.target.value)} className={inputCls}>
                <option value="">Choose an available date…</option>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date)} · {s.day_type === 'saturday' ? 'Saturday' : 'Weekday'} · ₹{s.price.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Team + contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Team Name *</label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Royal Strikers" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">CricHeroes ID / Link</label>
              <input value={chTeamId} onChange={e => setChTeamId(e.target.value)} placeholder="Optional" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Person *</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Captain / manager" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Phone *</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" className={inputCls} />
            </div>
          </div>

          {/* Amount + payment status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount (₹) *</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Slot price" inputMode="numeric" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payment Status</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'pending' | 'paid' | 'verified')} className={inputCls}>
                <option value="verified">Received (verified)</option>
                <option value="paid">Paid — to verify</option>
                <option value="pending">Not paid yet</option>
              </select>
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Venue <span className="text-gray-400 text-xs">(optional — used when creating the match)</span>
            </label>
            <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Four Star Cricket Ground" className={inputCls} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Paid ₹3,500 cash. Bringing own umpire." className={`${inputCls} resize-none`} />
          </div>

          {/* Confirm + create match toggle */}
          <label className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 cursor-pointer">
            <input type="checkbox" checked={confirmNow} onChange={e => setConfirmNow(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary-500" />
            <span className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Confirm now & create the match</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Adds an upcoming match immediately. Uncheck to save as pending and review later.
              </span>
            </span>
          </label>

          {err && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={handleClose} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1" disabled={saving || slots.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {confirmNow ? 'Book + Create Match' : 'Save Booking'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
