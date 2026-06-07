import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd, initials } from '../lib/format.js'

const GOLD = '#F4A93C'

// Discover: live pro storefronts from Supabase (replaces the prototype's
// in-memory PROS array). Public-read RLS lets even signed-out users browse.
export default function Discover({ onOpenPro }) {
  const [cats, setCats] = useState([])
  const [pros, setPros] = useState([])
  const [active, setActive] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let on = true
    ;(async () => {
      const [catRes, proRes] = await Promise.all([
        supabase.from('service_categories').select('slug,label,color').eq('active', true).order('sort'),
        supabase
          .from('pros')
          .select('id,handle,display_name,category,bio,city,verified,rating_avg,rating_count,price_from')
          .order('rating_avg', { ascending: false }),
      ])
      if (!on) return
      if (catRes.error || proRes.error) {
        setError((catRes.error || proRes.error).message)
        setLoading(false)
        return
      }
      setCats(catRes.data)
      setPros(proRes.data)
      setLoading(false)
    })()
    return () => {
      on = false
    }
  }, [])

  const catColor = useMemo(() => Object.fromEntries(cats.map((c) => [c.slug, c.color])), [cats])
  const catLabel = useMemo(() => Object.fromEntries(cats.map((c) => [c.slug, c.label])), [cats])
  const shown = active === 'all' ? pros : pros.filter((p) => p.category === active)

  if (loading) return <p className="text-sm text-white/50">Loading pros…</p>
  if (error) return <p className="text-sm text-red-400">Could not load pros: {error}</p>

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip active={active === 'all'} label="All" onClick={() => setActive('all')} />
        {cats.map((c) => (
          <Chip
            key={c.slug}
            active={active === c.slug}
            color={c.color}
            label={c.label}
            onClick={() => setActive(c.slug)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {shown.map((p) => (
          <div
            key={p.id}
            data-testid={`pro-${p.handle}`}
            onClick={() => onOpenPro?.(p, catColor[p.category] || GOLD)}
            className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${onOpenPro ? 'cursor-pointer hover:bg-white/[0.07]' : ''} transition`}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-black"
                style={{ backgroundColor: catColor[p.category] || GOLD }}
              >
                {initials(p.display_name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{p.display_name}</span>
                  {p.verified && (
                    <span title="Verified" style={{ color: '#56C2FF' }}>
                      ✓
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-white/50">@{p.handle}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: catColor[p.category] || '#fff' }}
              >
                {catLabel[p.category] || p.category}
              </span>
              <span className="text-white/70">
                ★ {p.rating_avg} <span className="text-white/40">({p.rating_count})</span>
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span className="truncate">{p.city}</span>
              <span className="text-white/80">from {centsToUsd(p.price_from)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-white/30">
        {shown.length} pro{shown.length === 1 ? '' : 's'} · live from Supabase
      </p>
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
