import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchSlot, MatchBooking, MatchBookingStatus } from '../types';

export function useMatchBookings() {
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [bookings, setBookings] = useState<MatchBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch all slots with their active booking (if any) ───────────────────
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('match_slots')
        .select(`
          *,
          booking:match_bookings(
            id, slot_id, team_name, contact_name, contact_phone,
            status, payment_status, amount, created_at
          )
        `)
        .order('date', { ascending: true });

      if (err) throw err;

      // Each slot may have multiple bookings — pick the most-relevant active one
      const normalised: MatchSlot[] = (data || []).map((row: MatchSlot & { booking: MatchBooking[] | null }) => {
        const bookingArr = Array.isArray(row.booking) ? row.booking : [];
        const active = bookingArr.find(b => b.status === 'confirmed')
          ?? bookingArr.find(b => b.status === 'pending')
          ?? bookingArr[0];
        return { ...row, booking: active };
      });

      setSlots(normalised);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch all bookings (for admin view) ──────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('match_bookings')
        .select(`
          *,
          slot:match_slots(id, date, day_type, price)
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setBookings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Check one-booking-per-month rule ─────────────────────────────────────
  // Uses CricHeroes Team ID as the primary stable team identifier.
  // Phone is a secondary check. Filters by the slot's actual DATE month
  // (not booking creation date) to correctly enforce the monthly limit.
  const checkMonthlyLimit = async (
    phone: string,
    chTeamId: string,    // Required — stable per team
    slotDate: string
  ): Promise<{ allowed: boolean; reason?: string }> => {
    const yearMonth = slotDate.slice(0, 7); // e.g. "2026-10"

    // --- Primary check: CricHeroes Team ID ---
    // This is the reliable team identifier that doesn't change when someone swaps phones
    const { data: byChId } = await supabase
      .from('match_bookings')
      .select('id, cricheroes_team_id, slot:match_slots(date)')
      .eq('cricheroes_team_id', chTeamId)
      .in('status', ['pending', 'confirmed']);

    if (byChId && byChId.length > 0) {
      const inSameMonth = (byChId as Array<{ slot?: { date?: string } }>).some(b => {
        const d = b.slot?.date;
        return d && d.startsWith(yearMonth);
      });
      if (inSameMonth) {
        return {
          allowed: false,
          reason: 'This CricHeroes team already has a match booked this month. One slot per team per month is allowed.',
        };
      }
    }

    // --- Secondary check: phone number (catches teams without CricHeroes or duplicates) ---
    const { data: byPhone } = await supabase
      .from('match_bookings')
      .select('id, contact_phone, slot:match_slots(date)')
      .eq('contact_phone', phone)
      .in('status', ['pending', 'confirmed']);

    if (byPhone && byPhone.length > 0) {
      const inSameMonth = (byPhone as Array<{ slot?: { date?: string } }>).some(b => {
        const d = b.slot?.date;
        return d && d.startsWith(yearMonth);
      });
      if (inSameMonth) {
        return {
          allowed: false,
          reason: 'This phone number is already associated with a booking this month. One slot per team per month is allowed.',
        };
      }
    }

    return { allowed: true };
  };

  // ─── Create a booking (public, no auth needed) ────────────────────────────
  const createBooking = async (params: {
    slotId: string;
    slotDate: string;
    amount: number;
    teamName: string;
    contactName: string;
    contactPhone: string;
    chTeamId: string;       // Required
    paymentMethod: 'upi' | 'razorpay';
    screenshotFile?: File;  // Required for UPI
    expectedUpiId?: string; // SCC's UPI ID — for auto-validation
  }): Promise<{
    success: boolean;
    bookingId?: string;
    error?: string;
    autoVerified?: boolean;
    validationReason?: string;
  }> => {
    try {
      // Monthly limit check (CricHeroes ID is now always provided)
      const limitCheck = await checkMonthlyLimit(params.contactPhone, params.chTeamId, params.slotDate);
      if (!limitCheck.allowed) {
        return { success: false, error: limitCheck.reason };
      }

      // Verify slot is still available
      const { data: slot } = await supabase
        .from('match_slots')
        .select('id, is_available')
        .eq('id', params.slotId)
        .single();

      if (!slot?.is_available) {
        return { success: false, error: 'This slot is no longer available. Please choose another date.' };
      }

      // Upload payment screenshot if provided
      let screenshotUrl: string | null = null;
      if (params.screenshotFile) {
        const ext = params.screenshotFile.name.split('.').pop() || 'jpg';
        const filename = `booking_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('booking-payments')
          .upload(filename, params.screenshotFile, { upsert: true });

        if (uploadErr) throw new Error('Failed to upload payment screenshot: ' + uploadErr.message);

        const { data: { publicUrl } } = supabase.storage
          .from('booking-payments')
          .getPublicUrl(filename);
        screenshotUrl = publicUrl;
      }

      // Auto-validate UPI payment screenshot via Claude Vision (best-effort,
      // never blocks the booking — admin can still review manually if AI is
      // unsure or unavailable).
      let validation: { verdict: 'verified' | 'needs_review' | 'rejected'; reason: string; extracted: unknown } | null = null;
      if (screenshotUrl && params.paymentMethod === 'upi' && params.expectedUpiId) {
        try {
          const { data: fnData } = await supabase.functions.invoke('validate-payment-screenshot', {
            body: {
              screenshotUrl,
              expectedAmount: params.amount,
              expectedUpiId: params.expectedUpiId,
            },
          });
          if (fnData?.verdict) validation = fnData;
        } catch {
          // Silent fallback — admin will verify
        }
      }

      const autoVerified = validation?.verdict === 'verified';

      // Insert booking
      const { data: booking, error: bookErr } = await supabase
        .from('match_bookings')
        .insert([{
          slot_id: params.slotId,
          team_name: params.teamName,
          contact_name: params.contactName,
          contact_phone: params.contactPhone,
          cricheroes_team_id: params.chTeamId,
          payment_method: params.paymentMethod,
          payment_screenshot_url: screenshotUrl,
          payment_status: autoVerified ? 'verified' : (screenshotUrl ? 'paid' : 'pending'),
          status: 'pending',
          amount: params.amount,
          payment_validation: validation,
          payment_validated_at: validation ? new Date().toISOString() : null,
          payment_auto_verified: autoVerified,
        }])
        .select()
        .single();

      if (bookErr) throw bookErr;

      // Mark slot as reserved
      await supabase
        .from('match_slots')
        .update({ is_available: false })
        .eq('id', params.slotId);

      return {
        success: true,
        bookingId: booking.id,
        autoVerified,
        validationReason: validation?.reason,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Booking failed' };
    }
  };

  // ─── Admin: book a slot on behalf of a team ───────────────────────────────
  // For teams that contact the admin directly (phone / WhatsApp) instead of
  // using the public booking page. Skips the payment-screenshot flow and the
  // monthly-limit guard (admin is making the call deliberately). Can optionally
  // confirm + create the match in the same step.
  const createAdminBooking = async (params: {
    slotId: string;
    slotDate: string;
    amount: number;
    teamName: string;
    contactName: string;
    contactPhone: string;
    chTeamId?: string;
    paymentStatus: 'pending' | 'paid' | 'verified';
    confirmNow: boolean;   // confirm + create match immediately
    venue?: string;
    adminNotes?: string;
  }): Promise<{ success: boolean; bookingId?: string; matchId?: string; error?: string }> => {
    try {
      // Verify slot is still available
      const { data: slot } = await supabase
        .from('match_slots')
        .select('id, is_available')
        .eq('id', params.slotId)
        .single();

      if (!slot?.is_available) {
        return { success: false, error: 'This slot is no longer available. Please choose another date.' };
      }

      const notePrefix = 'Booked by admin (team contacted directly).';
      const fullNote = params.adminNotes ? `${notePrefix} ${params.adminNotes}` : notePrefix;

      // Insert the booking
      const { data: booking, error: bookErr } = await supabase
        .from('match_bookings')
        .insert([{
          slot_id: params.slotId,
          team_name: params.teamName,
          contact_name: params.contactName,
          contact_phone: params.contactPhone,
          cricheroes_team_id: params.chTeamId || null,
          payment_method: 'upi',
          payment_screenshot_url: null,
          payment_status: params.paymentStatus,
          status: params.confirmNow ? 'confirmed' : 'pending',
          amount: params.amount,
          admin_notes: fullNote,
          confirmed_at: params.confirmNow ? new Date().toISOString() : null,
        }])
        .select()
        .single();

      if (bookErr) throw bookErr;

      // Reserve the slot
      await supabase
        .from('match_slots')
        .update({ is_available: false })
        .eq('id', params.slotId);

      let matchId: string | undefined;

      // Optionally create the upcoming match right away
      if (params.confirmNow) {
        const { data: match, error: matchErr } = await supabase
          .from('matches')
          .insert([{
            date: params.slotDate,
            opponent: params.teamName,
            venue: params.venue?.trim() || 'TBD',
            result: 'upcoming',
            match_type: 'external',
            match_fee: 0,
            ground_cost: params.amount,
            other_expenses: 0,
            deduct_from_balance: false,
            notes: `${fullNote} Contact: ${params.contactName} (${params.contactPhone})${params.chTeamId ? ` · CricHeroes: ${params.chTeamId}` : ''}`,
            polling_enabled: false,
          }])
          .select()
          .single();

        if (matchErr) throw matchErr;
        matchId = match.id;

        await supabase
          .from('match_bookings')
          .update({ match_id: match.id })
          .eq('id', booking.id);
      }

      await fetchBookings();
      return { success: true, bookingId: booking.id, matchId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create booking' };
    }
  };

  // ─── Admin: update booking status ─────────────────────────────────────────
  const updateBookingStatus = async (
    bookingId: string,
    status: MatchBookingStatus,
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const updates: Record<string, unknown> = { status, admin_notes: adminNotes ?? null };
      if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();

      const { error: err } = await supabase
        .from('match_bookings')
        .update(updates)
        .eq('id', bookingId);

      if (err) throw err;

      // Release slot if rejected or cancelled
      if (status === 'rejected' || status === 'cancelled') {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking?.slot_id) {
          await supabase
            .from('match_slots')
            .update({ is_available: true })
            .eq('id', booking.slot_id);
        }
      }

      await fetchBookings();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update booking' };
    }
  };

  // ─── Admin: confirm booking + auto-create match ───────────────────────────
  const confirmBookingAndCreateMatch = async (
    bookingId: string,
    adminNotes?: string
  ): Promise<{ success: boolean; matchId?: string; error?: string }> => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return { success: false, error: 'Booking not found' };

      const slotDate = booking.slot?.date;
      if (!slotDate) return { success: false, error: 'Slot date not found' };

      // Create the match
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .insert([{
          date: slotDate,
          opponent: booking.team_name,
          venue: 'TBD',
          result: 'upcoming',
          match_type: 'external',
          match_fee: 0,
          ground_cost: booking.amount,
          other_expenses: 0,
          deduct_from_balance: false,
          notes: `Booked via SCC Match Booking. Contact: ${booking.contact_name} (${booking.contact_phone})${booking.cricheroes_team_id ? ` · CricHeroes: ${booking.cricheroes_team_id}` : ''}`,
          polling_enabled: false,
        }])
        .select()
        .single();

      if (matchErr) throw matchErr;

      // Update booking to confirmed
      const { error: updErr } = await supabase
        .from('match_bookings')
        .update({
          status: 'confirmed',
          payment_status: 'verified',
          match_id: match.id,
          admin_notes: adminNotes ?? null,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (updErr) throw updErr;

      await fetchBookings();
      return { success: true, matchId: match.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to confirm booking' };
    }
  };

  // ─── Admin: hard-delete a booking (for testing / duplicates) ──────────────
  const deleteBooking = async (
    bookingId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const booking = bookings.find(b => b.id === bookingId);

      // Delete the booking row (cascade removes nothing, but we release the slot)
      const { error: err } = await supabase
        .from('match_bookings')
        .delete()
        .eq('id', bookingId);

      if (err) throw err;

      // Release the slot if it was pending/confirmed
      if (booking?.slot_id && (booking.status === 'pending' || booking.status === 'confirmed')) {
        await supabase
          .from('match_slots')
          .update({ is_available: true })
          .eq('id', booking.slot_id);
      }

      await fetchBookings();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
    }
  };

  // ─── Admin: toggle slot availability manually ──────────────────────────────
  const toggleSlotAvailability = async (slotId: string, available: boolean) => {
    await supabase.from('match_slots').update({ is_available: available }).eq('id', slotId);
    await fetchSlots();
  };

  return {
    slots,
    bookings,
    loading,
    error,
    fetchSlots,
    fetchBookings,
    createBooking,
    createAdminBooking,
    updateBookingStatus,
    confirmBookingAndCreateMatch,
    deleteBooking,
    toggleSlotAvailability,
  };
}
