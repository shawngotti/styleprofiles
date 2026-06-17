import { useEffect, useState } from 'react'

const GOLD = '#F4A93C'

// The signed-in home hero. Background is an admin-set looping video (muted,
// autoplay, loop) with a poster fallback; respects prefers-reduced-motion (shows
// the poster instead of playing). A dark overlay keeps the search legible.
export default function SearchHero({ videoUrl, posterUrl, query, onQuery, onNearMe, nearMeActive, onClearNearMe }) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(m.matches)
    apply()
    m.addEventListener?.('change', apply)
    return () => m.removeEventListener?.('change', apply)
  }, [])

  const showVideo = !!videoUrl && !reduceMotion

  return (
    <section className="relative mb-5 overflow-hidden rounded-3xl shadow-sm" style={{ minHeight: 230 }}>
      {showVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoUrl}
          poster={posterUrl || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ) : posterUrl ? (
        <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(125deg, #181410 0%, #3a2a12 55%, ${GOLD} 130%)` }} />
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.42)' }} />

      <div className="relative flex flex-col justify-end gap-3 p-6 sm:p-8" style={{ minHeight: 230 }}>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
          Find your next look
        </h1>
        <p className="max-w-md text-sm text-white/80">
          Book top barbers, stylists, nail &amp; lash artists near you — deposits, loyalty, and the people who get you.
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
            style={{ backgroundColor: GOLD, color: '#2c1d04' }}
          >
            {nearMeActive ? '✓ Near you' : '📍 Near me'}
          </button>
        </div>
      </div>
    </section>
  )
}
