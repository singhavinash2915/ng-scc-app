import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

interface PaymentResult {
  success: boolean;
  message: string;
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/** Dynamically loads the Razorpay SDK if not already loaded. */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
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
      // On native, open Razorpay in an in-app browser (SFSafariViewController / Chrome Custom Tab)
      // to avoid WebView iframe restrictions. On web, use the standard SDK modal.
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        const orderData = await createOrder(memberId, amount);

        // Build the Razorpay hosted payment page URL
        const params = new URLSearchParams({
          key: orderData.key_id,
          order_id: orderData.order_id,
          name: 'Sangria Cricket Club',
          description: `Balance deposit for ${memberName}`,
          prefill_name: memberName,
          ...(memberEmail ? { prefill_email: memberEmail } : {}),
          ...(memberPhone ? { prefill_contact: memberPhone } : {}),
          theme_color: '#10b981',
        });

        await Browser.open({
          url: `https://api.razorpay.com/v1/checkout/embedded?${params.toString()}`,
          windowName: '_self',
        });

        setLoading(false);
        // Payment result cannot be verified synchronously from the in-app browser;
        // the admin will confirm the deposit manually after receiving the Razorpay webhook.
        return { success: true, message: 'Payment page opened. Complete payment in the browser.' };
      }

      // Web: load the SDK dynamically (no longer hardcoded in index.html)
      await loadRazorpayScript();
      const orderData = await createOrder(memberId, amount);

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
