import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const GOLD = '#F4A93C'

// Per-user email opt-out (profiles.email_notifications; RLS self-write). The
// enqueue_email trigger honors this before queueing anything.
export default function EmailPrefToggle() {
  const { user } = useAuth()
  const [on, setOn] = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('email_notifications')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setOn(data?.email_notifications !== false))
  }, [user.id])

  async function toggle() {
    const next = !on
    setOn(next)
    await supabase.from('profiles').update({ email_notifications: next }).eq('id', user.id)
  }

  if (on === null) return null

  return (
    <div className="flex items-center justify-between">
      <dt className="text-black/50">Email notifications</dt>
      <dd>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={on}
          aria-label="Toggle email notifications"
          className="relative h-5 w-9 rounded-full transition"
          style={{ backgroundColor: on ? GOLD : 'rgba(0,0,0,0.14)' }}
        >
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? '18px' : '2px' }} />
        </button>
      </dd>
    </div>
  )
}
