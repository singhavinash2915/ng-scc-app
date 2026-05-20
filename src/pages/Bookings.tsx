import { useEffect, useState } from 'react';
import { useMatchBookings } from '../hooks/useMatchBookings';
import { useAuth } from '../context/AuthContext';
import type { MatchBooking, MatchBookingStatus } from '../types';
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
    bookings, loading, error,
    fetchBookings,
    updateBookingStatus,
    confirmBookingAndCreateMatch,
  } = useMatchBookings();

  const [statusFilter, setStatusFilter] = useState<MatchBookingStatus | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<MatchBooking | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showScreenshot, setShowScreenshot] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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
            className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Public Booking Page
          </a>
          <button
            onClick={fetchBookings}
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
        onClose={() => { setSelectedBooking(null); setAdminNotes(''); setActionError(null); }}
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
    </div>
  );
}
