import { useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { listMembers } from '../lib/household.js'
import { stripePromise } from '../lib/stripe.js'
import { centsToUsd } from '../lib/format.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'
const YOU = { id: 'you', label: 'You', household_member_id: null }

// Booking flow modal. People step (group booking) appears only when the client
// has household members. Calls create_booking — server stays authoritative for
// prices and schedule; totals here are an estimate. Upgrade/membership step
// arrives with Batch 8.
export default function BookingFlow({ pro, services, preselectServiceId, onClose, onBooked }) {
  const { user } = useAuth()
  const main = services.filter((s) => !s.is_addon)
  const addons = services.filter((s) => s.is_addon)
  const svcById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services])

  const [people, setPeople] = useState([YOU])
  const [selectedPeople, setSelectedPeople] = useState(() => new Set(['you']))
  const [svcSel, setSvcSel] = useState(() => ({ you: new Set(preselectServiceId ? [preselectServiceId] : []) }))
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pay, setPay] = useState(null) // { clientSecret, bookingId, amount } once the booking is created

  useEffect(() => {
    let on = true
    listMembers(user.id)
      .then((ms) => {
        if (!on) return
        setPeople([YOU, ...ms.map((m) => ({ id: m.id, label: m.display_name, household_member_id: m.id }))])
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [user.id])

  const hasMembers = people.length > 1
  const STEPS = hasMembers ? ['People', 'Services', 'Date & Time', 'Confirm'] : ['Services', 'Date & Time', 'Confirm']
  const stepName = STEPS[step]

  function togglePerson(id) {
    setSelectedPeople((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setSvcSel((prev) => (prev[id] ? prev : { ...prev, [id]: new Set() }))
  }
  function toggleSvc(personId, serviceId) {
    setSvcSel((prev) => {
      const set = new Set(prev[personId] || [])
      set.has(serviceId) ? set.delete(serviceId) : set.add(serviceId)
      return { ...prev, [personId]: set }
    })
  }

  const activePeople = people.filter((p) => selectedPeople.has(p.id))
  const items = activePeople.flatMap((p) =>
    [...(svcSel[p.id] || [])].map((sid) => ({ service_id: sid, household_member_id: p.household_member_id })),
  )
  const totals = items.reduce(
    (acc, it) => {
      const s = svcById[it.service_id]
      if (s) {
        acc.price += s.price
        acc.deposit += s.deposit
        acc.minutes += s.duration_min
      }
      return acc
    },
    { price: 0, deposit: 0, minutes: 0 },
  )

  const everyoneHasService = activePeople.every((p) => (svcSel[p.id]?.size || 0) > 0)
  const canNext =
    (stepName === 'People' && selectedPeople.size > 0) ||
    (stepName === 'Services' && everyoneHasService) ||
    (stepName === 'Date & Time' && date && time) ||
    stepName === 'Confirm'

  async function confirm() {
    setBusy(true)
    setError(null)
    const startIso = new Date(`${date}T${time}`).toISOString()
    const { data, error } = await supabase.functions.invoke('create_booking', {
      body: {
        pro_id: pro.id,
        service_date: date,
        start_time: startIso,
        items: items.map((it) =>
          it.household_member_id ? { service_id: it.service_id, household_member_id: it.household_member_id } : { service_id: it.service_id },
        ),
      },
    })
    setBusy(false)
    if (error) {
      let text = error.message
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setError(text)
      return
    }
    track('booking_created', { pro_id: pro?.id, booking_id: data?.booking?.id })
    // If a deposit is due, collect it; otherwise the booking is done.
    if (data?.clientSecret && data?.booking?.id) {
      setPay({ clientSecret: data.clientSecret, bookingId: data.booking.id, amount: totals.deposit })
    } else {
      onBooked?.(data?.booking)
    }
  }

  async function handlePaid() {
    // Server re-verifies the payment and confirms the booking.
    await supabase.functions.invoke('confirm_deposit', { body: { booking_id: pay.bookingId } }).catch(() => {})
    onBooked?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-black/10 bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-black/50">Book with</div>
            <div className="font-semibold">{pro.display_name}</div>
          </div>
          <button onClick={onClose} className="text-black/50 hover:text-gray-900">✕</button>
        </div>
        <div className="mb-5 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= step ? GOLD : 'rgba(0,0,0,0.10)' }} />
          ))}
        </div>

        {pay ? (
          <PaymentPanel clientSecret={pay.clientSecret} amount={pay.amount} onPaid={handlePaid} />
        ) : (
        <>
        {stepName === 'People' && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">Who's coming?</h3>
            <div className="space-y-2">
              {people.map((p) => {
                const checked = selectedPeople.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePerson(p.id)}
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition"
                    style={{ borderColor: checked ? GOLD : 'rgba(0,0,0,0.10)', backgroundColor: checked ? 'rgba(244,169,60,0.08)' : 'transparent' }}
                  >
                    <span className="text-sm font-medium">{p.label}</span>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md border text-xs text-black"
                      style={{ borderColor: checked ? GOLD : 'rgba(0,0,0,0.22)', backgroundColor: checked ? GOLD : 'transparent' }}
                    >
                      {checked ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {stepName === 'Services' && (
          <div className="space-y-5">
            {activePeople.map((p) => (
              <div key={p.id}>
                {hasMembers && <h3 className="mb-2 text-sm font-semibold text-black/70">{p.label}</h3>}
                <div className="space-y-2">
                  {main.map((s) => (
                    <ServiceRow key={s.id} s={s} checked={svcSel[p.id]?.has(s.id)} onToggle={() => toggleSvc(p.id, s.id)} />
                  ))}
                  {addons.map((s) => (
                    <ServiceRow key={s.id} s={s} checked={svcSel[p.id]?.has(s.id)} onToggle={() => toggleSvc(p.id, s.id)} addon />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {stepName === 'Date & Time' && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-black/60">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40"
              />
            </label>
            <label className="block">
              <span className="text-sm text-black/60">Start time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40"
              />
            </label>
            <p className="text-xs text-black/55">
              The pro confirms your slot. Total time: ~{totals.minutes} min. Back-to-back times are computed server-side.
            </p>
          </div>
        )}

        {stepName === 'Confirm' && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">Review</h3>
            <div className="rounded-xl border border-black/10 bg-black/5 p-3 text-sm">
              {activePeople.map((p) => {
                const ids = [...(svcSel[p.id] || [])]
                if (!ids.length) return null
                return (
                  <div key={p.id} className="mb-1">
                    {hasMembers && <div className="text-xs font-semibold text-black/50">{p.label}</div>}
                    {ids.map((sid) => (
                      <div key={sid} className="flex justify-between py-0.5">
                        <span className="text-black/70">{svcById[sid]?.name}</span>
                        <span>{centsToUsd(svcById[sid]?.price)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
              <div className="mt-2 flex justify-between border-t border-black/10 pt-2 text-black/60">
                <span>{new Date(`${date}T${time}`).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span>{totals.minutes} min</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span>{centsToUsd(totals.price)}</span>
              </div>
              <div className="flex justify-between" style={{ color: GOLD }}>
                <span>Deposit due</span>
                <span>{centsToUsd(totals.deposit)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-black/55">
              One combined deposit secures every slot and applies to your total. Cancellations within 24h forfeit the
              deposit. Card payment is added in Batch 8 — for now this creates a pending booking.
            </p>
            {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="rounded-lg border border-black/15 px-4 py-2.5 text-sm hover:bg-black/10">
              Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              Continue
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button
              disabled={busy}
              onClick={confirm}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {busy ? 'Booking…' : 'Confirm booking'}
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

function PaymentPanel({ clientSecret, amount, onPaid }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: GOLD, colorBackground: '#ffffff' } } }}
    >
      <PayForm amount={amount} onPaid={onPaid} />
    </Elements>
  )
}

function PayForm({ amount, onPaid }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function pay() {
    if (!stripe || !elements) return
    setBusy(true)
    setErr(null)
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    setBusy(false)
    if (error) {
      setErr(error.message || 'Payment failed')
      return
    }
    onPaid()
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/55">Payment</h3>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>}
      <button
        onClick={pay}
        disabled={busy || !stripe}
        className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
        style={{ backgroundColor: GOLD }}
      >
        {busy ? 'Processing…' : `Pay ${centsToUsd(amount)} deposit`}
      </button>
      <p className="mt-2 text-center text-xs text-black/55">
        Test mode — card 4242 4242 4242 4242, any future date & CVC.
      </p>
    </div>
  )
}

function ServiceRow({ s, checked, onToggle, addon }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition"
      style={{ borderColor: checked ? GOLD : 'rgba(0,0,0,0.10)', backgroundColor: checked ? 'rgba(244,169,60,0.08)' : 'transparent' }}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{s.name}</div>
        <div className="text-xs text-black/50">
          {s.duration_min} min{s.deposit > 0 && <span> · {centsToUsd(s.deposit)} deposit</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {addon ? '+' : ''}
          {centsToUsd(s.price)}
        </span>
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md border text-xs text-black"
          style={{ borderColor: checked ? GOLD : 'rgba(0,0,0,0.22)', backgroundColor: checked ? GOLD : 'transparent' }}
        >
          {checked ? '✓' : ''}
        </span>
      </div>
    </button>
  )
}
