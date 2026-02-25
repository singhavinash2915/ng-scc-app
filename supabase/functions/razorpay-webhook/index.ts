import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function verifyWebhookSignature(
  body: string,
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
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return expectedSignature === signature
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      throw new Error('Missing webhook signature')
    }

    const body = await req.text()

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, signature, webhookSecret)
    if (!isValid) {
      throw new Error('Invalid webhook signature')
    }

    const event = JSON.parse(body)

    // Only handle payment.captured events
    if (event.event !== 'payment.captured') {
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payment = event.payload.payment.entity
    const orderId = payment.order_id
    const paymentId = payment.id

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the payment order
    const { data: paymentOrder, error: fetchError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single()

    if (fetchError || !paymentOrder) {
      // Order not found — may not belong to us
      return new Response(JSON.stringify({ status: 'order_not_found' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Idempotency: if already paid, skip
    if (paymentOrder.status === 'paid') {
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update payment order
    await supabase
      .from('payment_orders')
      .update({
        razorpay_payment_id: paymentId,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentOrder.id)

    // Get member balance
    const { data: member } = await supabase
      .from('members')
      .select('balance')
      .eq('id', paymentOrder.member_id)
      .single()

    if (member) {
      // Update member balance
      await supabase
        .from('members')
        .update({ balance: member.balance + paymentOrder.amount })
        .eq('id', paymentOrder.member_id)

      // Create transaction record
      await supabase.from('transactions').insert({
        date: new Date().toISOString().split('T')[0],
        type: 'deposit',
        amount: paymentOrder.amount,
        member_id: paymentOrder.member_id,
        description: 'Online payment via Razorpay',
      })
    }

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
