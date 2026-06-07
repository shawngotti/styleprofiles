// Batch 8 — confirm_deposit.
// After the client confirms the PaymentElement, this re-checks the PaymentIntent
// status WITH STRIPE (never trusting the browser) and flips the booking to
// 'confirmed'. The Stripe webhook (ticket 4) is the authoritative reconciler;
// this gives immediate UX without trusting client-reported success.

import { cors, json, stripe, serviceClient, getUser } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const bookingId = body.booking_id
  if (!bookingId) return json({ error: 'booking_id is required' }, 400)

  const svc = serviceClient()
  const { data: bk, error } = await svc
    .from('bookings')
    .select('id,client_profile_id,status,deposit_total,stripe_payment_intent_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (error) return json({ error: error.message }, 400)
  if (!bk) return json({ error: 'booking not found' }, 404)
  if (bk.client_profile_id !== user.id) return json({ error: 'not your booking' }, 403)

  // No deposit to collect → confirm directly.
  if (!bk.stripe_payment_intent_id) {
    if (bk.deposit_total > 0) return json({ error: 'no payment on file for this booking' }, 400)
    if (bk.status === 'pending') await svc.from('bookings').update({ status: 'confirmed' }).eq('id', bk.id)
    return json({ paid: false, booking_status: 'confirmed' })
  }

  try {
    const pi = await stripe(`payment_intents/${bk.stripe_payment_intent_id}`)
    if (pi.status === 'succeeded') {
      if (bk.status === 'pending') await svc.from('bookings').update({ status: 'confirmed' }).eq('id', bk.id)
      return json({ paid: true, payment_status: pi.status, booking_status: 'confirmed' })
    }
    return json({ paid: false, payment_status: pi.status, booking_status: bk.status })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
