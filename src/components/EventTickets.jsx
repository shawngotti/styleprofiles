import { useCallback, useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient.js'
import { stripePromise } from '../lib/stripe.js'
import { centsToUsd as money } from '../lib/format.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Published events for a competition, with in-app Stripe ticketing. The platform
// is merchant of record (buy_event_ticket -> platform PaymentIntent). Tickets
// sold on Eventbrite are reconciled into the same event_attendees ledger by the
// import path, so "You're going" reflects any source matched to this account.
export default function EventTickets({ competitionId }) {
  const [events, setEvents] = useState([])
  const [mine, setMine] = useState(new Set()) // event_ids the user holds a confirmed ticket for
  const [checkout, setCheckout] = useState(null) // { clientSecret, attendee_id, total, title }
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data: evs } = await supabase
      .from('events')
      .select('id,title,venue,address,event_date,ticket_price,capacity,ticketing_provider,status')
      .eq('competition_id', competitionId)
      .eq('status', 'published')
      .order('event_date')
    setEvents(evs || [])
    const ids = (evs || []).map((e) => e.id)
    if (ids.length) {
      const { data: att } = await supabase
        .from('event_attendees')
        .select('event_id,status')
        .in('event_id', ids)
        .in('status', ['confirmed', 'checked_in'])
      setMine(new Set((att || []).map((a) => a.event_id)))
    }
  }, [competitionId])

  useEffect(() => {
    load()
  }, [load])

  async function buy(ev) {
    setBusy(ev.id)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('buy_event_ticket', { body: { event_id: ev.id, qty: 1 } })
    setBusy(null)
    if (error || !data?.clientSecret) {
      let text = 'Could not start checkout'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    setCheckout({ clientSecret: data.clientSecret, attendee_id: data.attendee_id, total: data.total, title: ev.title })
  }

  if (events.length === 0) return null

  if (checkout) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: GOLD, colorBackground: '#ffffff' } } }}>
        <TicketPayment
          attendeeId={checkout.attendee_id}
          total={checkout.total}
          title={checkout.title}
          onDone={() => {
            track('ticket_purchased', { attendee_id: checkout.attendee_id, total: checkout.total })
            setCheckout(null)
            setMsg({ type: 'ok', text: "You're going! 🎟" })
            load()
          }}
          onCancel={() => setCheckout(null)}
        />
      </Elements>
    )
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50">Live events</h3>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((ev) => {
          const going = mine.has(ev.id)
          const inApp = ev.ticketing_provider === 'stripe' && ev.ticket_price
          return (
            <div key={ev.id} className="rounded-2xl border border-black/10 bg-black/5 p-4">
              <div className="font-medium">{ev.title || 'Event'}</div>
              <div className="mt-1 text-xs text-black/50">
                {ev.venue}{ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString()}` : ''}
              </div>
              <div className="mt-3 flex items-center justify-between">
                {inApp ? <span className="text-sm font-semibold" style={{ color: GOLD }}>{money(ev.ticket_price)}</span> : <span className="text-xs text-black/55">Tickets via {ev.ticketing_provider}</span>}
                {going ? (
                  <span className="text-sm font-medium" style={{ color: '#34D399' }}>✓ You're going</span>
                ) : inApp ? (
                  <button onClick={() => buy(ev)} disabled={busy === ev.id} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
                    {busy === ev.id ? '…' : 'Buy ticket'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TicketPayment({ attendeeId, total, title, onDone, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function pay() {
    if (!stripe || !elements) return
    setBusy(true)
    setErr(null)
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) {
      setErr(error.message)
      setBusy(false)
      return
    }
    await supabase.functions.invoke('confirm_event_ticket', { body: { attendee_id: attendeeId } })
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title} · {money(total)}</h2>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={pay} disabled={busy || !stripe} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Processing…' : `Pay ${money(total)}`}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-black/15 px-4 py-2 text-sm text-black/70">Cancel</button>
      </div>
    </div>
  )
}
