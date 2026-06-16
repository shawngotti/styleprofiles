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

  if (loading) return <p className="text-sm text-black/50">Loading your appointments…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>

  const upcoming = bookings.filter((b) => ACTIVE.includes(b.status))
  const past = bookings.filter((b) => !ACTIVE.includes(b.status))

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>
      )}

      <Group title="Upcoming" empty="No upcoming appointments — browse Discover to book.">
        {upcoming.map((b) => (
          <BookingCard key={b.id} b={b}>
            <button
              disabled={busyId === b.id}
              onClick={() => cancel(b.id)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/10 disabled:opacity-50"
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
                <ReviewForm
                  booking={b}
                  onDone={(text) => {
                    if (text) setMsg({ type: 'ok', text })
                    load()
                  }}
                />
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
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">{title}</h3>
      {isEmpty ? <p className="text-sm text-black/55">{empty}</p> : <div className="space-y-3">{items}</div>}
    </section>
  )
}

function BookingCard({ b, children }) {
  const st = STATUS[b.status] || { label: b.status, color: '#1f1714' }
  const services = (b.booking_line_items || [])
    .slice()
    .sort((a, c) => a.sort - c.sort)
    .map((l) => l.service_name)
    .join(', ')
  return (
    <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{b.pro?.display_name || 'Pro'}</div>
          <div className="text-xs text-black/50">{whenLabel(b)}</div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {services && <div className="mt-2 truncate text-sm text-black/70">{services}</div>}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-black/60">
          {centsToUsd(b.service_total)}
          {b.deposit_total > 0 && <span className="text-black/55"> · {centsToUsd(b.deposit_total)} deposit</span>}
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  )
}

const REVIEW_TAGS = ['On time', 'Great vibe', 'Clean space', 'Skilled', 'Friendly', 'Would return']

// Inline review for a completed booking. Posts through the submit_review Edge
// Function, which verifies the visit, screens the text + photos (OpenAI
// moderation), and publishes or queues per the platform's moderation mode.
// `verified` and the pro's rating cache are still maintained by DB triggers.
function ReviewForm({ booking, onDone }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [tags, setTags] = useState([])
  const [photos, setPhotos] = useState([]) // public URLs
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-center rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/10"
      >
        Leave a review
      </button>
    )
  }

  function toggleTag(t) {
    setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))
  }

  async function onPickPhotos(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUploading(true)
    setErr(null)
    try {
      const urls = []
      for (const f of files.slice(0, 6 - photos.length)) {
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/review-${booking.id}-${Date.now()}-${urls.length}.${ext}`
        const { error } = await supabase.storage.from('review-media').upload(path, f, {
          upsert: true,
          contentType: f.type || undefined,
        })
        if (error) throw new Error(error.message)
        urls.push(supabase.storage.from('review-media').getPublicUrl(path).data.publicUrl)
      }
      setPhotos((s) => [...s, ...urls].slice(0, 6))
    } catch (e2) {
      setErr(`Upload failed: ${e2.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function submit() {
    setBusy(true)
    setErr(null)
    const { data, error } = await supabase.functions.invoke('submit_review', {
      body: {
        pro_id: booking.pro.id,
        booking_id: booking.id,
        rating,
        body: body.trim() || null,
        tags,
        photo_urls: photos,
      },
    })
    setBusy(false)
    if (error || !data?.ok) {
      let text = 'Could not post review'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setErr(data?.error || text)
      return
    }
    onDone(data.message)
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
            style={{ color: n <= rating ? GOLD : 'rgba(0,0,0,0.18)' }}
          >
            ★
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {REVIEW_TAGS.map((t) => {
          const on = tags.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className="rounded-full border px-2.5 py-1 text-xs transition"
              style={on
                ? { backgroundColor: GOLD, color: '#000', borderColor: GOLD }
                : { backgroundColor: 'rgba(0,0,0,0.04)', color: '#1f1714', borderColor: 'rgba(0,0,0,0.10)' }}
            >
              {t}
            </button>
          )
        })}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="How was your visit? (optional)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30"
      />

      {/* Photos */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {photos.map((u, i) => (
          <div key={i} className="relative">
            <img src={u} alt="" className="h-14 w-14 rounded-lg object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setPhotos((s) => s.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < 6 && (
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-black/20 text-lg text-black/40">
            {uploading ? '…' : '＋'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
          </label>
        )}
        <span className="text-xs text-black/40">Add photos (optional)</span>
      </div>

      {err && <p className="mt-1 text-sm text-red-600" role="alert">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || uploading}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          style={{ backgroundColor: GOLD }}
        >
          {busy ? 'Posting…' : 'Post review'}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/70">
          Cancel
        </button>
      </div>
    </div>
  )
}
