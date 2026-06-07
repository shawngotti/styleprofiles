// Option A3 — Eventbrite webhook → unified event_attendees ledger.
// Eventbrite posts { api_url, config:{ action } } on order.placed/updated. We
// fetch the order (with attendees) from its API using EVENTBRITE_API_TOKEN, map
// it to attendee rows, resolve our event by events.eventbrite_event_id, and call
// the (service-role) _import_event_attendees core — which upserts idempotently
// and matches email -> profile.
//
// ⚠️ Requires EVENTBRITE_API_TOKEN set as a function secret and the webhook
// registered in Eventbrite pointing at this function URL. Public endpoint
// (verify_jwt=false); it only trusts data it re-fetches from the Eventbrite API.

import { serviceClient } from '../_shared/util.ts'

const TOKEN = Deno.env.get('EVENTBRITE_API_TOKEN')

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!TOKEN) return ok({ error: 'EVENTBRITE_API_TOKEN not configured' }, 503)

  let payload: { api_url?: string; config?: { action?: string } } = {}
  try {
    payload = await req.json()
  } catch {
    return ok({ error: 'bad payload' }, 400)
  }
  const apiUrl = payload.api_url
  // Only trust api_urls hosted on the Eventbrite API (we re-fetch from there).
  if (!apiUrl || !apiUrl.startsWith('https://www.eventbriteapi.com/')) {
    return ok({ ignored: true })
  }

  try {
    // Fetch the order with its attendees + the event id.
    const orderUrl = new URL(apiUrl)
    orderUrl.searchParams.set('expand', 'attendees')
    const res = await fetch(orderUrl.toString(), { headers: { Authorization: `Bearer ${TOKEN}` } })
    if (!res.ok) return ok({ error: `eventbrite fetch failed: ${res.status}` }, 502)
    const order = await res.json()

    const eventbriteEventId = String(order.event_id ?? '')
    const attendees = Array.isArray(order.attendees) ? order.attendees : []
    if (!eventbriteEventId) return ok({ ignored: 'no event_id' })

    const svc = serviceClient()
    const { data: event } = await svc
      .from('events')
      .select('id')
      .eq('eventbrite_event_id', eventbriteEventId)
      .maybeSingle()
    if (!event) return ok({ ignored: `no local event for eventbrite ${eventbriteEventId}` })

    // Map Eventbrite attendees → ledger rows.
    const rows = attendees.map((a: Record<string, unknown>) => {
      const profile = (a.profile ?? {}) as Record<string, unknown>
      const cost = (a.costs as Record<string, Record<string, number>> | undefined)?.gross?.value
      return {
        external_ref: String(a.id ?? ''),
        email: (profile.email as string) ?? null,
        name: (profile.name as string) ?? null,
        ticket_type: (a.ticket_class_name as string) ?? null,
        qty: 1,
        amount: typeof cost === 'number' ? cost : null,
        status: a.cancelled ? 'cancelled' : a.checked_in ? 'checked_in' : 'confirmed',
      }
    })

    const { data: imported, error } = await svc.rpc('_import_event_attendees', {
      _event_id: event.id,
      _source: 'eventbrite',
      _rows: rows,
    })
    if (error) return ok({ error: error.message }, 500)
    return ok({ imported })
  } catch (e) {
    return ok({ error: (e as Error).message }, 500)
  }
})
