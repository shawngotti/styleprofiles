import { useCallback, useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient.js'
import { stripePromise } from '../lib/stripe.js'
import { centsToUsd } from '../lib/format.js'
import { initials } from '../lib/format.js'

const GOLD = '#F4A93C'
const TYPE_LABEL = { last_minute: 'Last-minute', cancellation: 'Cancellation fill', slow_day: 'Slow-day deal' }

// Client-facing flash deals (Fill My Chair). Open slots are public-read; claiming
// goes through the claim_chair_promotion Edge Function (atomic reserve + discounted
// booking), then collects the deposit. On success the booking shows in My
// Appointments.
export default function Deals({ onClaimed }) {
  const [deals, setDeals] = useState(undefined)
  const [pay, setPay] = useState(null) // { clientSecret, bookingId }
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString()
    const { data } = await supabase
      .from('chair_promotions')
      .select('id,slot_at,slot_label,promo_type,discount_pct,expires_at,pro:pros(display_name,handle),service:services(name,price,deposit)')
      .eq('status', 'open')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('expires_at', { ascending: true })
    setDeals(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function claim(id) {
    setBusy(id)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('claim_chair_promotion', { body: { promo_id: id } })
    setBusy(null)
    if (error) {
      let text = 'Could not claim this deal'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      load()
      return
    }
    if (data.clientSecret) {
      setPay({ clientSecret: data.clientSecret, bookingId: data.booking_id })
    } else {
      setMsg({ type: 'ok', text: 'Slot claimed — see it in My Appointments.' })
      onClaimed?.()
      load()
    }
  }

  if (pay) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: pay.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: GOLD, colorBackground: '#ffffff' } } }}>
        <DepositPayment
          bookingId={pay.bookingId}
          onDone={() => {
            setPay(null)
            setMsg({ type: 'ok', text: 'Slot secured — see it in My Appointments.' })
            onClaimed?.()
            load()
          }}
          onCancel={() => {
            setPay(null)
            load()
          }}
        />
      </Elements>
    )
  }

  if (deals === undefined) return <p className="text-sm text-black/50">Loading deals…</p>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Flash deals</h2>
        <p className="mt-1 text-sm text-black/60">Last-minute openings from pros near you. Claim secures the slot with a deposit.</p>
      </div>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}

      {deals.length === 0 ? (
        <p className="text-sm text-black/55">No flash deals running right now.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {deals.map((d) => {
            const full = d.service?.price ?? 0
            const discounted = Math.round(full * (1 - (d.discount_pct || 0) / 100))
            return (
              <div key={d.id} className="rounded-2xl border border-black/10 bg-black/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${GOLD}1a`, color: GOLD }}>
                    {TYPE_LABEL[d.promo_type] || 'Deal'}
                  </span>
                  {d.expires_at && <span className="text-xs text-black/55">ends {new Date(d.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>
                    {initials(d.pro?.display_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.service?.name || 'Service'}</div>
                    <div className="truncate text-xs text-black/50">{d.pro?.display_name} · {d.slot_at ? new Date(d.slot_at).toLocaleString() : d.slot_label}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">
                    {d.discount_pct > 0 ? (
                      <>
                        <span className="font-semibold" style={{ color: GOLD }}>{centsToUsd(discounted)}</span>{' '}
                        <span className="text-black/55 line-through">{centsToUsd(full)}</span>
                      </>
                    ) : (
                      <span className="font-semibold">{centsToUsd(full)}</span>
                    )}
                  </span>
                  <button
                    onClick={() => claim(d.id)}
                    disabled={busy === d.id}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                    style={{ backgroundColor: GOLD }}
                  >
                    {busy === d.id ? '…' : 'Claim'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DepositPayment({ bookingId, onDone, onCancel }) {
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
    await supabase.functions.invoke('confirm_deposit', { body: { booking_id: bookingId } })
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Secure your slot</h2>
      <p className="text-sm text-black/60">A deposit holds your appointment. The pro confirms your slot.</p>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button onClick={pay} disabled={busy || !stripe} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Processing…' : 'Pay deposit'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-black/15 px-4 py-2 text-sm text-black/70">Cancel</button>
      </div>
    </div>
  )
}
