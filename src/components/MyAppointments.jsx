import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { centsToUsd } from '../lib/format.js'

const GOLD = '#F4A93C'
const STATUS = {
  pending: { label: 'Pending', color: '#F4A93C' },
  confirmed: { label: 'Confirmed', color: '#34D399' },
  completed: { label: 'Completed', color: '#56C2FF' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
  no_show: { label: 'No-show', color: '#FF6F6F' },
}
const ACTIVE = ['pending', 'confirmed']

function whenLabel(b) {
  const d = b.start_time ? new Date(b.start_time) : b.service_date ? new Date(b.service_date + 'T00:00:00') : null
  if (!d) return ''
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return b.start_time
    ? `${date} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : date
}

// Client "My Appointments": upcoming + past bookings, with cancel (which calls
// the transition_booking Edge Function and surfaces the 24h deposit outcome)
// and rebook (opens the pro's profile).
export default function MyAppointments({ onRebook }) {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const [reviewed, setReviewed] = useState(new Set())

  const load = useCallback(async () => {
    const [{ data, error }, { data: revs }] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id,status,client_profile_id,service_date,start_time,service_total,deposit_total,deposit_outcome,' +
            'pro:pros(id,handle,display_name,category,city,bio,verified,rating_avg,rating_count,price_from),' +
            'booking_line_items(service_name,price,is_addon,sort)',
        )
        .eq('client_profile_id', user.id)
        .order('service_date', { ascending: false }),
      supabase.from('reviews').select('booking_id').eq('author_profile_id', user.id),
    ])
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setBookings(data)
    setReviewed(new Set((revs || []).map((r) => r.booking_id)))
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function cancel(id) {
    setBusyId(id)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('transition_booking', {
      body: { booking_id: id, action: 'cancel' },
    })
    setBusyId(null)
    if (error) {
      let text = error.message
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    const outcome = data?.result?.deposit_outcome
    setMsg({
      type: 'info',
      text: `Booking cancelled. Deposit ${outcome === 'forfeited' ? 'forfeited (cancelled within 24h)' : 'released'}.`,
    })
    load()
  }

  if (loading) return <p className="text-sm text-white/50">Loading your appointments…</p>
  if (error) return <p className="text-sm text-red-400">{error}</p>

  const upcoming = bookings.filter((b) => ACTIVE.includes(b.status))
  const past = bookings.filter((b) => !ACTIVE.includes(b.status))

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status" aria-live="polite">{msg.text}</p>
      )}

      <Group title="Upcoming" empty="No upcoming appointments — browse Discover to book.">
        {upcoming.map((b) => (
          <BookingCard key={b.id} b={b}>
            <button
              disabled={busyId === b.id}
              onClick={() => cancel(b.id)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              {busyId === b.id ? 'Cancelling…' : 'Cancel'}
            </button>
          </BookingCard>
        ))}
      </Group>

      <Group title="Past" empty="No past appointments yet.">
        {past.map((b) => (
          <BookingCard key={b.id} b={b}>
            {b.pro && (
              <button
                onClick={() => onRebook?.(b.pro)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black"
                style={{ backgroundColor: GOLD }}
              >
                Rebook
              </button>
            )}
            {b.status === 'completed' &&
              (reviewed.has(b.id) ? (
                <span className="self-center text-xs" style={{ color: '#34D399' }}>✓ Reviewed</span>
              ) : (
                <ReviewForm booking={b} onDone={load} />
              ))}
          </BookingCard>
        ))}
      </Group>
    </div>
  )
}

function Group({ title, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = !items || (Array.isArray(items) && items.length === 0)
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/55">{title}</h3>
      {isEmpty ? <p className="text-sm text-white/55">{empty}</p> : <div className="space-y-3">{items}</div>}
    </section>
  )
}

function BookingCard({ b, children }) {
  const st = STATUS[b.status] || { label: b.status, color: '#fff' }
  const services = (b.booking_line_items || [])
    .slice()
    .sort((a, c) => a.sort - c.sort)
    .map((l) => l.service_name)
    .join(', ')
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{b.pro?.display_name || 'Pro'}</div>
          <div className="text-xs text-white/50">{whenLabel(b)}</div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {services && <div className="mt-2 truncate text-sm text-white/70">{services}</div>}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-white/60">
          {centsToUsd(b.service_total)}
          {b.deposit_total > 0 && <span className="text-white/55"> · {centsToUsd(b.deposit_total)} deposit</span>}
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  )
}

// Inline review for a completed booking. `verified` is set server-side (the
// trigger checks the booking is the author's own completed visit); the pro's
// rating cache is recomputed by trigger too.
function ReviewForm({ booking, onDone }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-center rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
      >
        Leave a review
      </button>
    )
  }

  async function submit() {
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('reviews').insert({
      pro_id: booking.pro.id,
      author_profile_id: booking.client_profile_id ?? undefined,
      booking_id: booking.id,
      rating,
      body: body.trim() || null,
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    onDone()
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            className="text-lg"
            style={{ color: n <= rating ? GOLD : 'rgba(255,255,255,0.25)' }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="How was your visit? (optional)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
      />
      {err && <p className="mt-1 text-sm text-red-400" role="alert">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          style={{ backgroundColor: GOLD }}
        >
          {busy ? 'Posting…' : 'Post review'}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70">
          Cancel
        </button>
      </div>
    </div>
  )
}
