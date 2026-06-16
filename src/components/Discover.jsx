import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd, initials } from '../lib/format.js'

const GOLD = '#F4A93C'
const RADII = [25, 50, 100]

// Discover: live pro storefronts. Default sorts by rating; "Near me" uses
// browser geolocation + the pros_near RPC to sort by distance within a radius.
export default function Discover({ onOpenPro }) {
  const [cats, setCats] = useState([])
  const [pros, setPros] = useState([])
  const [active, setActive] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [coords, setCoords] = useState(null) // { lat, lng } when "near me" is on
  const [radiusMi, setRadiusMi] = useState(50)
  const [geoMsg, setGeoMsg] = useState(null)

  // Categories load once.
  useEffect(() => {
    supabase
      .from('service_categories')
      .select('slug,label,color')
      .eq('active', true)
      .order('sort')
      .then(({ data }) => setCats(data || []))
  }, [])

  // Pros load on mount and whenever the location/radius changes.
  useEffect(() => {
    let on = true
    ;(async () => {
      setLoading(true)
      const res = coords
        ? await supabase.rpc('pros_near', { _lat: coords.lat, _lng: coords.lng, _radius_mi: radiusMi })
        : await supabase
            .from('pros')
            .select('id,handle,display_name,category,bio,city,verified,rating_avg,rating_count,price_from,charges_enabled,featured_until,champion_boost,avatar_url,cover_url,gallery_urls')
            .order('rating_avg', { ascending: false })
      if (!on) return
      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      setPros(res.data)
      setLoading(false)
    })()
    return () => {
      on = false
    }
  }, [coords, radiusMi])

  const catColor = useMemo(() => Object.fromEntries(cats.map((c) => [c.slug, c.color])), [cats])
  const catLabel = useMemo(() => Object.fromEntries(cats.map((c) => [c.slug, c.label])), [cats])
  // Champion perk: a live featured slot floats the pro to the top; the permanent
  // boost nudges the rating-sorted ranking. In "near me" mode distance order is
  // preserved (stable sort) — featured is only a top lift.
  const isFeatured = (p) => p.featured_until && new Date(p.featured_until) > new Date()
  const filtered = active === 'all' ? pros : pros.filter((p) => p.category === active)
  const shown = [...filtered].sort((a, b) => {
    const fa = isFeatured(a) ? 1 : 0
    const fb = isFeatured(b) ? 1 : 0
    if (fa !== fb) return fb - fa
    if (coords) return 0 // keep distance order from pros_near
    return (b.rating_avg + (b.champion_boost || 0)) - (a.rating_avg + (a.champion_boost || 0))
  })

  function useMyLocation() {
    setGeoMsg(null)
    if (!navigator.geolocation) {
      setGeoMsg('Geolocation is not supported on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoMsg(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <div>
      {/* Location bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {coords ? (
          <>
            <span className="text-sm text-white/60">📍 Near you</span>
            {RADII.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusMi(r)}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition"
                style={radiusMi === r ? { backgroundColor: GOLD, color: '#000' } : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}
              >
                {r} mi
              </button>
            ))}
            <button onClick={() => setCoords(null)} className="text-xs text-white/50 underline hover:text-white">
              Clear
            </button>
          </>
        ) : (
          <button
            onClick={useMyLocation}
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            📍 Near me
          </button>
        )}
      </div>
      {geoMsg && <p className="mb-2 text-xs text-amber-400" role="status" aria-live="polite">{geoMsg}</p>}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Chip active={active === 'all'} label="All" onClick={() => setActive('all')} />
        {cats.map((c) => (
          <Chip key={c.slug} active={active === c.slug} color={c.color} label={c.label} onClick={() => setActive(c.slug)} />
        ))}
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-white/50">Loading pros…</p>
      ) : error ? (
        <p className="mt-5 text-sm text-red-400">Could not load pros: {error}</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <div
                key={p.id}
                data-testid={`pro-${p.handle}`}
                role={onOpenPro ? 'button' : undefined}
                tabIndex={onOpenPro ? 0 : undefined}
                aria-label={onOpenPro ? `View ${p.display_name}'s storefront` : undefined}
                onClick={() => onOpenPro?.(p, catColor[p.category] || GOLD)}
                onKeyDown={(e) => {
                  if (onOpenPro && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onOpenPro(p, catColor[p.category] || GOLD)
                  }
                }}
                className={`overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${onOpenPro ? 'cursor-pointer hover:bg-white/[0.07]' : ''} transition`}
              >
                {p.cover_url && <img src={p.cover_url} alt="" loading="lazy" className="h-24 w-full object-cover" />}
                <div className="p-4">
                <div className="flex items-center gap-3">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-black"
                      style={{ backgroundColor: catColor[p.category] || GOLD }}
                    >
                      {initials(p.display_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{p.display_name}</span>
                      {p.verified && (
                        <span title="Verified" style={{ color: '#56C2FF' }}>
                          ✓
                        </span>
                      )}
                      {isFeatured(p) && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-black" style={{ backgroundColor: GOLD }} title="Lineup champion — featured">
                          👑 Champion
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-white/50">@{p.handle}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: catColor[p.category] || '#fff' }}>
                    {catLabel[p.category] || p.category}
                  </span>
                  <span className="text-white/70">
                    ★ {p.rating_avg} <span className="text-white/55">({p.rating_count})</span>
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                  <span className="truncate">
                    {p.city}
                    {p.distance_mi != null && <span className="text-white/70"> · {Math.round(p.distance_mi)} mi</span>}
                  </span>
                  <span className="text-white/80">from {centsToUsd(p.price_from)}</span>
                </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-white/30">
            {shown.length} pro{shown.length === 1 ? '' : 's'}
            {coords ? ` within ${radiusMi} mi` : ''} · live from Supabase
          </p>
        </>
      )}
    </div>
  )
}

function Chip({ active, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm font-medium transition"
      style={active ? { backgroundColor: color || GOLD, color: '#000' } : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}
    >
      {label}
    </button>
  )
}
