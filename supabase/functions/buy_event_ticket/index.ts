// Batch 11 P5 — buy_event_ticket.
// First-party in-app ticket sale: platform is merchant of record (plain platform
// PaymentIntent, like marketplace). Creates a pending event_attendees row, then
// the PI; confirm_event_ticket + the webhook settle via mark_ticket_paid (which
// guards capacity). Gated on lineup_on.

import { cors, json, stripe, serviceClient, getUser, featureEnabled } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  if (!(await featureEnabled(svc, 'lineup_on'))) return json({ error: 'The Lineup is not live yet' }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const eventId = body.event_id as string | undefined
  const qty = Math.max(1, Math.floor(Number(body.qty) || 1))
  if (!eventId) return json({ error: 'event_id is required' }, 400)

  const { data: event } = await svc
    .from('events')
    .select('id,title,status,capacity,ticket_price')
    .eq('id', eventId)
    .maybeSingle()
  if (!event || event.status !== 'published') return json({ error: 'event is not on sale' }, 400)
  if (!event.ticket_price) return json({ error: 'this event is not selling tickets in-app' }, 400)

  // Best-effort capacity pre-check (mark_ticket_paid is authoritative).
  if (event.capacity !== null) {
    const { data: sold } = await svc
      .from('event_attendees')
      .select('qty')
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'checked_in'])
    const taken = (sold || []).reduce((n, r) => n + r.qty, 0)
    if (taken + qty > event.capacity) return json({ error: 'not enough tickets left' }, 400)
  }

  const amount = event.ticket_price * qty
  const { data: attendee, error: aErr } = await svc
    .from('event_attendees')
    .insert({
      event_id: eventId,
      source: 'stripe',
      profile_id: user.id,
      email: user.email ?? null,
      qty,
      amount,
      status: 'pending',
    })
    .select('id')
    .single()
  if (aErr) return json({ error: aErr.message }, 400)

  try {
    const pi = await stripe('payment_intents', 'POST', {
      amount: String(amount),
      currency: 'usd',
      'metadata[event_attendee_id]': attendee.id,
      'metadata[event_id]': eventId,
      'automatic_payment_methods[enabled]': 'true',
    })
    await svc
      .from('event_attendees')
      .update({ stripe_payment_intent_id: pi.id, external_ref: pi.id })
      .eq('id', attendee.id)
    return json({ attendee_id: attendee.id, clientSecret: pi.client_secret, total: amount }, 201)
  } catch (e) {
    await svc.from('event_attendees').delete().eq('id', attendee.id)
    return json({ error: (e as Error).message }, 400)
  }
})
