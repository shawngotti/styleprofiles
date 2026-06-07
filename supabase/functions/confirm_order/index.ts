// Batch 10 — confirm_order.
// After the buyer confirms the PaymentElement, re-check the PaymentIntent WITH
// Stripe (never trust the browser) and settle the order via mark_order_paid
// (flips to 'paid' + decrements inventory atomically). The webhook is the
// authoritative reconciler; this gives immediate UX. Both call the same
// idempotent RPC, so whichever lands first wins and the other is a no-op.

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
  const orderId = body.order_id
  if (!orderId) return json({ error: 'order_id is required' }, 400)

  const svc = serviceClient()
  const { data: order } = await svc
    .from('orders')
    .select('id,buyer_profile_id,status,stripe_payment_intent_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return json({ error: 'order not found' }, 404)
  if (order.buyer_profile_id !== user.id) return json({ error: 'not your order' }, 403)
  if (order.status !== 'pending') return json({ paid: order.status === 'paid', order_status: order.status })
  if (!order.stripe_payment_intent_id) return json({ error: 'no payment on file' }, 400)

  try {
    const pi = await stripe(`payment_intents/${order.stripe_payment_intent_id}`)
    if (pi.status !== 'succeeded') {
      return json({ paid: false, payment_status: pi.status, order_status: order.status })
    }
    const { data: settled, error } = await svc.rpc('mark_order_paid', { _order_id: order.id })
    if (error) return json({ error: error.message }, 400)
    return json({ paid: true, payment_status: pi.status, order_status: settled })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
