import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd, initials } from '../lib/format.js'
import SearchHero from './SearchHero.jsx'

const GOLD = '#0FB9A6'
const RADII = [25, 50, 100]

// Discover: live pro storefronts, fronted by a video search hero. Default sorts
// by rating; "Near me" uses browser geolocation + the pros_near RPC to sort by
// distance within a radius. Free-text search filters by name/service/city.
export default function Discover({ onOpenPro, heroVideoUrl, heroPosterUrl }) {
  const [cats, setCats] = useState([])
  const [pros, setPros] = useState([])
  const [active, setActive] = useState('all')
  const [query, setQuery] = useState('')
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
  const q = query.trim().toLowerCase()
  const filtered = pros.filter((p) => {
    if (active !== 'all' && p.category !== active) return false
    if (q && !`${p.display_name} ${p.handle} ${p.category} ${catLabel[p.category] || ''} ${p.city || ''}`.toLowerCase().includes(q)) return false
    return true
  })
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
      <SearchHero
        videoUrl={heroVideoUrl}
        posterUrl={heroPosterUrl}
        query={query}
        onQuery={setQuery}
        nearMeActive={!!coords}
        onNearMe={useMyLocation}
        onClearNearMe={() => setCoords(null)}
        cats={cats}
        active={active}
        onPickCat={setActive}
      />

      {/* Radius selector — only while "near me" is active */}
      {coords && (
        <div className="mb-1 mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-black/60">Within</span>
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadiusMi(r)}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition"
              style={radiusMi === r ? { backgroundColor: GOLD, color: '#06403a' } : { backgroundColor: 'rgba(0,0,0,0.06)', color: '#1f1714' }}
            >
              {r} mi
            </button>
          ))}
        </div>
      )}
      {geoMsg && <p className="mb-2 mt-2 text-xs text-amber-600" role="status" aria-live="polite">{geoMsg}</p>}

      <h2 className="mt-6 text-lg font-semibold text-gray-900">
        {active === 'all' ? 'Top pros near you' : (catLabel[active] || 'Pros')}
      </h2>

      {loading ? (
        <p className="mt-5 text-sm text-black/50">Loading pros…</p>
      ) : error ? (
        <p className="mt-5 text-sm text-red-600">Could not load pros: {error}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                className={`overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm transition ${onOpenPro ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
              >
                {p.cover_url && <img src={p.cover_url} alt="" loading="lazy" className="h-28 w-full object-cover" />}
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
                    <div className="truncate text-xs text-black/50">@{p.handle}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: catColor[p.category] || '#1f1714' }}>
                    {catLabel[p.category] || p.category}
                  </span>
                  <span className="text-black/70">
                    ★ {p.rating_avg} <span className="text-black/55">({p.rating_count})</span>
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-black/50">
                  <span className="truncate">
                    {p.city}
                    {p.distance_mi != null && <span className="text-black/70"> · {Math.round(p.distance_mi)} mi</span>}
                  </span>
                  <span className="text-black/80">from {centsToUsd(p.price_from)}</span>
                </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-black/30">
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
      style={active ? { backgroundColor: color || GOLD, color: '#000' } : { backgroundColor: 'rgba(0,0,0,0.06)', color: '#1f1714' }}
    >
      {label}
    </button>
  )
}
