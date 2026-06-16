import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Tag & Consent inbox. A pro who features you in a look (portfolio, Awards, The
// Lineup, Cut of the Week) opens a consent request; nothing publishes until you
// resolve it here. Resolving fires the DB triggers that publish (public/
// anonymous) or pull (declined/private) the linked media — server-side.
export default function ConsentRequests() {
  const { user } = useAuth()
  const [rows, setRows] = useState(undefined)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('consent_requests')
      .select('id,look_label,for_contest,status,created_at,pro:pros(display_name,handle)')
      .eq('subject_profile_id', user.id)
      .order('created_at', { ascending: false })
    setRows(data || [])
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(id, status) {
    setBusy(id)
    setMsg(null)
    const { error } = await supabase
      .from('consent_requests')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setBusy(null)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    track('consent_resolved', { status })
    load()
  }

  if (rows === undefined) return <p className="text-sm text-black/50">Loading tag requests…</p>

  const pending = rows.filter((r) => r.status === 'pending')
  const resolved = rows.filter((r) => r.status !== 'pending')
  const STATUS_LABEL = { public: 'Public credit', anonymous: 'Anonymous', private: 'Private', declined: 'Declined' }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tag requests</h2>
        <p className="mt-1 text-sm text-black/60">
          Pros want to feature you in their work. You decide how — nothing goes public without your consent.
        </p>
      </div>
      {msg && <p className="text-sm text-red-600" role="alert">{msg.text}</p>}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">Pending</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-black/55">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-black/10 bg-black/5 p-4">
                <div className="text-sm">
                  <span className="font-medium">{r.pro?.display_name}</span>{' '}
                  <span className="text-black/50">wants to feature {r.look_label ? `“${r.look_label}”` : 'a look'}</span>
                  {r.for_contest && <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>competition</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => resolve(r.id, 'public')} disabled={busy === r.id} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
                    Approve · public credit
                  </button>
                  <button onClick={() => resolve(r.id, 'anonymous')} disabled={busy === r.id} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/10 disabled:opacity-50">
                    Approve · anonymous
                  </button>
                  <button onClick={() => resolve(r.id, 'declined')} disabled={busy === r.id} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/70 hover:bg-black/10 disabled:opacity-50">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">History</h3>
          <div className="space-y-2">
            {resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-4 py-2.5 text-sm">
                <span className="text-black/70">
                  {r.pro?.display_name} · {r.look_label || 'a look'}
                </span>
                <span className="text-xs text-black/50">{STATUS_LABEL[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
