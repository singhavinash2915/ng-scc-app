import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PaymentResult {
  success: boolean;
  message: string;
}

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (memberId: string, amount: number) => {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { member_id: memberId, amount },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const verifyPayment = async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ): Promise<PaymentResult> => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const initiatePayment = async (
    memberId: string,
    memberName: string,
    memberEmail: string | null,
    memberPhone: string | null,
    amount: number
  ): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create order via Edge Function
      const orderData = await createOrder(memberId, amount);

      // Step 2: Open Razorpay checkout
      return new Promise((resolve) => {
        const options: RazorpayOptions = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Sangria Cricket Club',
          description: `Balance deposit for ${memberName}`,
          order_id: orderData.order_id,
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              // Step 3: Verify payment via Edge Function
              const result = await verifyPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
              setLoading(false);
              resolve(result);
            } catch (err) {
              setLoading(false);
              const message = err instanceof Error ? err.message : 'Payment verification failed';
              setError(message);
              resolve({ success: false, message });
            }
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              resolve({ success: false, message: 'Payment cancelled' });
            },
          },
          prefill: {
            name: memberName,
            ...(memberEmail ? { email: memberEmail } : {}),
            ...(memberPhone ? { contact: memberPhone } : {}),
          },
          theme: {
            color: '#10b981',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      });
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      return { success: false, message };
    }
  };

  return {
    initiatePayment,
    loading,
    error,
  };
}
