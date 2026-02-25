import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const data = encoder.encode(`${orderId}|${paymentId}`)
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data)
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return expectedSignature === signature
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing payment verification fields')
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    // Verify the payment signature
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpayKeySecret
    )

    if (!isValid) {
      throw new Error('Invalid payment signature')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the payment order
    const { data: paymentOrder, error: fetchError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .single()

    if (fetchError || !paymentOrder) {
      throw new Error('Payment order not found')
    }

    // Idempotency: if already paid, return success
    if (paymentOrder.status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: 'Payment already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update payment order status
    const { error: updateOrderError } = await supabase
      .from('payment_orders')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentOrder.id)

    if (updateOrderError) {
      throw new Error(`Failed to update order: ${updateOrderError.message}`)
    }

    // Get member's current balance
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('balance')
      .eq('id', paymentOrder.member_id)
      .single()

    if (memberError || !member) {
      throw new Error('Member not found')
    }

    // Update member balance
    const { error: balanceError } = await supabase
      .from('members')
      .update({ balance: member.balance + paymentOrder.amount })
      .eq('id', paymentOrder.member_id)

    if (balanceError) {
      throw new Error(`Failed to update balance: ${balanceError.message}`)
    }

    // Create transaction record
    const { error: txnError } = await supabase
      .from('transactions')
      .insert({
        date: new Date().toISOString().split('T')[0],
        type: 'deposit',
        amount: paymentOrder.amount,
        member_id: paymentOrder.member_id,
        description: 'Online payment via Razorpay',
      })

    if (txnError) {
      throw new Error(`Failed to create transaction: ${txnError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and balance updated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
