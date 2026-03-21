import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Season, GroundBooking, SeasonFundTarget, SeasonFundPayment, MemberTier, FundPaymentMethod } from '../types';

export function useSeasonFund() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [payments, setPayments] = useState<SeasonFundPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeasons = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('seasons')
        .select(`
          *,
          bookings:ground_bookings(*, match:matches(id, date, venue, opponent, result)),
          targets:season_fund_targets(*, member:members(id, name, avatar_url, status))
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSeasons(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch seasons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // Active season (status='active', or first one)
  const activeSeason = useMemo(() => {
    return seasons.find(s => s.status === 'active') || seasons[0] || null;
  }, [seasons]);

  // ---- Season CRUD ----
  const addSeason = async (season: Omit<Season, 'id' | 'created_at' | 'bookings' | 'targets'>) => {
    try {
      const { error } = await supabase.from('seasons').insert([season]);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add season');
    }
  };

  const updateSeason = async (id: string, updates: Partial<Season>) => {
    try {
      const { error } = await supabase.from('seasons').update(updates).eq('id', id);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update season');
    }
  };

  const deleteSeason = async (id: string) => {
    try {
      const { error } = await supabase.from('seasons').delete().eq('id', id);
      if (error) throw error;
      setSeasons(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete season');
    }
  };

  // ---- Booking CRUD ----
  const addBooking = async (booking: Omit<GroundBooking, 'id' | 'created_at' | 'match'>) => {
    try {
      const { error } = await supabase.from('ground_bookings').insert([booking]);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add booking');
    }
  };

  const updateBooking = async (id: string, updates: Partial<GroundBooking>) => {
    try {
      const { error } = await supabase.from('ground_bookings').update(updates).eq('id', id);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update booking');
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      const { error } = await supabase.from('ground_bookings').delete().eq('id', id);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete booking');
    }
  };

  // ---- Target Management ----
  const setMemberTargets = async (
    seasonId: string,
    targets: { member_id: string; target_amount: number; tier: MemberTier }[]
  ) => {
    try {
      const rows = targets.map(t => ({
        season_id: seasonId,
        member_id: t.member_id,
        target_amount: t.target_amount,
        tier: t.tier,
      }));
      const { error } = await supabase
        .from('season_fund_targets')
        .upsert(rows, { onConflict: 'season_id,member_id' });
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to set member targets');
    }
  };

  const updateMemberTarget = async (id: string, updates: Partial<SeasonFundTarget>) => {
    try {
      const { error } = await supabase.from('season_fund_targets').update(updates).eq('id', id);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update target');
    }
  };

  const removeMemberTarget = async (id: string) => {
    try {
      const { error } = await supabase.from('season_fund_targets').delete().eq('id', id);
      if (error) throw error;
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove target');
    }
  };

  // ---- Payment CRUD ----
  const fetchPayments = useCallback(async (seasonId: string) => {
    try {
      const { data, error } = await supabase
        .from('season_fund_payments')
        .select('*, member:members(id, name, avatar_url)')
        .eq('season_id', seasonId)
        .order('date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payments');
    }
  }, []);

  const addPayment = async (payment: {
    season_id: string;
    member_id: string;
    amount: number;
    date: string;
    payment_method: FundPaymentMethod;
    description?: string;
  }) => {
    try {
      const { error } = await supabase.from('season_fund_payments').insert([payment]);
      if (error) throw error;
      await fetchPayments(payment.season_id);
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add payment');
    }
  };

  const deletePayment = async (id: string, _seasonId: string) => {
    try {
      const { error } = await supabase.from('season_fund_payments').delete().eq('id', id);
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== id));
      await fetchSeasons();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete payment');
    }
  };

  // ---- Computed Helpers ----
  const getSeasonStats = useCallback((season: Season) => {
    const bookings = season.bookings || [];
    const activeBookings = bookings.filter(b => b.status !== 'cancelled');
    const totalSpent = activeBookings.reduce((sum, b) => sum + Number(b.cost), 0);
    const paidBookings = activeBookings.filter(b => b.payment_status === 'paid');
    const pendingBookings = activeBookings.filter(b => b.payment_status === 'pending');

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const targets = season.targets || [];
    const totalTarget = targets.reduce((sum, t) => sum + Number(t.target_amount), 0);

    return {
      totalBudget: Number(season.total_budget),
      totalCollected,
      totalSpent,
      totalTarget,
      outstanding: totalTarget - totalCollected,
      bookingCount: activeBookings.length,
      paidBookingCount: paidBookings.length,
      pendingBookingCount: pendingBookings.length,
      groundOwnerPaid: paidBookings.reduce((sum, b) => sum + Number(b.cost), 0),
      groundOwnerPending: pendingBookings.reduce((sum, b) => sum + Number(b.cost), 0),
    };
  }, [payments]);

  const getMemberFundStatus = useCallback((seasonId: string, memberId: string) => {
    const season = seasons.find(s => s.id === seasonId);
    const target = season?.targets?.find(t => t.member_id === memberId);
    const memberPayments = payments.filter(p => p.member_id === memberId);
    const paid = memberPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const targetAmount = target ? Number(target.target_amount) : 0;

    return {
      target: targetAmount,
      paid,
      outstanding: targetAmount - paid,
      tier: target?.tier || 'other' as MemberTier,
      paymentCount: memberPayments.length,
    };
  }, [seasons, payments]);

  const getVenueBreakdown = useCallback((season: Season) => {
    const bookings = (season.bookings || []).filter(b => b.status !== 'cancelled');
    const venueMap = new Map<string, { count: number; totalCost: number; paid: number; pending: number }>();

    for (const b of bookings) {
      const existing = venueMap.get(b.venue) || { count: 0, totalCost: 0, paid: 0, pending: 0 };
      existing.count++;
      existing.totalCost += Number(b.cost);
      if (b.payment_status === 'paid') existing.paid += Number(b.cost);
      else existing.pending += Number(b.cost);
      venueMap.set(b.venue, existing);
    }

    return Array.from(venueMap.entries()).map(([venue, data]) => ({
      venue,
      ...data,
    }));
  }, []);

  return {
    seasons,
    payments,
    loading,
    error,
    activeSeason,
    fetchSeasons,
    addSeason,
    updateSeason,
    deleteSeason,
    addBooking,
    updateBooking,
    deleteBooking,
    setMemberTargets,
    updateMemberTarget,
    removeMemberTarget,
    fetchPayments,
    addPayment,
    deletePayment,
    getSeasonStats,
    getMemberFundStatus,
    getVenueBreakdown,
  };
}
