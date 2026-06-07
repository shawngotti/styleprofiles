// Batch 11 P5 — confirm_event_ticket.
// After the buyer confirms the PaymentElement, re-check the PI WITH Stripe and
// settle via mark_ticket_paid (capacity-guarded, idempotent). The webhook is the
// authoritative reconciler; this gives immediate UX.

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
  const attendeeId = body.attendee_id
  if (!attendeeId) return json({ error: 'attendee_id is required' }, 400)

  const svc = serviceClient()
  const { data: a } = await svc
    .from('event_attendees')
    .select('id,profile_id,status,stripe_payment_intent_id')
    .eq('id', attendeeId)
    .maybeSingle()
  if (!a) return json({ error: 'ticket not found' }, 404)
  if (a.profile_id !== user.id) return json({ error: 'not your ticket' }, 403)
  if (a.status !== 'pending') return json({ confirmed: a.status === 'confirmed', status: a.status })
  if (!a.stripe_payment_intent_id) return json({ error: 'no payment on file' }, 400)

  try {
    const pi = await stripe(`payment_intents/${a.stripe_payment_intent_id}`)
    if (pi.status !== 'succeeded') return json({ confirmed: false, payment_status: pi.status, status: a.status })
    const { data: settled, error } = await svc.rpc('mark_ticket_paid', { _attendee_id: a.id })
    if (error) return json({ error: error.message }, 400)
    return json({ confirmed: settled === 'confirmed', payment_status: pi.status, status: settled })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
