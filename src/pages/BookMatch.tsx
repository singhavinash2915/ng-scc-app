import { useState, useEffect, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { supabase } from '../lib/supabase';
import { useMatchBookings } from '../hooks/useMatchBookings';
import { useGroundSettings } from '../hooks/useGroundSettings';
import type { MatchSlot } from '../types';
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
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
  Trophy,
  Share2,
  Download,
  Star,
  MapPin,
  MessageCircle,
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────
// UPI ID and QR code are loaded from app_configs (admin-editable in Settings).
// These defaults are used only as a safety net if config hasn't been saved yet.
const UPI_FALLBACK_ID   = 'scc.cricket@upi';
const UPI_FALLBACK_NAME = 'Sangria Cricket Club';
const WA_NUMBER = '918888546860';   // WhatsApp number without +
const BOOKING_PAGE_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/book-match`
  : 'https://scc.app/book-match';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}
function getDayName(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short' });
}

// Pull the numeric CricHeroes team id out of whatever the user pastes — a full
// profile link, a team-profile path, or just the bare id number.
function extractTeamId(input: string): string | null {
  const s = (input || '').trim();
  const path = s.match(/team-profile\/(\d+)/);
  if (path) return path[1];
  if (/^\d{3,}$/.test(s)) return s;
  const anyNum = s.match(/(\d{4,})/);
  return anyNum ? anyNum[1] : null;
}

// Dates reserved for the Sangria Internal League (no external bookings).
// Cadence = one internal game per week across three weeks:
//   • Months WITH Saturdays → 2nd Saturday, 3rd Thursday, 4th Saturday
//   • Months with NO Saturdays → 2nd & 4th Tuesday
// Derived from the available slots so it stays correct as new months are added.
function computeReservedDates(slots: MatchSlot[]): Set<string> {
  const reserved = new Set<string>();
  const dow = (d: string) => new Date(d + 'T00:00:00').getDay(); // 2=Tue, 4=Thu, 6=Sat
  const byMonth: Record<string, MatchSlot[]> = {};
  slots.forEach(s => { const k = s.date.slice(0, 7); (byMonth[k] ||= []).push(s); });

  for (const key of Object.keys(byMonth)) {
    const ms = byMonth[key];
    const last = <T,>(arr: T[]) => arr[arr.length - 1];
    const sats = ms.filter(s => s.day_type === 'saturday').sort((a, b) => a.date.localeCompare(b.date));
    if (sats.length > 0) {
      // 2nd & 4th Saturday (fall back to the last available if fewer)
      [sats[1] ?? last(sats), sats[3] ?? last(sats)].forEach(s => s && reserved.add(s.date));
      // 3rd Thursday of the month
      const thu = ms.filter(s => s.day_type === 'weekday' && dow(s.date) === 4).sort((a, b) => a.date.localeCompare(b.date));
      if (thu.length) reserved.add((thu[2] ?? last(thu)).date);
    } else {
      // no Saturdays this month → 2nd & 4th Tuesday
      const tue = ms.filter(s => s.day_type === 'weekday' && dow(s.date) === 2).sort((a, b) => a.date.localeCompare(b.date));
      [tue[1] ?? last(tue), tue[3] ?? last(tue)].forEach(s => s && reserved.add(s.date));
    }
  }
  return reserved;
}

// ─── Ground Photo Carousel — auto-rotates + clickable thumbnails/dots ────────
function GroundPhotoCarousel({
  photos,
  groundName,
  groundAddress,
  intervalMs = 4000,
}: {
  photos: string[];
  groundName?: string | null;
  groundAddress?: string | null;
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance
  useEffect(() => {
    if (photos.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % photos.length), intervalMs);
    return () => clearInterval(t);
  }, [photos.length, paused, intervalMs]);

  // Reset index if photo list shrinks
  useEffect(() => {
    if (idx >= photos.length) setIdx(0);
  }, [photos.length, idx]);

  if (!photos.length) return null;

  const goTo = (i: number) => {
    setIdx(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 8000); // resume autoplay after 8s of idle
  };
  const prev = () => goTo((idx - 1 + photos.length) % photos.length);
  const next = () => goTo((idx + 1) % photos.length);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Main hero */}
      <div className="relative group">
        {/* All images stacked, cross-fade between them */}
        <div className="relative w-full h-44 sm:h-52 overflow-hidden bg-gray-100">
          {photos.map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt={groundName || `Ground photo ${i + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                i === idx ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />

        {/* Home Ground badge */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
          <MapPin className="w-3 h-3 text-primary-600" />
          <span className="text-[11px] font-bold text-gray-900">Home Ground</span>
        </div>

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
            {idx + 1} / {photos.length}
          </div>
        )}

        {/* Title + address */}
        <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
          <h3 className="text-white font-bold text-lg drop-shadow-md">{groundName || 'SCC Ground'}</h3>
          {groundAddress && <p className="text-white/90 text-xs mt-0.5 drop-shadow-md line-clamp-1">{groundAddress}</p>}
        </div>

        {/* Prev / Next arrows (visible on hover for desktop, always on mobile) */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-opacity opacity-70 group-hover:opacity-100 sm:opacity-0"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-opacity opacity-70 group-hover:opacity-100 sm:opacity-0"
              aria-label="Next photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && photos.length <= 8 && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80 w-1.5'
                }`}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip (clickable) */}
      {photos.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => goTo(i)}
              className={`h-14 w-20 rounded-lg overflow-hidden flex-shrink-0 border transition-all ${
                i === idx
                  ? 'border-primary-500 ring-2 ring-primary-500/30'
                  : 'border-gray-200 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Input classes ────────────────────────────────────────────────────────────
const inputCls = (err?: boolean) =>
  `w-full bg-white border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition text-sm ${err ? 'border-red-400' : 'border-gray-200 hover:border-gray-300'}`;
const iconInputCls = (err?: boolean) =>
  `w-full bg-white border rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition text-sm ${err ? 'border-red-400' : 'border-gray-200 hover:border-gray-300'}`;

type BookingStep = 'calendar' | 'form' | 'payment' | 'success';

// ─── Match Card (downloadable confirmation) ───────────────────────────────────
function MatchCard({
  cardRef, date, teamName, bookingId, amount, slotType,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  date: string; teamName: string; bookingId: string; amount: number; slotType: string;
}) {
  return (
    <div
      ref={cardRef}
      style={{
        width: 320, background: 'linear-gradient(135deg,#064e3b,#065f46,#047857)',
        borderRadius: 20, overflow: 'hidden', fontFamily: 'system-ui,sans-serif',
        color: '#fff', padding: 24, position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900 }}>
          🏏
        </div>
        <div>
          <div style={{ fontWeight:900, fontSize:15 }}>Match Booking Confirmed</div>
          <div style={{ fontSize:11, opacity:0.7 }}>Sangria Cricket Club · Season 2026–27</div>
        </div>
      </div>

      {/* Teams */}
      <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
        <div style={{ fontSize:11, opacity:0.6, marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Match</div>
        <div style={{ fontSize:18, fontWeight:900 }}>{teamName}</div>
        <div style={{ fontSize:13, opacity:0.6, margin:'4px 0' }}>vs</div>
        <div style={{ fontSize:18, fontWeight:900 }}>SCC – Sangria Cricket Club</div>
      </div>

      {/* Details */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { label:'Date', value: formatShortDate(date) },
          { label:'Slot', value: slotType === 'saturday' ? 'Saturday' : 'Weekday' },
          { label:'Amount Paid', value:`₹${amount.toLocaleString('en-IN')}` },
          { label:'Booking ID', value: bookingId.slice(0,8).toUpperCase() },
        ].map(({ label, value }) => (
          <div key={label} style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:9, opacity:0.5, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign:'center', fontSize:10, opacity:0.4 }}>
        scc.app · Sangria Cricket Club
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function BookMatch() {
  const { slots, loading, fetchSlots, createBooking } = useMatchBookings();
  const { ground, testimonials, upi, fetchSettings } = useGroundSettings();
  const upiId   = upi.upi_id   || UPI_FALLBACK_ID;
  const upiName = upi.upi_name || UPI_FALLBACK_NAME;
  const qrUrl   = upi.qr_code_url;

  // Trust-builder data
  const [sccRecord, setSccRecord] = useState<{ wins:number; losses:number; draws:number } | null>(null);
  const [matchPhotos, setMatchPhotos] = useState<string[]>([]);
  const [, setLoadingTrust] = useState(true);

  // Step state
  const [step, setStep] = useState<BookingStep>('calendar');
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  // Form fields
  const [teamName, setTeamName]       = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [chTeamId, setChTeamId]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi'|'razorpay'>('upi');
  const [screenshotFile, setScreenshotFile]   = useState<File|null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string|null>(null);
  const [formErrors, setFormErrors]   = useState<Record<string,string>>({});
  const [paymentError, setPaymentError] = useState<string|null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [bookingId, setBookingId]     = useState<string|null>(null);
  const [submitError, setSubmitError] = useState<string|null>(null);
  const [copied, setCopied]           = useState(false);
  const [autoVerified, setAutoVerified] = useState(false);
  const [validationReason, setValidationReason] = useState<string|null>(null);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef      = useRef<HTMLDivElement>(null);

  // Fetch slots + ground settings
  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Fetch trust-builder data (SCC record + recent photos)
  useEffect(() => {
    (async () => {
      setLoadingTrust(true);
      try {
        // Current-season external match results (same window the Dashboard uses)
        const SEASON_START = '2025-10-01';
        const SEASON_END   = '2026-09-30';
        const { data: matches } = await supabase
          .from('matches')
          .select('result')
          .eq('match_type', 'external')
          .in('result', ['won','lost','draw'])
          .gte('date', SEASON_START)
          .lte('date', SEASON_END)
          .order('date', { ascending: false });

        if (matches) {
          setSccRecord({
            wins:   matches.filter(m => m.result === 'won').length,
            losses: matches.filter(m => m.result === 'lost').length,
            draws:  matches.filter(m => m.result === 'draw').length,
          });
        }

        // Recent match photos
        const { data: photos } = await supabase
          .from('match_photos')
          .select('photo_url')
          .order('created_at', { ascending: false })
          .limit(8);

        if (photos) setMatchPhotos(photos.map(p => p.photo_url));
      } catch {
        // Non-critical; swallow errors
      } finally {
        setLoadingTrust(false);
      }
    })();
  }, []);

  // ─── Slot grouping ────────────────────────────────────────────────────────
  const slotsByMonth = useMemo(() => {
    const map: Record<string, MatchSlot[]> = {};
    slots.forEach(s => { const k = s.date.slice(0,7); if (!map[k]) map[k]=[]; map[k].push(s); });
    return map;
  }, [slots]);
  const reservedDates     = useMemo(() => computeReservedDates(slots), [slots]);
  const detectedTeamId    = extractTeamId(chTeamId);
  const monthKeys         = useMemo(() => Object.keys(slotsByMonth).sort(), [slotsByMonth]);
  const currentMonthKey   = monthKeys[currentMonthIndex] ?? '';
  const currentMonthSlots = slotsByMonth[currentMonthKey] ?? [];
  const monthLabel        = currentMonthKey
    ? `${MONTHS[parseInt(currentMonthKey.split('-')[1])-1]} ${currentMonthKey.split('-')[0]}`
    : '';

  function slotStatus(slot: MatchSlot): 'available'|'pending'|'booked'|'blocked'|'reserved' {
    if (!slot.is_available) {
      if (slot.booking?.status === 'confirmed') return 'booked';
      if (slot.booking?.status === 'pending')   return 'pending';
      return 'blocked';
    }
    if (reservedDates.has(slot.date)) return 'reserved';   // held for SCC internal league
    return 'available';
  }

  // ─── Validation ───────────────────────────────────────────────────────────
  function validateForm() {
    const errs: Record<string,string> = {};
    if (!teamName.trim())    errs.teamName    = 'Team name is required';
    if (!contactName.trim()) errs.contactName = 'Contact name is required';
    if (!contactPhone.trim()) errs.contactPhone = 'Phone number is required';
    else if (!/^[6-9]\d{9}$/.test(contactPhone.replace(/\s/g,'')))
      errs.contactPhone = 'Enter a valid 10-digit Indian mobile number';
    if (!chTeamId.trim()) errs.chTeamId = 'CricHeroes team link or ID is required to prevent duplicate bookings';
    else if (!extractTeamId(chTeamId)) errs.chTeamId = 'Couldn\'t read a team ID — paste your CricHeroes team link or enter the ID number';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePayment() {
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
    if (!selectedSlot || !validatePayment()) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await createBooking({
      slotId: selectedSlot.id, slotDate: selectedSlot.date, amount: selectedSlot.price,
      teamName: teamName.trim(), contactName: contactName.trim(),
      contactPhone: contactPhone.trim(), chTeamId: extractTeamId(chTeamId) || chTeamId.trim(),
      paymentMethod, screenshotFile: screenshotFile ?? undefined,
      expectedUpiId: upiId,
    });
    setSubmitting(false);
    if (result.success) {
      setBookingId(result.bookingId ?? null);
      setAutoVerified(result.autoVerified ?? false);
      setValidationReason(result.validationReason ?? null);
      setStep('success');
    }
    else setSubmitError(result.error ?? 'Booking failed. Please try again.');
  }

  function handleCopyUPI() {
    navigator.clipboard.writeText(upiId).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  async function handleDownloadCard() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2.5, cacheBust: true });
      const a = document.createElement('a');
      a.href = url; a.download = `scc-match-booking-${bookingId?.slice(0,8)}.png`; a.click();
    } catch { /* ignore */ } finally { setDownloading(false); }
  }

  function handleWhatsAppShare() {
    const dateStr = selectedSlot ? formatDate(selectedSlot.date) : '';
    const msg = encodeURIComponent(
      `🏏 Our match with Sangria Cricket Club is booked!\n\n📅 Date: ${dateStr}\n👥 ${teamName} vs SCC\n\nBook your match too: ${BOOKING_PAGE_URL}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function handleReset() {
    setStep('calendar'); setSelectedSlot(null);
    setTeamName(''); setContactName(''); setContactPhone(''); setChTeamId('');
    setPaymentMethod('upi'); setScreenshotFile(null); setScreenshotPreview(null);
    setFormErrors({}); setPaymentError(null); setSubmitError(null); setBookingId(null);
  }

  // ─── Record display ───────────────────────────────────────────────────────
  const winRate = sccRecord && (sccRecord.wins + sccRecord.losses) > 0
    ? Math.round((sccRecord.wins / (sccRecord.wins + sccRecord.losses)) * 100)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      {/* Sticky header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/scc-logo.jpg" alt="SCC" className="w-10 h-10 rounded-xl object-cover shadow ring-2 ring-primary-100" />
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight">SCC – Sangria Cricket Club</h1>
              <p className="text-xs text-primary-600 font-medium">Book a Match · Season 2026–27</p>
            </div>
          </div>
          {sccRecord && winRate !== null && (
            <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-primary-50 to-emerald-50 border border-primary-200 rounded-full px-3 py-1 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-primary-600" />
              <span className="text-xs font-semibold text-primary-700">
                {sccRecord.wins}W · {sccRecord.losses}L · {winRate}% win rate
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">

        {/* ══ CALENDAR PAGE TRUST SECTION ══════════════════════════════════ */}
        {step === 'calendar' && (
          <>
            {/* ── Premium Hero Card ─────────────────────────────────────── */}
            <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 p-6 sm:p-8 shadow-xl">
              {/* Decorative blurs */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-teal-300/10 blur-3xl" />
              {/* Cricket ball pattern */}
              <div className="absolute top-4 right-4 text-7xl opacity-[0.06] select-none">🏏</div>

              <div className="relative">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white tracking-wide uppercase">Now booking · Season 2026–27</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1.5 leading-tight">
                  Play a Match Against SCC
                </h2>
                <p className="text-emerald-50/90 text-sm sm:text-[15px] leading-relaxed max-w-md">
                  Pick a date, share your team details, pay to confirm. Verified by admin within hours.
                </p>

                {/* Mini stats row */}
                {sccRecord && (
                  <div className="flex items-center gap-2 mt-5 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-xs font-bold text-white">{winRate}% Win Rate</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-1.5">
                      <span className="text-xs text-emerald-100">
                        <span className="font-bold text-white">{sccRecord.wins}W</span> · <span className="font-bold text-white">{sccRecord.losses}L</span>
                        {sccRecord.draws > 0 && <> · <span className="font-bold text-white">{sccRecord.draws}NR</span></>}
                      </span>
                    </div>
                    {ground.name && (
                      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-1.5">
                        <MapPin className="w-3 h-3 text-emerald-200" />
                        <span className="text-xs text-white font-medium truncate max-w-[140px]">{ground.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Premium Pricing cards ────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-100 to-transparent rounded-full -translate-y-8 translate-x-8" />
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    <div className="text-[10px] sm:text-xs text-primary-600 font-bold tracking-wide uppercase">Tue · Thu</div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900">₹3,000</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Weekday match · per slot</div>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-200/60 to-transparent rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">PEAK</div>
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <div className="text-[10px] sm:text-xs text-amber-700 font-bold tracking-wide uppercase">Saturday</div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900">₹4,000</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Oct–Feb · per slot</div>
                </div>
              </div>
            </div>

            {/* ── Premium Ground details card ──────────────────────────── */}
            {((ground.image_urls?.length || ground.image_url) || ground.address || ground.facilities) && (
              <div className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Photo gallery — auto-rotating carousel with clickable thumbnails */}
                {(ground.image_urls?.length > 0 || ground.image_url) && (() => {
                  const photos: string[] = ground.image_urls?.length > 0 ? ground.image_urls : [ground.image_url!];
                  return (
                    <GroundPhotoCarousel
                      photos={photos}
                      groundName={ground.name}
                      groundAddress={ground.address}
                    />
                  );
                })()}
                <div className="p-4 sm:p-5 space-y-3">
                  {!ground.image_urls?.length && !ground.image_url && (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          {ground.name || 'SCC Ground'}
                        </h3>
                        {ground.address && <p className="text-sm text-gray-500 mt-0.5">{ground.address}</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {ground.timing && (
                        <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium">
                          🕐 {ground.timing}
                        </span>
                      )}
                      {ground.facilities && ground.facilities.split(',').slice(0, 4).map((f, i) => (
                        <span key={i} className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-2.5 py-1.5 font-medium">
                          <Check className="w-3 h-3" /> {f.trim()}
                        </span>
                      ))}
                    </div>
                    {ground.directions_url && (
                      <a
                        href={ground.directions_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 rounded-xl px-3 py-2 transition flex items-center gap-1 shadow-sm"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Get Directions
                      </a>
                    )}
                  </div>

                  {ground.notes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>{ground.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Photo strip ──────────────────────────────────────────── */}
            {matchPhotos.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <span className="w-1 h-4 bg-primary-500 rounded-full" />
                    Match Day Highlights
                  </h3>
                  <span className="text-xs text-gray-400">{matchPhotos.length} photos</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {matchPhotos.map((url, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <img
                        src={url}
                        alt={`Match photo ${i+1}`}
                        className="h-28 w-44 object-cover rounded-2xl border border-gray-200 shadow-sm group-hover:shadow-md transition-shadow"
                      />
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Trust badges row ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <div className="text-lg mb-0.5">⚡</div>
                <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Instant Reply</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Within hours</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <div className="text-lg mb-0.5">🔒</div>
                <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Secure Payment</div>
                <div className="text-[10px] text-gray-400 mt-0.5">UPI verified</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <div className="text-lg mb-0.5">🏆</div>
                <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Trusted Team</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{(sccRecord?.wins ?? 0) + (sccRecord?.losses ?? 0) + (sccRecord?.draws ?? 0)}+ matches</div>
              </div>
            </div>

            {/* Info note */}
            <p className="text-xs text-gray-500 flex items-start gap-1.5 mb-6 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>One slot per team per month. Booking confirmed after SCC admin verifies payment.</span>
            </p>
          </>
        )}

        {/* ── Step indicator ────────────────────────────────────────────────── */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-6">
            {(['calendar','form','payment'] as const).map((s, i) => {
              const order = ['calendar','form','payment'];
              const done   = order.indexOf(step) > i;
              const active = step === s;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    active ? 'bg-primary-500 border-primary-500 text-white' :
                    done   ? 'bg-primary-100 border-primary-300 text-primary-600' :
                             'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : i+1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {s==='calendar' ? 'Select Date' : s==='form' ? 'Team Details' : 'Payment'}
                  </span>
                  {i<2 && <div className={`w-8 h-px ${done ? 'bg-primary-300':'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ STEP 1: Premium Slot Calendar ═════════════════════════════════ */}
        {step === 'calendar' && (
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-md mb-8">
            {/* Gradient month nav */}
            <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-500 px-5 py-4 flex items-center justify-between">
              <button onClick={()=>setCurrentMonthIndex(i=>Math.max(0,i-1))} disabled={currentMonthIndex===0}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-30 transition text-white backdrop-blur-sm">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-emerald-100/90 font-bold mb-0.5">Select your match date</p>
                <h3 className="font-black text-white text-lg">{monthLabel || '—'}</h3>
              </div>
              <button onClick={()=>setCurrentMonthIndex(i=>Math.min(monthKeys.length-1,i+1))} disabled={currentMonthIndex===monthKeys.length-1}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-30 transition text-white backdrop-blur-sm">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap px-5 py-3 border-b border-gray-100 text-xs text-gray-600 bg-gray-50/50">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-primary-100"/>Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100"/>Pending</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-gray-100"/>Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 ring-2 ring-violet-100"/>SCC Internal</span>
            </div>

            {/* Slots */}
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500"/></div>
              ) : currentMonthSlots.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-3xl mb-2 opacity-30">📅</div>
                  <p className="text-gray-400 text-sm">No slots available this month.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {currentMonthSlots.map(slot => {
                    const status = slotStatus(slot);
                    const avail  = status === 'available';
                    const isSat  = slot.day_type === 'saturday';
                    return (
                      <button key={slot.id} disabled={!avail}
                        onClick={()=>{ setSelectedSlot(slot); setStep('form'); }}
                        className={`relative rounded-2xl p-3 text-left border-2 transition-all ${
                          avail
                            ? isSat
                              ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                              : 'bg-gradient-to-br from-primary-50 to-white border-primary-200 hover:border-primary-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                            : status==='reserved' ? 'bg-gradient-to-br from-violet-50 to-white border-violet-200 cursor-not-allowed' :
                              status==='pending' ? 'bg-amber-50/60 border-amber-200 cursor-not-allowed opacity-70' :
                                                   'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                        }`}>
                        {avail && isSat && (
                          <div className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-amber-700 bg-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">SAT</div>
                        )}
                        {status==='reserved' && (
                          <div className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-white bg-violet-500 rounded-full px-1.5 py-0.5 shadow-sm">SCC</div>
                        )}
                        <div className={`text-[10px] font-bold mb-0.5 tracking-wide uppercase ${
                          avail
                            ? isSat ? 'text-amber-600' : 'text-primary-600'
                            : status==='reserved' ? 'text-violet-500' :
                              status==='pending' ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {getDayName(slot.date)}
                        </div>
                        <div className={`font-black text-base ${avail?'text-gray-900':status==='reserved'?'text-violet-900':'text-gray-400'}`}>{formatShortDate(slot.date)}</div>
                        {status==='reserved' ? (
                          <div className="text-[10px] text-violet-600 font-bold mt-1 leading-tight">🏏 Internal League</div>
                        ) : (
                          <div className={`text-xs mt-1 font-semibold ${avail?(isSat?'text-amber-700':'text-primary-700'):'text-gray-400'}`}>
                            ₹{slot.price.toLocaleString('en-IN')}
                          </div>
                        )}
                        {status==='pending' && <div className="text-[10px] text-amber-600 font-bold mt-0.5">Pending</div>}
                        {(status==='booked'||status==='blocked') && <div className="text-[10px] text-gray-400 font-bold mt-0.5">Booked</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Month pills */}
            <div className="flex gap-1.5 px-4 pb-4 sm:px-5 sm:pb-5 flex-wrap border-t border-gray-100 pt-3.5">
              {monthKeys.map((key,idx) => {
                const label = `${MONTHS[parseInt(key.split('-')[1])-1].slice(0,3)} '${key.split('-')[0].slice(2)}`;
                return (
                  <button key={key} onClick={()=>setCurrentMonthIndex(idx)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                      idx===currentMonthIndex
                        ? 'bg-gradient-to-r from-primary-500 to-emerald-500 text-white border-primary-500 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 bg-white'
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ Premium Testimonials (calendar step) ══════════════════════════ */}
        {step === 'calendar' && testimonials.filter(t => t.active).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <span className="w-1 h-4 bg-amber-400 rounded-full" />
                Loved by Visiting Teams
              </h3>
              <div className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {testimonials.filter(t => t.active).map((t) => (
                <div key={t.id} className="relative bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="absolute top-2 left-3 text-4xl text-primary-100 font-serif leading-none select-none pointer-events-none">"</div>
                  <div className="relative">
                    <div className="flex gap-0.5 mb-2.5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3 italic">{t.text}</p>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                        {t.team.slice(0,2).toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-gray-800">{t.team}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ STEP 2: Team Details ══════════════════════════════════════════ */}
        {step === 'form' && selectedSlot && (
          <div className="space-y-4">
            {/* Slot chip */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{formatDate(selectedSlot.date)}</p>
                <p className="text-xs text-primary-600 mt-0.5">
                  {selectedSlot.day_type==='saturday'?'Saturday Slot':'Weekday Slot'} · ₹{selectedSlot.price.toLocaleString('en-IN')}
                </p>
              </div>
              <button onClick={()=>setStep('calendar')}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 bg-white rounded-lg px-3 py-1.5 transition shrink-0">
                Change
              </button>
            </div>

            {/* Form */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" /> Team Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. Mumbai Warriors CC" value={teamName}
                  onChange={e=>{ setTeamName(e.target.value); setFormErrors(f=>({...f,teamName:''})); }}
                  className={inputCls(!!formErrors.teamName)} />
                {formErrors.teamName && <p className="text-red-500 text-xs mt-1">{formErrors.teamName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Your full name" value={contactName}
                    onChange={e=>{ setContactName(e.target.value); setFormErrors(f=>({...f,contactName:''})); }}
                    className={iconInputCls(!!formErrors.contactName)} />
                </div>
                {formErrors.contactName && <p className="text-red-500 text-xs mt-1">{formErrors.contactName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Phone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" placeholder="10-digit mobile number" value={contactPhone}
                    onChange={e=>{ setContactPhone(e.target.value); setFormErrors(f=>({...f,contactPhone:''})); }}
                    className={iconInputCls(!!formErrors.contactPhone)} />
                </div>
                {formErrors.contactPhone && <p className="text-red-500 text-xs mt-1">{formErrors.contactPhone}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    CricHeroes Team — link or ID <span className="text-red-500">*</span>
                  </label>
                  <a href="https://cricheroes.com/" target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
                    Open CricHeroes <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="relative">
                  <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" inputMode="text" placeholder="Paste team link or type team ID (e.g. 12345)" value={chTeamId}
                    onChange={e=>{ setChTeamId(e.target.value); setFormErrors(f=>({...f,chTeamId:''})); }}
                    className={iconInputCls(!!formErrors.chTeamId)} />
                </div>
                {formErrors.chTeamId ? (
                  <p className="text-red-500 text-xs mt-1">{formErrors.chTeamId}</p>
                ) : detectedTeamId ? (
                  <div className="mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Team ID <strong>{detectedTeamId}</strong> detected — you're good to go.</span>
                  </div>
                ) : (
                  <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Just paste your team's CricHeroes link, or type your team ID. Tip: in the CricHeroes app → Your team → <strong>Share</strong> → Copy link. Keeps bookings one-per-team.</span>
                  </div>
                )}
              </div>
            </div>

            <button onClick={()=>{ if(validateForm()) setStep('payment'); }}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3.5 rounded-xl transition text-sm">
              Continue to Payment →
            </button>
          </div>
        )}

        {/* ══ STEP 3: Payment ═══════════════════════════════════════════════ */}
        {step === 'payment' && selectedSlot && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Match Date</span><span className="font-medium text-gray-900">{formatDate(selectedSlot.date)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Visiting Team</span><span className="font-medium text-gray-900">{teamName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Contact</span><span className="font-medium text-gray-900">{contactName}</span></div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Amount</span>
                  <span className="font-bold text-primary-600 text-lg flex items-center gap-0.5">
                    <IndianRupee className="w-4 h-4"/>₹{selectedSlot.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Method tabs */}
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              {(['upi','razorpay'] as const).map(m => (
                <button key={m} onClick={()=>{ setPaymentMethod(m); setPaymentError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    paymentMethod===m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {m==='upi' ? 'UPI / QR Code' : 'Pay Online'}
                </button>
              ))}
            </div>

            {/* UPI panel */}
            {paymentMethod==='upi' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <QrCode className="w-4 h-4 text-primary-500"/> Pay via UPI
                </h3>
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt="SCC UPI QR code"
                        className="w-40 h-40 object-contain rounded-xl bg-white"
                      />
                    ) : (
                      <div className="w-40 h-40 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2">
                        <QrCode className="w-14 h-14 text-gray-300"/>
                        <p className="text-xs text-gray-400 text-center">SCC UPI QR<br/>(Set by admin)</p>
                      </div>
                    )}
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs text-gray-500 mb-1.5">Or pay directly to UPI ID</p>
                    <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                      <span className="font-mono text-sm font-semibold text-gray-900">{upiId}</span>
                      <button onClick={handleCopyUPI} className="text-primary-500 hover:text-primary-700 transition">
                        {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Name: {upiName}</p>
                  </div>
                </div>

                {/* AI verification hint */}
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <span className="text-base flex-shrink-0">⚡</span>
                  <p className="text-[11px] text-emerald-700 leading-snug">
                    <span className="font-bold">Instant verification:</span> we check your payment screenshot automatically using AI — most bookings confirm in seconds, no waiting for admin review.
                  </p>
                </div>

                {/* Screenshot — required */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Upload Payment Screenshot <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    Pay via UPI first, then upload the screenshot. Booking won't proceed without it.
                  </p>
                  <div onClick={()=>fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      screenshotPreview ? 'border-primary-300 bg-primary-50'
                        : paymentError  ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}>
                    {screenshotPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={screenshotPreview} alt="ss" className="max-h-32 rounded-lg object-contain"/>
                        <p className="text-xs text-primary-600 font-medium">Screenshot uploaded · Tap to change</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Upload className="w-6 h-6"/>
                        <p className="text-sm font-medium text-gray-600">Tap to upload payment screenshot</p>
                        <p className="text-xs">JPG, PNG · Max 5MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                  {paymentError && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0"/> {paymentError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Razorpay panel */}
            {paymentMethod==='razorpay' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-center">
                <div className="text-4xl">💳</div>
                <p className="font-semibold text-gray-900">Pay Online</p>
                <p className="text-sm text-gray-500">
                  Submit your booking. SCC admin will send a secure payment link to <strong>{contactPhone}</strong> within a few hours.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-left flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5"/>
                  Slot is reserved for 24 hours. Booking confirmed only after payment.
                </div>
              </div>
            )}

            {/* Confirmation note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"/>
              <p className="text-xs text-blue-700">
                Booking confirmed only after SCC admin verifies payment. WhatsApp confirmation sent to {contactPhone}.
              </p>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={()=>setStep('form')}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white font-medium transition text-sm">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin"/>{paymentMethod === 'upi' ? 'Verifying payment…' : 'Submitting…'}</>
                  : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: Success ═══════════════════════════════════════════════ */}
        {step === 'success' && selectedSlot && bookingId && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${
                  autoVerified
                    ? 'bg-emerald-100 border-emerald-300'
                    : 'bg-primary-100 border-primary-300'
                }`}>
                  <CheckCircle2 className={`w-10 h-10 ${autoVerified ? 'text-emerald-500' : 'text-primary-500'}`} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {autoVerified ? 'Payment Verified! ⚡' : 'Booking Request Sent!'}
              </h2>
              <p className="text-gray-500 text-sm">
                {autoVerified
                  ? 'Your booking is confirmed — payment auto-verified in real-time.'
                  : 'SCC admin will verify your payment and confirm shortly.'}
              </p>
            </div>

            {/* AI validation result banner */}
            {paymentMethod === 'upi' && validationReason && (
              <div className={`rounded-xl px-4 py-3 text-xs border ${
                autoVerified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <p className="font-bold mb-0.5 flex items-center gap-1.5">
                  {autoVerified ? '✅ Auto-verified' : '⏳ Admin will review'}
                </p>
                <p className="text-[11px] opacity-90">{validationReason}</p>
              </div>
            )}

            {/* Confirmation card (downloadable) */}
            <div className="flex justify-center">
              <MatchCard
                cardRef={cardRef}
                date={selectedSlot.date}
                teamName={teamName}
                bookingId={bookingId}
                amount={selectedSlot.price}
                slotType={selectedSlot.day_type}
              />
            </div>

            {/* Summary text (for screen) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking ID</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                  {bookingId.slice(0,8).toUpperCase()}…
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Match Date</span>
                <span className="font-medium text-gray-900">{formatDate(selectedSlot.date)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-primary-600">₹{selectedSlot.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDownloadCard} disabled={downloading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition disabled:opacity-60">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                Download Card
              </button>
              <button onClick={handleWhatsAppShare}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition">
                <Share2 className="w-4 h-4"/> Share on WhatsApp
              </button>
            </div>

            {/* Next steps */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-semibold text-blue-800">What happens next?</p>
                <ol className="text-xs text-blue-700 mt-1.5 space-y-1 list-decimal list-inside">
                  <li>SCC admin reviews your booking & payment screenshot</li>
                  <li>WhatsApp confirmation sent to {contactPhone}</li>
                  <li>Match is scheduled on the SCC app</li>
                </ol>
              </div>
            </div>

            <button onClick={handleReset}
              className="w-full py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 font-semibold text-white transition text-sm">
              Book Another Match
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400 space-y-1 pb-8">
          <p>Sangria Cricket Club · Powered by SCC App</p>
          <p>
            Questions?{' '}
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:underline inline-flex items-center gap-1"
            >
              <MessageCircle className="w-3 h-3"/>
              WhatsApp us at +91 88885 46860
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
