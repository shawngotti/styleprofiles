import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd, initials } from '../lib/format.js'

const GOLD = '#F4A93C'

function Stars({ value = 0 }) {
  const full = Math.round(value)
  return (
    <span style={{ color: GOLD }}>
      {'★'.repeat(full)}
      <span className="text-white/20">{'★'.repeat(5 - full)}</span>
    </span>
  )
}

// Pro Profile: a storefront detail view. Loads the pro's services (real +
// add-ons) and recent reviews live from Supabase. Booking arrives next ticket.
export default function ProProfile({ pro, catColor = GOLD, onBack }) {
  const [services, setServices] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bookMsg, setBookMsg] = useState(null)

  useEffect(() => {
    let on = true
    ;(async () => {
      const [svcRes, revRes] = await Promise.all([
        supabase
          .from('services')
          .select('id,name,duration_min,price,deposit,is_addon,sort')
          .eq('pro_id', pro.id)
          .eq('active', true)
          .order('sort'),
        supabase
          .from('reviews')
          .select('id,rating,body,tags,verified,created_at')
          .eq('pro_id', pro.id)
          .order('created_at', { ascending: false }),
      ])
      if (!on) return
      if (svcRes.error || revRes.error) {
        setError((svcRes.error || revRes.error).message)
        setLoading(false)
        return
      }
      setServices(svcRes.data)
      setReviews(revRes.data)
      setLoading(false)
    })()
    return () => {
      on = false
    }
  }, [pro.id])

  const mainServices = services.filter((s) => !s.is_addon)
  const addons = services.filter((s) => s.is_addon)

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/60 hover:text-white">
        ← Back to Discover
      </button>

      {/* Banner */}
      <div
        className="h-28 rounded-2xl border border-white/10"
        style={{ background: `linear-gradient(120deg, ${catColor}55, rgba(255,255,255,0.04))` }}
      />

      {/* Header */}
      <div className="-mt-8 flex items-end gap-4 px-2">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-black ring-4"
          style={{ backgroundColor: catColor, '--tw-ring-color': '#0b0b0d' }}
        >
          {initials(pro.display_name)}
        </div>
        <div className="pb-1">
          <div className="flex items-center gap-2 text-2xl font-semibold">
            {pro.display_name}
            {pro.verified && <span style={{ color: GOLD }}>✓</span>}
          </div>
          <div className="text-sm text-white/50">@{pro.handle}</div>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-2 text-sm">
        <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: catColor }}>
          {pro.category}
        </span>
        <span>
          <Stars value={pro.rating_avg} /> <b>{pro.rating_avg}</b>{' '}
          <span className="text-white/40">({pro.rating_count} reviews)</span>
        </span>
        <span className="text-white/50">📍 {pro.city}</span>
      </div>
      {pro.bio && <p className="mt-3 max-w-xl px-2 text-sm leading-relaxed text-white/60">{pro.bio}</p>}

      {loading && <p className="mt-6 px-2 text-sm text-white/50">Loading services…</p>}
      {error && <p className="mt-6 px-2 text-sm text-red-400">Could not load: {error}</p>}

      {!loading && !error && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Services */}
          <section>
            <h3 className="mb-2 px-2 text-sm font-semibold uppercase tracking-wide text-white/40">Services</h3>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {mainServices.map((s, i) => (
                <div key={s.id} className={`flex items-center justify-between gap-3 p-4 ${i ? 'border-t border-white/5' : ''}`}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-white/50">
                      {s.duration_min} min · {centsToUsd(s.price)}
                      {s.deposit > 0 && <span className="text-white/40"> · {centsToUsd(s.deposit)} deposit</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setBookMsg(s.name)}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black"
                    style={{ backgroundColor: GOLD }}
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>

            {addons.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 px-2 text-sm font-semibold uppercase tracking-wide text-white/40">
                  Frequently added
                </h3>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {addons.map((s, i) => (
                    <div key={s.id} className={`flex items-center justify-between gap-3 p-3 ${i ? 'border-t border-white/5' : ''}`}>
                      <span className="truncate text-sm">{s.name}</span>
                      <span className="shrink-0 text-sm text-white/60">+{centsToUsd(s.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {bookMsg && (
              <p className="mt-3 px-2 text-xs text-white/50">
                Booking <strong className="text-white/80">{bookMsg}</strong> — the booking flow lands in the next
                Batch 7 ticket (atomic booking + deposit).
              </p>
            )}
          </section>

          {/* Reviews */}
          <section>
            <h3 className="mb-2 px-2 text-sm font-semibold uppercase tracking-wide text-white/40">Recent reviews</h3>
            {reviews.length === 0 ? (
              <p className="px-2 text-sm text-white/40">No written reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.verified ? 'Verified client' : 'Client'}</span>
                      <Stars value={r.rating} />
                    </div>
                    {r.body && <p className="mt-1.5 text-sm text-white/70">{r.body}</p>}
                    {r.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.tags.map((t) => (
                          <span key={t} className="rounded-full bg-black/40 px-2 py-0.5 text-xs text-white/50">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
