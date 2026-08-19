import { generateWhatsAppUrl } from './phone';

// ─── Booking notifications over WhatsApp ───────────────────────────────────────
// The app is a static site on GitHub Pages talking to Supabase — there is no
// server of ours that could send a WhatsApp message on its own. Automatic
// sending needs the WhatsApp Business API, which means a Meta business account,
// an approved message template per notification, and a per-message fee.
//
// So these build wa.me links with the message already written: one tap sends it
// from the sender's own WhatsApp. The booker taps once when they book, and the
// admin taps once when they confirm or reject. No credentials, no cost, nothing
// to keep running — and the message comes from a real person, which for a club
// booking is friendlier than an automated one anyway.

/** Where booking requests go. */
export const SCC_ADMIN_PHONE = '+918888546860';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export interface BookingDetails {
  teamName: string;
  contactName: string;
  contactPhone: string;
  date: string;
  venue?: string | null;
  amount?: number | null;
  bookingId?: string | null;
}

/**
 * Booker → SCC admin. Sent the moment a request is submitted, so the admin
 * hears about it on the phone they actually watch rather than only in the app.
 */
export function newBookingMessage(b: BookingDetails): string {
  return [
    `🏏 *New match booking request*`,
    ``,
    `*Team:* ${b.teamName}`,
    `*Contact:* ${b.contactName} (${b.contactPhone})`,
    `*Date:* ${fmtDate(b.date)}`,
    b.venue ? `*Ground:* ${b.venue}` : null,
    b.amount ? `*Amount:* ${money(b.amount)}` : null,
    b.bookingId ? `*Ref:* ${b.bookingId.slice(0, 8).toUpperCase()}` : null,
    ``,
    `Sent from the SCC app — please confirm when you can. Thanks!`,
  ].filter(Boolean).join('\n');
}

/** SCC admin → the visiting team, once the booking is confirmed. */
export function bookingConfirmedMessage(b: BookingDetails): string {
  return [
    `✅ *Your match against Sangria CC is CONFIRMED*`,
    ``,
    `*Date:* ${fmtDate(b.date)}`,
    b.venue ? `*Ground:* ${b.venue}` : null,
    `*Time:* 7:00 AM – 9:00 AM`,
    b.amount ? `*Amount:* ${money(b.amount)}` : null,
    b.bookingId ? `*Ref:* ${b.bookingId.slice(0, 8).toUpperCase()}` : null,
    ``,
    `See you there, ${b.teamName} — bring your best XI 🏏`,
    `Any questions, just reply here.`,
  ].filter(Boolean).join('\n');
}

/**
 * SCC admin → the visiting team, when a booking can't go ahead. Says why when
 * there's a reason: "rejected" with no explanation is how you lose an opponent
 * for good.
 */
export function bookingRejectedMessage(b: BookingDetails, reason?: string): string {
  return [
    `Hi ${b.contactName}, thanks for asking to play Sangria CC.`,
    ``,
    `Unfortunately we can't take *${fmtDate(b.date)}*.`,
    reason ? `\n*Reason:* ${reason}` : null,
    ``,
    `We'd still like the game — reply here and we'll find another date that works.`,
  ].filter(Boolean).join('\n');
}

/** wa.me link to the SCC admin, carrying a new booking. */
export const notifyAdminUrl = (b: BookingDetails) =>
  generateWhatsAppUrl(SCC_ADMIN_PHONE, newBookingMessage(b));

/** wa.me link to the visiting team's contact number. */
export const notifyTeamUrl = (b: BookingDetails, kind: 'confirmed' | 'rejected', reason?: string) =>
  generateWhatsAppUrl(
    b.contactPhone,
    kind === 'confirmed' ? bookingConfirmedMessage(b) : bookingRejectedMessage(b, reason),
  );

// ─── Challenges ───────────────────────────────────────────────────────────────
// A challenge nobody knows about is a row in a table. The club lives in
// WhatsApp, not in the app, so this is what actually reaches the person you
// called out — the in-app alert only catches them if they happen to open it.

export function challengeMessage(opts: {
  from: string; contest: string; stake?: string | null;
}): string {
  return [
    `⚔️ *I've challenged you on the SCC app.*`,
    ``,
    `*Contest:* ${opts.contest}`,
    opts.stake ? `*Stake:* loser ${opts.stake}` : null,
    ``,
    `Your match performances count towards it automatically — nothing to log.`,
    `Accept it here: sangriacricket.club/challenges`,
    ``,
    `— ${opts.from}`,
  ].filter(Boolean).join('\n');
}

/** wa.me link to the person being challenged. Null if we have no number. */
export const challengeUrl = (
  phone: string | null | undefined,
  opts: { from: string; contest: string; stake?: string | null },
) => (phone ? generateWhatsAppUrl(phone, challengeMessage(opts)) : null);
