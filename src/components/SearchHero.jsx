import { useEffect, useState } from 'react'

const ACCENT = '#0FB9A6'
const INK = '#06403a'

// Full-bleed signed-in home hero (option A). Background is an admin-set looping
// video (muted/autoplay/loop) with a poster fallback; respects
// prefers-reduced-motion. Search + category chips are overlaid directly on the
// video. The media spans the viewport while content aligns to the page column.
export default function SearchHero({ videoUrl, posterUrl, query, onQuery, onNearMe, nearMeActive, onClearNearMe, cats = [], active, onPickCat }) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(m.matches)
    apply()
    m.addEventListener?.('change', apply)
    return () => m.removeEventListener?.('change', apply)
  }, [])

  const showVideo = !!videoUrl && !reduceMotion
  const chip = (key, label) => {
    const on = active === key
    return (
      <button
        key={key}
        onClick={() => onPickCat?.(key)}
        className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium backdrop-blur transition"
        style={on ? { backgroundColor: ACCENT, color: INK } : { backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
      >
        {label}
      </button>
    )
  }

  return (
    <section className="relative" style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}>
      <div className="relative" style={{ minHeight: 320 }}>
        {showVideo ? (
          <video className="absolute inset-0 h-full w-full object-cover" src={videoUrl} poster={posterUrl || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
        ) : posterUrl ? (
          <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(125deg, #0c2b27 0%, #0b3b35 45%, ${ACCENT} 140%)` }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.44)' }} />

        <div className="relative mx-auto flex max-w-5xl flex-col justify-end gap-3 px-4 pb-6 pt-16 sm:px-6" style={{ minHeight: 320 }}>
          <h1 className="text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl">
            Find your next look
          </h1>
          <p className="max-w-md text-sm text-white/85">
            Book top barbers, stylists, nail &amp; lash artists near you.
          </p>

          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
              <span aria-hidden>🔍</span>
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search by name, service, or city"
                aria-label="Search pros"
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </label>
            <button
              onClick={nearMeActive ? onClearNearMe : onNearMe}
              className="shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition hover:brightness-95"
              style={{ backgroundColor: ACCENT, color: INK }}
            >
              {nearMeActive ? '✓ Near you' : '📍 Near me'}
            </button>
          </div>

          <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {chip('all', 'All')}
            {cats.map((c) => chip(c.slug, c.label))}
          </div>
        </div>
      </div>
    </section>
  )
}
