import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PaymentOrder } from '../types';

export function usePaymentOrders() {
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_orders')
        .select(`
          *,
          member:members(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentOrders();
  }, [fetchPaymentOrders]);

  return { paymentOrders, loading, error, fetchPaymentOrders };
}
