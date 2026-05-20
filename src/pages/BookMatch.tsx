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
} from 'lucide-react';

// ─── UPI Config ───────────────────────────────────────────────────────────────
const UPI_ID = 'scc.cricket@upi'; // Admin should update this
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
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ─── Group slots by month ─────────────────────────────────────────────────
  const slotsByMonth = useMemo(() => {
    const map: Record<string, MatchSlot[]> = {};
    slots.forEach(s => {
      const key = s.date.slice(0, 7); // "2026-10"
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

  // ─── Slot status helpers ──────────────────────────────────────────────────
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
    else if (!/^[6-9]\d{9}$/.test(contactPhone.replace(/\s/g, ''))) {
      errs.contactPhone = 'Enter a valid 10-digit Indian mobile number';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await createBooking({
      slotId: selectedSlot.id,
      slotDate: selectedSlot.date,
      amount: selectedSlot.price,
      teamName: teamName.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      chTeamId: chTeamId.trim() || undefined,
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
    setTeamName('');
    setContactName('');
    setContactPhone('');
    setChTeamId('');
    setPaymentMethod('upi');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setFormErrors({});
    setSubmitError(null);
    setBookingId(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/scc-logo.jpg" alt="SCC" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Sangria Cricket Club</h1>
            <p className="text-xs text-green-300">Book a Match · Season 2026–27</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero banner */}
        {step === 'calendar' && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1.5 text-sm text-green-300 mb-4">
              <CalendarDays className="w-4 h-4" />
              Booking Open: Oct 2026 – May 2027
            </div>
            <h2 className="text-3xl font-bold mb-2">Schedule a Match with SCC</h2>
            <p className="text-green-200/80 max-w-md mx-auto">
              Select an available slot, fill your team details, and complete payment to confirm your match.
            </p>

            {/* Slot type info */}
            <div className="grid grid-cols-2 gap-3 mt-6 max-w-sm mx-auto">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-left">
                <div className="text-xs text-green-300 font-medium mb-1">Tue / Thu</div>
                <div className="text-xl font-bold">₹3,000</div>
                <div className="text-xs text-white/60 mt-0.5">Weekday Slot</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-left">
                <div className="text-xs text-amber-300 font-medium mb-1">Saturdays (Oct–Feb)</div>
                <div className="text-xl font-bold">₹4,000</div>
                <div className="text-xs text-white/60 mt-0.5">Weekend Slot</div>
              </div>
            </div>
            <p className="text-xs text-white/40 mt-3">
              <Info className="w-3 h-3 inline mr-1" />
              One slot per team per month. Booking confirmed after payment verification.
            </p>
          </div>
        )}

        {/* Step progress */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-6">
            {(['calendar', 'form', 'payment'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s ? 'bg-green-500 text-white ring-2 ring-green-400/40' :
                  (['form', 'payment'].indexOf(step) > i) ? 'bg-green-700 text-white' :
                  'bg-white/10 text-white/40'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium capitalize hidden sm:block ${step === s ? 'text-white' : 'text-white/40'}`}>
                  {s === 'calendar' ? 'Select Date' : s === 'form' ? 'Team Details' : 'Payment'}
                </span>
                {i < 2 && <div className="w-8 h-px bg-white/20" />}
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Calendar ─────────────────────────────────────────────── */}
        {step === 'calendar' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <button
                onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))}
                disabled={currentMonthIndex === 0}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-semibold text-lg">{monthLabel}</h3>
              <button
                onClick={() => setCurrentMonthIndex(i => Math.min(monthKeys.length - 1, i + 1))}
                disabled={currentMonthIndex === monthKeys.length - 1}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-white/10 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white/20" /> Booked
              </span>
            </div>

            {/* Slots grid */}
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                </div>
              ) : currentMonthSlots.length === 0 ? (
                <p className="text-center text-white/40 py-10">No slots for this month.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
                            ? 'bg-green-500/15 border-green-500/30 hover:bg-green-500/25 hover:border-green-400/50 cursor-pointer'
                            : status === 'pending'
                            ? 'bg-amber-500/10 border-amber-500/20 cursor-not-allowed opacity-70'
                            : 'bg-white/5 border-white/10 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${
                          isAvailable ? 'text-green-400' :
                          status === 'pending' ? 'text-amber-400' : 'text-white/40'
                        }`}>
                          {getDayName(slot.date)}
                        </div>
                        <div className="font-bold text-sm">{formatShortDate(slot.date)}</div>
                        <div className="text-xs text-white/50 mt-1">
                          ₹{slot.price.toLocaleString('en-IN')}
                        </div>
                        {status === 'pending' && (
                          <div className="text-xs text-amber-400 mt-1">Pending</div>
                        )}
                        {(status === 'booked' || status === 'blocked') && (
                          <div className="text-xs text-white/30 mt-1">Booked</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Month quick-nav */}
            <div className="flex gap-2 px-5 pb-5 flex-wrap">
              {monthKeys.map((key, idx) => {
                const label = `${MONTHS[parseInt(key.split('-')[1]) - 1].slice(0, 3)} '${key.split('-')[0].slice(2)}`;
                return (
                  <button
                    key={key}
                    onClick={() => setCurrentMonthIndex(idx)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      idx === currentMonthIndex
                        ? 'bg-green-500 text-white border-green-500'
                        : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: Team Details Form ─────────────────────────────────────── */}
        {step === 'form' && selectedSlot && (
          <div className="space-y-4">
            {/* Selected slot summary */}
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{formatDate(selectedSlot.date)}</p>
                <p className="text-sm text-green-300">
                  {selectedSlot.day_type === 'saturday' ? 'Saturday Weekend Slot' : 'Weekday Slot'} · ₹{selectedSlot.price.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setStep('calendar')}
                className="text-xs text-white/50 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition"
              >
                Change
              </button>
            </div>

            {/* Form fields */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                Team Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai Warriors CC"
                  value={teamName}
                  onChange={e => { setTeamName(e.target.value); setFormErrors(f => ({ ...f, teamName: '' })); }}
                  className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition ${formErrors.teamName ? 'border-red-500/50' : 'border-white/20'}`}
                />
                {formErrors.teamName && <p className="text-red-400 text-xs mt-1">{formErrors.teamName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Contact Person Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={contactName}
                    onChange={e => { setContactName(e.target.value); setFormErrors(f => ({ ...f, contactName: '' })); }}
                    className={`w-full bg-white/10 border rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition ${formErrors.contactName ? 'border-red-500/50' : 'border-white/20'}`}
                  />
                </div>
                {formErrors.contactName && <p className="text-red-400 text-xs mt-1">{formErrors.contactName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Contact Phone <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={contactPhone}
                    onChange={e => { setContactPhone(e.target.value); setFormErrors(f => ({ ...f, contactPhone: '' })); }}
                    className={`w-full bg-white/10 border rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition ${formErrors.contactPhone ? 'border-red-500/50' : 'border-white/20'}`}
                  />
                </div>
                {formErrors.contactPhone && <p className="text-red-400 text-xs mt-1">{formErrors.contactPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  CricHeroes Team ID / Profile URL
                  <span className="text-white/40 text-xs ml-1">(optional but recommended)</span>
                </label>
                <div className="relative">
                  <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="e.g. https://cricheroes.in/team-profile/12345"
                    value={chTeamId}
                    onChange={e => setChTeamId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition"
                  />
                </div>
                <p className="text-xs text-white/40 mt-1">
                  Open CricHeroes app → Your team → Copy the profile link
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (validateForm()) setStep('payment');
              }}
              className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-3.5 rounded-xl transition text-base"
            >
              Continue to Payment →
            </button>
          </div>
        )}

        {/* ── STEP 3: Payment ───────────────────────────────────────────────── */}
        {step === 'payment' && selectedSlot && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <h3 className="font-semibold text-white/80 text-sm uppercase tracking-wide">Booking Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Match Date</span>
                <span className="font-medium">{formatDate(selectedSlot.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Team</span>
                <span className="font-medium">{teamName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Contact</span>
                <span className="font-medium">{contactName} · {contactPhone}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="font-semibold">Amount to Pay</span>
                <span className="font-bold text-green-400 text-lg flex items-center gap-1">
                  <IndianRupee className="w-4 h-4" />{selectedSlot.price.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Payment method toggle */}
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentMethod('upi')}
                className={`flex-1 py-2.5 rounded-xl border font-medium text-sm transition ${
                  paymentMethod === 'upi'
                    ? 'bg-green-500/20 border-green-500/50 text-green-300'
                    : 'bg-white/5 border-white/15 text-white/50 hover:border-white/30'
                }`}
              >
                UPI / QR Code
              </button>
              <button
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex-1 py-2.5 rounded-xl border font-medium text-sm transition ${
                  paymentMethod === 'razorpay'
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/15 text-white/50 hover:border-white/30'
                }`}
              >
                Pay Online (Card/Net)
              </button>
            </div>

            {/* UPI Payment */}
            {paymentMethod === 'upi' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-green-400" />
                  Pay via UPI
                </h3>

                {/* UPI QR Placeholder */}
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-4 rounded-2xl">
                    <div className="w-44 h-44 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2">
                      <QrCode className="w-16 h-16 text-gray-300" />
                      <p className="text-xs text-gray-400 text-center px-2">SCC UPI QR<br/>(Set in Admin Settings)</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-white/70 mb-1">Or pay to UPI ID</p>
                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
                      <span className="font-mono text-sm font-semibold">{UPI_ID}</span>
                      <button onClick={handleCopyUPI} className="text-green-400 hover:text-green-300 transition">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-white/40 mt-1">Name: {UPI_NAME}</p>
                  </div>
                </div>

                {/* Screenshot upload */}
                <div>
                  <p className="text-sm font-medium text-white/80 mb-2">
                    Upload Payment Screenshot <span className="text-white/40">(recommended)</span>
                  </p>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      screenshotPreview
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-white/20 hover:border-white/40 bg-white/5'
                    }`}
                  >
                    {screenshotPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={screenshotPreview} alt="screenshot" className="max-h-32 rounded-lg object-contain" />
                        <p className="text-xs text-green-400">Screenshot uploaded · Tap to change</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-white/50">
                        <Upload className="w-6 h-6" />
                        <p className="text-sm">Tap to upload payment screenshot</p>
                        <p className="text-xs">JPG, PNG · Max 5MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            )}

            {/* Razorpay fallback */}
            {paymentMethod === 'razorpay' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-3">
                <div className="text-4xl">💳</div>
                <p className="font-medium">Pay Online</p>
                <p className="text-sm text-white/60">
                  You'll be redirected to a secure payment page to pay ₹{selectedSlot.price.toLocaleString('en-IN')} via card, net banking, or UPI apps.
                </p>
                <p className="text-xs text-white/40">
                  Booking will be marked as paid and sent to SCC admin for confirmation.
                </p>
              </div>
            )}

            {/* Note */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">
                Booking is confirmed only after SCC admin verifies payment. You'll receive a WhatsApp confirmation on {contactPhone}.
              </p>
            </div>

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 font-medium transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Success ───────────────────────────────────────────────── */}
        {step === 'success' && selectedSlot && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Booking Request Sent!</h2>
              <p className="text-green-200/70">
                Your match booking request has been submitted to SCC. We'll verify your payment and confirm shortly.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Booking ID</span>
                <span className="font-mono text-xs text-green-400">{bookingId?.slice(0, 8).toUpperCase()}…</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Match Date</span>
                <span className="font-medium">{formatDate(selectedSlot.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Team</span>
                <span className="font-medium">{teamName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Amount</span>
                <span className="font-medium text-green-400">₹{selectedSlot.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
              <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-300">What happens next?</p>
                <ol className="text-xs text-blue-200/70 mt-1 space-y-1 list-decimal list-inside">
                  <li>SCC admin reviews your booking & payment</li>
                  <li>You'll receive a WhatsApp confirmation on {contactPhone}</li>
                  <li>Match is officially scheduled on our app</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 font-semibold text-white transition"
              >
                Book Another Match
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-white/30 space-y-1 pb-8">
          <p>Sangria Cricket Club · Powered by SCC App</p>
          <p>Questions? WhatsApp us at <span className="text-green-400/70">+91 XXXXX XXXXX</span></p>
        </div>
      </main>
    </div>
  );
}
