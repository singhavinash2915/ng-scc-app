import { useState, useEffect, useMemo, useRef } from 'react';
import { useMatchBookings } from '../hooks/useMatchBookings';
import type { MatchSlot } from '../types';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Phone,
  Users,
  User,
  QrCode,
  IndianRupee,
  Copy,
  Check,
  Shield,
  Info,
  AlertCircle,
} from 'lucide-react';

// ─── UPI Config ───────────────────────────────────────────────────────────────
const UPI_ID = 'scc.cricket@upi'; // Admin should update this in Settings
const UPI_NAME = 'Sangria Cricket Club';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

type BookingStep = 'calendar' | 'form' | 'payment' | 'success';

// ─── Shared input classes ─────────────────────────────────────────────────────
const inputCls = (hasError?: boolean) =>
  `w-full bg-white border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition text-sm ${
    hasError ? 'border-red-400' : 'border-gray-200 hover:border-gray-300'
  }`;
const inputWithIconCls = (hasError?: boolean) =>
  `w-full bg-white border rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition text-sm ${
    hasError ? 'border-red-400' : 'border-gray-200 hover:border-gray-300'
  }`;

// ─── Main Component ───────────────────────────────────────────────────────────
export function BookMatch() {
  const { slots, loading, fetchSlots, createBooking } = useMatchBookings();

  const [step, setStep] = useState<BookingStep>('calendar');
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  // Form state
  const [teamName, setTeamName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [chTeamId, setChTeamId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay'>('upi');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // ─── Group slots by month ─────────────────────────────────────────────────
  const slotsByMonth = useMemo(() => {
    const map: Record<string, MatchSlot[]> = {};
    slots.forEach(s => {
      const key = s.date.slice(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [slots]);

  const monthKeys = useMemo(() => Object.keys(slotsByMonth).sort(), [slotsByMonth]);
  const currentMonthKey = monthKeys[currentMonthIndex] ?? '';
  const currentMonthSlots = slotsByMonth[currentMonthKey] ?? [];

  const monthLabel = currentMonthKey
    ? `${MONTHS[parseInt(currentMonthKey.split('-')[1]) - 1]} ${currentMonthKey.split('-')[0]}`
    : '';

  function slotStatus(slot: MatchSlot): 'available' | 'pending' | 'booked' | 'blocked' {
    if (!slot.is_available) {
      if (slot.booking?.status === 'confirmed') return 'booked';
      if (slot.booking?.status === 'pending') return 'pending';
      return 'blocked';
    }
    return 'available';
  }

  // ─── Form validation ──────────────────────────────────────────────────────
  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!teamName.trim()) errs.teamName = 'Team name is required';
    if (!contactName.trim()) errs.contactName = 'Contact name is required';
    if (!contactPhone.trim()) errs.contactPhone = 'Phone number is required';
    else if (!/^[6-9]\d{9}$/.test(contactPhone.replace(/\s/g, '')))
      errs.contactPhone = 'Enter a valid 10-digit Indian mobile number';
    if (!chTeamId.trim()) errs.chTeamId = 'CricHeroes Team ID is required to prevent duplicate bookings';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Payment validation ───────────────────────────────────────────────────
  function validatePayment(): boolean {
    if (paymentMethod === 'upi' && !screenshotFile) {
      setPaymentError('Please upload your UPI payment screenshot to proceed.');
      return false;
    }
    setPaymentError(null);
    return true;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    setPaymentError(null);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!selectedSlot) return;
    if (!validatePayment()) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await createBooking({
      slotId: selectedSlot.id,
      slotDate: selectedSlot.date,
      amount: selectedSlot.price,
      teamName: teamName.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      chTeamId: chTeamId.trim(),
      paymentMethod,
      screenshotFile: screenshotFile ?? undefined,
    });

    setSubmitting(false);

    if (result.success) {
      setBookingId(result.bookingId ?? null);
      setStep('success');
    } else {
      setSubmitError(result.error ?? 'Booking failed. Please try again.');
    }
  }

  function handleCopyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setStep('calendar');
    setSelectedSlot(null);
    setTeamName(''); setContactName(''); setContactPhone(''); setChTeamId('');
    setPaymentMethod('upi');
    setScreenshotFile(null); setScreenshotPreview(null);
    setFormErrors({}); setPaymentError(null); setSubmitError(null); setBookingId(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/scc-logo.jpg" alt="SCC" className="w-10 h-10 rounded-xl object-cover shadow" />
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">Sangria Cricket Club</h1>
            <p className="text-xs text-primary-600 font-medium">Book a Match · Season 2026–27</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Hero (calendar step only) ─────────────────────────────────────── */}
        {step === 'calendar' && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Schedule a Match with SCC</h2>
            <p className="text-gray-500 text-sm mb-5">
              Pick an available date, provide your team details, and pay online to confirm.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-primary-600 font-semibold mb-1">Tue / Thu · Weekday</div>
                <div className="text-2xl font-bold text-gray-900">₹3,000</div>
                <div className="text-xs text-gray-400 mt-0.5">per match</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-amber-600 font-semibold mb-1">Saturday · Oct – Feb</div>
                <div className="text-2xl font-bold text-gray-900">₹4,000</div>
                <div className="text-xs text-gray-400 mt-0.5">per match</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              One slot per team per month. Booking confirmed after SCC admin verifies payment.
            </p>
          </div>
        )}

        {/* ── Step indicator ────────────────────────────────────────────────── */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-6">
            {(['calendar', 'form', 'payment'] as const).map((s, i) => {
              const stepOrder = ['calendar', 'form', 'payment'];
              const isDone = stepOrder.indexOf(step) > i;
              const isActive = step === s;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isActive ? 'bg-primary-500 border-primary-500 text-white' :
                    isDone   ? 'bg-primary-100 border-primary-300 text-primary-600' :
                               'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                    {s === 'calendar' ? 'Select Date' : s === 'form' ? 'Team Details' : 'Payment'}
                  </span>
                  {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-primary-300' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ STEP 1: Slot Calendar ══════════════════════════════════════════ */}
        {step === 'calendar' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button
                onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))}
                disabled={currentMonthIndex === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-semibold text-gray-900">{monthLabel}</h3>
              <button
                onClick={() => setCurrentMonthIndex(i => Math.min(monthKeys.length - 1, i + 1))}
                disabled={currentMonthIndex === monthKeys.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition text-gray-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 px-5 py-2.5 border-b border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> Booked</span>
            </div>

            {/* Slots grid */}
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : currentMonthSlots.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No slots available this month.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {currentMonthSlots.map(slot => {
                    const status = slotStatus(slot);
                    const isAvailable = status === 'available';
                    return (
                      <button
                        key={slot.id}
                        disabled={!isAvailable}
                        onClick={() => { setSelectedSlot(slot); setStep('form'); }}
                        className={`rounded-xl p-3 text-left border transition-all ${
                          isAvailable
                            ? 'bg-primary-50 border-primary-200 hover:bg-primary-100 hover:border-primary-400 cursor-pointer'
                            : status === 'pending'
                            ? 'bg-amber-50 border-amber-200 cursor-not-allowed opacity-70'
                            : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className={`text-xs font-semibold mb-0.5 ${
                          isAvailable ? 'text-primary-600' :
                          status === 'pending' ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {getDayName(slot.date)}
                        </div>
                        <div className={`font-bold text-sm ${isAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatShortDate(slot.date)}
                        </div>
                        <div className={`text-xs mt-1 ${isAvailable ? 'text-gray-500' : 'text-gray-400'}`}>
                          ₹{slot.price.toLocaleString('en-IN')}
                        </div>
                        {status === 'pending' && (
                          <div className="text-xs text-amber-600 font-medium mt-0.5">Pending</div>
                        )}
                        {(status === 'booked' || status === 'blocked') && (
                          <div className="text-xs text-gray-400 mt-0.5">Booked</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Month quick-nav pills */}
            <div className="flex gap-2 px-5 pb-5 flex-wrap border-t border-gray-100 pt-4">
              {monthKeys.map((key, idx) => {
                const label = `${MONTHS[parseInt(key.split('-')[1]) - 1].slice(0, 3)} '${key.split('-')[0].slice(2)}`;
                return (
                  <button
                    key={key}
                    onClick={() => setCurrentMonthIndex(idx)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                      idx === currentMonthIndex
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 bg-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP 2: Team Details ══════════════════════════════════════════ */}
        {step === 'form' && selectedSlot && (
          <div className="space-y-4">
            {/* Selected slot chip */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{formatDate(selectedSlot.date)}</p>
                <p className="text-xs text-primary-600 mt-0.5">
                  {selectedSlot.day_type === 'saturday' ? 'Saturday Slot' : 'Weekday Slot'} · ₹{selectedSlot.price.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setStep('calendar')}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 bg-white rounded-lg px-3 py-1.5 transition shrink-0"
              >
                Change
              </button>
            </div>

            {/* Form card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" /> Team Details
              </h3>

              {/* Team name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai Warriors CC"
                  value={teamName}
                  onChange={e => { setTeamName(e.target.value); setFormErrors(f => ({ ...f, teamName: '' })); }}
                  className={inputCls(!!formErrors.teamName)}
                />
                {formErrors.teamName && <p className="text-red-500 text-xs mt-1">{formErrors.teamName}</p>}
              </div>

              {/* Contact name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contact Person Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={contactName}
                    onChange={e => { setContactName(e.target.value); setFormErrors(f => ({ ...f, contactName: '' })); }}
                    className={inputWithIconCls(!!formErrors.contactName)}
                  />
                </div>
                {formErrors.contactName && <p className="text-red-500 text-xs mt-1">{formErrors.contactName}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contact Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={contactPhone}
                    onChange={e => { setContactPhone(e.target.value); setFormErrors(f => ({ ...f, contactPhone: '' })); }}
                    className={inputWithIconCls(!!formErrors.contactPhone)}
                  />
                </div>
                {formErrors.contactPhone && <p className="text-red-500 text-xs mt-1">{formErrors.contactPhone}</p>}
              </div>

              {/* CricHeroes Team ID — REQUIRED */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  CricHeroes Team Profile Link <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="https://cricheroes.in/team-profile/12345"
                    value={chTeamId}
                    onChange={e => { setChTeamId(e.target.value); setFormErrors(f => ({ ...f, chTeamId: '' })); }}
                    className={inputWithIconCls(!!formErrors.chTeamId)}
                  />
                </div>
                {formErrors.chTeamId ? (
                  <p className="text-red-500 text-xs mt-1">{formErrors.chTeamId}</p>
                ) : (
                  <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Required to enforce the one-slot-per-team rule. Your CricHeroes team ID is unique to your team and doesn't change.
                      <br />
                      <strong>How to find it:</strong> Open CricHeroes app → Your team page → Share → Copy link.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => { if (validateForm()) setStep('payment'); }}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3.5 rounded-xl transition text-sm"
            >
              Continue to Payment →
            </button>
          </div>
        )}

        {/* ══ STEP 3: Payment ═══════════════════════════════════════════════ */}
        {step === 'payment' && selectedSlot && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Match Date</span>
                  <span className="font-medium text-gray-900">{formatDate(selectedSlot.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Visiting Team</span>
                  <span className="font-medium text-gray-900">{teamName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact</span>
                  <span className="font-medium text-gray-900">{contactName}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Amount</span>
                  <span className="font-bold text-primary-600 text-lg flex items-center gap-0.5">
                    <IndianRupee className="w-4 h-4" />{selectedSlot.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment method tabs */}
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setPaymentMethod('upi'); setPaymentError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  paymentMethod === 'upi'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                UPI / QR Code
              </button>
              <button
                onClick={() => { setPaymentMethod('razorpay'); setPaymentError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  paymentMethod === 'razorpay'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pay Online
              </button>
            </div>

            {/* UPI panel */}
            {paymentMethod === 'upi' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <QrCode className="w-4 h-4 text-primary-500" /> Pay via UPI
                </h3>

                {/* QR + UPI ID */}
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                    <div className="w-40 h-40 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2">
                      <QrCode className="w-14 h-14 text-gray-300" />
                      <p className="text-xs text-gray-400 text-center">SCC UPI QR<br/>(Set by admin)</p>
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs text-gray-500 mb-1.5">Or pay directly to UPI ID</p>
                    <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                      <span className="font-mono text-sm font-semibold text-gray-900">{UPI_ID}</span>
                      <button onClick={handleCopyUPI} className="text-primary-500 hover:text-primary-700 transition">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Name: {UPI_NAME}</p>
                  </div>
                </div>

                {/* Screenshot upload — REQUIRED for UPI */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1.5">
                    Upload Payment Screenshot <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    After paying via UPI, upload your payment screenshot here. Booking won't proceed without it.
                  </p>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      screenshotPreview
                        ? 'border-primary-300 bg-primary-50'
                        : paymentError
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    {screenshotPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={screenshotPreview} alt="screenshot" className="max-h-32 rounded-lg object-contain" />
                        <p className="text-xs text-primary-600 font-medium">Screenshot uploaded · Tap to change</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Upload className="w-6 h-6" />
                        <p className="text-sm font-medium text-gray-600">Tap to upload payment screenshot</p>
                        <p className="text-xs">JPG, PNG · Max 5MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  {paymentError && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {paymentError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Razorpay panel */}
            {paymentMethod === 'razorpay' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-center">
                <div className="text-4xl">💳</div>
                <p className="font-semibold text-gray-900">Pay Online</p>
                <p className="text-sm text-gray-500">
                  Submit your booking request now. SCC admin will send you a secure payment link on <strong>{contactPhone}</strong> within a few hours.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-left flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  Slot is reserved for 24 hours after submission. Booking is confirmed only after payment is completed.
                </div>
              </div>
            )}

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Booking is confirmed only after SCC admin verifies your payment. You'll receive a WhatsApp message on {contactPhone}.
              </p>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white font-medium transition text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : 'Confirm Booking'
                }
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: Success ═══════════════════════════════════════════════ */}
        {step === 'success' && selectedSlot && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary-100 border-2 border-primary-300 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary-500" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Request Sent!</h2>
              <p className="text-gray-500 text-sm">
                Your booking is under review. SCC admin will verify payment and confirm shortly.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 text-left shadow-sm space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking ID</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                  {bookingId?.slice(0, 8).toUpperCase()}…
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Match Date</span>
                <span className="font-medium text-gray-900">{formatDate(selectedSlot.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Team</span>
                <span className="font-medium text-gray-900">{teamName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-primary-600">₹{selectedSlot.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-left">
              <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">What happens next?</p>
                <ol className="text-xs text-blue-700 mt-1.5 space-y-1 list-decimal list-inside">
                  <li>SCC admin reviews your booking & payment screenshot</li>
                  <li>WhatsApp confirmation sent to {contactPhone}</li>
                  <li>Match is scheduled on the SCC app</li>
                </ol>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 font-semibold text-white transition text-sm"
            >
              Book Another Match
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400 space-y-1 pb-8">
          <p>Sangria Cricket Club · Powered by SCC App</p>
          <p>Questions? WhatsApp us at <span className="text-primary-500">+91 XXXXX XXXXX</span></p>
        </div>
      </main>
    </div>
  );
}
