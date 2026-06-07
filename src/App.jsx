import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient.js'

// Minimal connectivity check for the scaffold. This proves the Supabase client
// is wired to the project via env vars. Real auth UI + roles context come next.
export default function App() {
  const [status, setStatus] = useState('checking…')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let active = true
    async function check() {
      // 1) Auth reachable?
      const { error: authErr } = await supabase.auth.getSession()
      if (authErr) {
        if (active) { setStatus('auth error'); setDetail(authErr.message) }
        return
      }
      // 2) Data reachable under RLS? Read the public seed categories.
      const { data, error } = await supabase
        .from('service_categories')
        .select('slug,label')
        .order('sort')
      if (!active) return
      if (error) { setStatus('db error'); setDetail(error.message); return }
      setStatus('connected')
      setDetail(`${data.length} service categories: ${data.map((c) => c.label).join(', ')}`)
    }
    check()
    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-3xl font-semibold">
          Style<span style={{ color: 'var(--sp-gold)' }}>Profiles</span>
        </h1>
        <p className="mt-2 text-sm text-white/60">Scaffold — Supabase connectivity check</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status === 'connected' ? '#34D399' : '#F4A93C' }}
          />
          {status}
        </div>
        {detail && <p className="mt-4 text-xs text-white/50 break-words">{detail}</p>}
      </div>
    </div>
  )
}
