import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd } from '../lib/format.js'

const GOLD = '#F4A93C'
const STEPS = ['Services', 'Date & Time', 'Confirm']

// Booking flow modal. Faithful subset of the prototype's 6-step flow
// (People + Upgrade steps arrive with Household CRUD / memberships). Calls the
// create_booking Edge Function — the server is authoritative for prices and the
// schedule; the totals shown here are an estimate for the user.
export default function BookingFlow({ pro, services, preselectServiceId, onClose, onBooked }) {
  const main = services.filter((s) => !s.is_addon)
  const addons = services.filter((s) => s.is_addon)

  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState(() => new Set(preselectServiceId ? [preselectServiceId] : []))
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const chosen = useMemo(() => services.filter((s) => selected.has(s.id)), [services, selected])
  const totals = useMemo(
    () => ({
      price: chosen.reduce((s, x) => s + x.price, 0),
      deposit: chosen.reduce((s, x) => s + x.deposit, 0),
      minutes: chosen.reduce((s, x) => s + x.duration_min, 0),
    }),
    [chosen],
  )

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const canNext = (step === 0 && selected.size > 0) || (step === 1 && date && time) || step === 2

  async function confirm() {
    setBusy(true)
    setError(null)
    const startIso = new Date(`${date}T${time}`).toISOString()
    const items = chosen.map((s) => ({ service_id: s.id }))
    const { data, error } = await supabase.functions.invoke('create_booking', {
      body: { pro_id: pro.id, service_date: date, start_time: startIso, items },
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
    onBooked?.(data?.booking)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#141417] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / stepper */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-white/50">Book with</div>
            <div className="font-semibold">{pro.display_name}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>
        <div className="mb-5 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= step ? GOLD : 'rgba(255,255,255,0.12)' }} />
          ))}
        </div>

        {/* Step 0 — Services */}
        {step === 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/40">Services</h3>
            <div className="space-y-2">
              {main.map((s) => (
                <ServiceRow key={s.id} s={s} checked={selected.has(s.id)} onToggle={() => toggle(s.id)} />
              ))}
            </div>
            {addons.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-white/40">Add-ons</h3>
                <div className="space-y-2">
                  {addons.map((s) => (
                    <ServiceRow key={s.id} s={s} checked={selected.has(s.id)} onToggle={() => toggle(s.id)} addon />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1 — Date & Time */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-white/60">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/60">Start time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
              />
            </label>
            <p className="text-xs text-white/40">
              The pro confirms your slot. Total time: ~{totals.minutes} min. Back-to-back times are computed
              server-side.
            </p>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/40">Review</h3>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              {chosen.map((s) => (
                <div key={s.id} className="flex justify-between py-0.5">
                  <span className="text-white/70">{s.name}</span>
                  <span>{centsToUsd(s.price)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-white/60">
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
            <p className="mt-3 text-xs text-white/40">
              One combined deposit secures your slot and applies to your total. Cancellations within 24h forfeit
              the deposit. Card payment is added in Batch 8 — for now this creates a pending booking.
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm hover:bg-white/10">
              Back
            </button>
          )}
          {step < 2 && (
            <button
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              Continue
            </button>
          )}
          {step === 2 && (
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
      </div>
    </div>
  )
}

function ServiceRow({ s, checked, onToggle, addon }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition"
      style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.12)', backgroundColor: checked ? 'rgba(244,169,60,0.08)' : 'transparent' }}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{s.name}</div>
        <div className="text-xs text-white/50">
          {s.duration_min} min{s.deposit > 0 && <span> · {centsToUsd(s.deposit)} deposit</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">{addon ? '+' : ''}{centsToUsd(s.price)}</span>
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md border text-xs text-black"
          style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.3)', backgroundColor: checked ? GOLD : 'transparent' }}
        >
          {checked ? '✓' : ''}
        </span>
      </div>
    </button>
  )
}
