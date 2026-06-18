import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const GOLD = '#0FB9A6'

// Privacy opt-out: when off, the pros whose pages you view see you as "Someone"
// instead of your name (profiles.hide_profile_views; RLS self-write).
export default function ProfileViewsToggle() {
  const { user } = useAuth()
  const [share, setShare] = useState(null) // true = let pros see my name

  useEffect(() => {
    supabase
      .from('profiles')
      .select('hide_profile_views')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setShare(data?.hide_profile_views !== true))
  }, [user.id])

  async function toggle() {
    const next = !share
    setShare(next)
    await supabase.from('profiles').update({ hide_profile_views: !next }).eq('id', user.id)
  }

  if (share === null) return null

  return (
    <div className="flex items-center justify-between">
      <dt className="text-black/50">Show my name to pros I view</dt>
      <dd>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={share}
          aria-label="Toggle profile-view visibility"
          className="relative h-5 w-9 rounded-full transition"
          style={{ backgroundColor: share ? GOLD : 'rgba(0,0,0,0.14)' }}
        >
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: share ? '18px' : '2px' }} />
        </button>
      </dd>
    </div>
  )
}
