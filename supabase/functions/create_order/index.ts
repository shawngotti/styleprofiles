// Batch 10 — create_order.
// First-party marketplace checkout: the PLATFORM is the merchant of record, so
// the PaymentIntent is a plain platform charge (no connected account / no
// application_fee, unlike bookings which route to pros). Prices and totals are
// computed server-side from the catalog — never trusted from the cart. Gated on
// marketplace_on; a disabled marketplace rejects here even if the UI slips.

import { cors, json, stripe, serviceClient, getUser, featureEnabled } from '../_shared/util.ts'

const SHIPPING_FLAT = 599 // cents; flat-rate placeholder until the shipping/tax piece lands

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  if (!(await featureEnabled(svc, 'marketplace_on'))) {
    return json({ error: 'the shop is not open yet' }, 403)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const cart = Array.isArray(body.cart) ? (body.cart as Array<{ product_id?: string; qty?: number }>) : []
  if (cart.length === 0) return json({ error: 'cart is empty' }, 400)

  // Collapse duplicate lines and sanitize quantities.
  const want = new Map<string, number>()
  for (const line of cart) {
    if (!line.product_id) continue
    const qty = Math.floor(Number(line.qty) || 0)
    if (qty <= 0) continue
    want.set(line.product_id, (want.get(line.product_id) || 0) + qty)
  }
  if (want.size === 0) return json({ error: 'no valid items in cart' }, 400)

  // Authoritative catalog read.
  const { data: products, error: pErr } = await svc
    .from('products')
    .select('id,name,price,is_available,inventory_qty')
    .in('id', [...want.keys()])
  if (pErr) return json({ error: pErr.message }, 400)

  const items: Array<{ product_id: string; product_name: string; unit_price: number; qty: number }> = []
  let subtotal = 0
  for (const [productId, qty] of want) {
    const p = products?.find((x) => x.id === productId)
    if (!p || !p.is_available) return json({ error: 'an item is no longer available' }, 400)
    if (p.inventory_qty !== null && p.inventory_qty < qty) {
      return json({ error: `only ${p.inventory_qty} of ${p.name} left` }, 400)
    }
    subtotal += p.price * qty
    items.push({ product_id: p.id, product_name: p.name, unit_price: p.price, qty })
  }
  const shipping = SHIPPING_FLAT
  const total = subtotal + shipping

  // Create the order (pending) + line items with price snapshots.
  const { data: order, error: oErr } = await svc
    .from('orders')
    .insert({ buyer_profile_id: user.id, status: 'pending', subtotal, shipping, total })
    .select('id')
    .single()
  if (oErr) return json({ error: oErr.message }, 400)

  const { error: iErr } = await svc
    .from('order_items')
    .insert(items.map((it) => ({ order_id: order.id, ...it })))
  if (iErr) {
    await svc.from('orders').delete().eq('id', order.id)
    return json({ error: iErr.message }, 400)
  }

  // Platform PaymentIntent (merchant of record = platform; no connected account).
  try {
    const pi = await stripe('payment_intents', 'POST', {
      amount: String(total),
      currency: 'usd',
      'metadata[order_id]': order.id,
      'metadata[buyer_profile_id]': user.id,
      'automatic_payment_methods[enabled]': 'true',
    })
    await svc.from('orders').update({ stripe_payment_intent_id: pi.id }).eq('id', order.id)
    return json({ order_id: order.id, clientSecret: pi.client_secret, subtotal, shipping, total }, 201)
  } catch (e) {
    await svc.from('orders').delete().eq('id', order.id) // items cascade
    return json({ error: (e as Error).message }, 400)
  }
})
