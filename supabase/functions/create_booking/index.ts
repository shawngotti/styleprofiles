// Batch 8 — create_booking Edge Function (now with deposit PaymentIntent).
// 1) atomic booking via the public.create_booking RPC (caller's JWT, RLS)
// 2) a Stripe PaymentIntent for the combined deposit:
//    - destination charge to the pro's connected account + platform fee, when
//      the pro has a real onboarded Stripe account;
//    - plain platform charge otherwise (demo pros have the flag but no account).
// Returns { booking, clientSecret }. Webhook (ticket 4) reconciles authoritatively.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors, json, stripe, serviceClient } from '../_shared/util.ts'

const PLATFORM_FEE_BPS = 1000 // 10% platform fee on the deposit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const { pro_id, service_date, start_time = null, items } = body ?? {}
  if (!pro_id || !service_date || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'pro_id, service_date, and a non-empty items array are required' }, 400)
  }

  // 1) Atomic booking (gated on charges_enabled inside the RPC).
  const { data: bookingId, error } = await supabase.rpc('create_booking', {
    _pro_id: pro_id,
    _service_date: service_date,
    _start_time: start_time,
    _items: items,
  })
  if (error) return json({ error: error.message }, 400)

  const svc = serviceClient()

  // 2) Deposit PaymentIntent (only if there's a deposit to collect).
  let clientSecret: string | null = null
  const { data: bk } = await svc.from('bookings').select('deposit_total').eq('id', bookingId).single()
  const depositTotal = bk?.deposit_total ?? 0
  const { data: pro } = await svc.from('pros').select('stripe_account_id,charges_enabled,is_demo').eq('id', pro_id).single()

  // Demo pros are browse-only: confirm the booking with NO real charge so a
  // walkthrough on live Stripe never bills anyone.
  if (pro?.is_demo) {
    await svc.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
  } else if (depositTotal > 0) {
    const params: Record<string, string> = {
      amount: String(depositTotal),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      'metadata[booking_id]': String(bookingId),
    }
    // Route to the pro's connected account with a platform fee when onboarded.
    if (pro?.stripe_account_id && pro?.charges_enabled) {
      params['transfer_data[destination]'] = pro.stripe_account_id
      params['application_fee_amount'] = String(Math.round((depositTotal * PLATFORM_FEE_BPS) / 10000))
    }

    try {
      const pi = await stripe('payment_intents', 'POST', params)
      clientSecret = pi.client_secret
      await svc.from('bookings').update({ stripe_payment_intent_id: pi.id }).eq('id', bookingId)
    } catch (e) {
      return json({ error: `payment setup failed: ${(e as Error).message}` }, 400)
    }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id,pro_id,status,service_date,start_time,service_total,deposit_total,' +
        'booking_line_items(service_name,price,deposit,duration_min,scheduled_at,is_addon,sort)',
    )
    .eq('id', bookingId)
    .order('sort', { foreignTable: 'booking_line_items', ascending: true })
    .single()

  return json({ booking, clientSecret }, 201)
})
