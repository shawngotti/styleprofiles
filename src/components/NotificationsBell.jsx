import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const GOLD = '#F4A93C'
const ICON = { awards: '🏆', lineup: '🎬', booking: '📅', points: '✨', review: '⭐', chair: '📣', tag: '🏷' }

// Notification inbox in the header. Reads the user's notifications (RLS: self
// only), shows an unread badge, marks read on open/click. Feature-gated rows
// (e.g. feature='lineup') are hidden when that feature is dark, so a notification
// can never surface a hidden feature.
export default function NotificationsBell({ lineupOn, onNavigate }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id,kind,body,link_screen,feature,read,created_at')
      .eq('recipient_profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data || []).filter((n) => n.feature !== 'lineup' || lineupOn))
  }, [user.id, lineupOn])

  useEffect(() => {
    load()
  }, [load])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.filter((n) => !n.read).length

  async function openPanel() {
    setOpen((o) => !o)
  }

  async function markAll() {
    const ids = items.filter((n) => !n.read).map((n) => n.id)
    if (!ids.length) return
    setItems((cur) => cur.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', ids)
  }

  async function clickItem(n) {
    if (!n.read) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    }
    if (n.link_screen && onNavigate) {
      onNavigate(n.link_screen)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg border border-white/15 px-2.5 py-1.5 hover:bg-white/10"
      >
        🔔
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-black"
            style={{ backgroundColor: GOLD }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/10 bg-neutral-900 p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-white/50 hover:text-white/80">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-white/40">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => clickItem(n)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5 ${n.read ? 'opacity-60' : ''}`}
                >
                  <span aria-hidden>{ICON[n.kind] || '🔔'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{n.body}</span>
                    <span className="text-xs text-white/40">{new Date(n.created_at).toLocaleDateString()}</span>
                  </span>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: GOLD }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
