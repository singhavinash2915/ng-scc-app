import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { member_id, amount } = await req.json()

    if (!member_id || !amount || amount <= 0) {
      throw new Error('Invalid member_id or amount')
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    // Verify member exists
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name')
      .eq('id', member_id)
      .single()

    if (memberError || !member) {
      throw new Error('Member not found')
    }

    // Create Razorpay order
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: `scc_${Date.now()}`,
        notes: {
          member_id,
          member_name: member.name,
        },
      }),
    })

    if (!razorpayResponse.ok) {
      const errorBody = await razorpayResponse.text()
      throw new Error(`Razorpay API error: ${errorBody}`)
    }

    const order = await razorpayResponse.json()

    // Save to payment_orders table
    const { error: insertError } = await supabase
      .from('payment_orders')
      .insert({
        member_id,
        amount,
        razorpay_order_id: order.id,
        status: 'created',
      })

    if (insertError) {
      throw new Error(`Failed to save order: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: razorpayKeyId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
