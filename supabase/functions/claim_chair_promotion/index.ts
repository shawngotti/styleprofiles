// Fill My Chair — claim_chair_promotion.
// Atomically reserves an open slot + creates a discounted booking (via the
// claim_chair_promotion RPC, run with the caller's JWT so the booking is theirs),
// then opens a deposit PaymentIntent for the discounted deposit — same routing
// as create_booking (destination charge to the pro when onboarded, else platform
// charge). Returns { booking_id, clientSecret }. The webhook reconciles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors, json, stripe, serviceClient } from '../_shared/util.ts'

const PLATFORM_FEE_BPS = 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const promoId = body.promo_id
  if (!promoId) return json({ error: 'promo_id is required' }, 400)

  // Atomic claim + discounted booking (RLS/auth.uid() apply to the booking).
  const { data: claim, error } = await supabase.rpc('claim_chair_promotion', { _promo_id: promoId })
  if (error) return json({ error: error.message }, 400)

  const svc = serviceClient()
  const bookingId = claim.booking_id as string
  const depositTotal = (claim.deposit_total as number) ?? 0

  let clientSecret: string | null = null
  if (depositTotal > 0) {
    const { data: pro } = await svc.from('pros').select('stripe_account_id,charges_enabled').eq('id', claim.pro_id).single()
    const params: Record<string, string> = {
      amount: String(depositTotal),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      'metadata[booking_id]': String(bookingId),
    }
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

  return json({ booking_id: bookingId, clientSecret, deposit_total: depositTotal }, 201)
})
