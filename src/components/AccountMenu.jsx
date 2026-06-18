import { useEffect, useRef, useState } from 'react'
import EmailPrefToggle from './EmailPrefToggle.jsx'
import ProfileViewsToggle from './ProfileViewsToggle.jsx'

const ACCENT = '#0FB9A6'

// Top-right avatar dropdown. Holds the Client/Pro/Admin perspective switch,
// account settings (email + view-sharing toggles), the landing preview, and
// sign out — replacing the old in-page "Perspective" box and "Your account" card.
export default function AccountMenu({ user, perspectives, perspective, setPerspective, onPreviewLanding, signOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const name = (user?.email || '').split('@')[0]
  const initial = (user?.email || '?')[0].toUpperCase()

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full border border-black/10 p-0.5 pr-1.5 transition hover:bg-black/[0.04]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
          {initial}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`text-black/40 transition ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-black/[0.08] bg-white p-3 shadow-xl">
          <div className="flex items-center gap-3 border-b border-black/[0.06] pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>{initial}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium capitalize">{name}</div>
              <div className="truncate text-xs text-black/50">{user?.email}</div>
            </div>
          </div>

          {perspectives.length > 1 && (
            <div className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-black/40">Viewing as</div>
              <div className="mt-1.5 flex gap-1">
                {perspectives.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setPerspective(p.key); setOpen(false) }}
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition"
                    style={perspective === p.key ? { backgroundColor: ACCENT, color: '#06403a' } : { backgroundColor: 'rgba(0,0,0,0.05)', color: '#1f1714' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 border-t border-black/[0.06] pt-3">
            <dl className="space-y-2 text-sm">
              <EmailPrefToggle />
              <ProfileViewsToggle />
            </dl>
          </div>

          <div className="mt-2 space-y-0.5 border-t border-black/[0.06] pt-2">
            <button onClick={() => { onPreviewLanding(); setOpen(false) }} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-black/[0.04]">
              Preview landing page
            </button>
            <button onClick={signOut} className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-black/[0.04]">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
