import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { initials } from '../lib/format.js'

const GOLD = '#0FB9A6'

function timeAgo(s) {
  if (!s) return ''
  const d = (Date.now() - new Date(s).getTime()) / 1000
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

// Pro Insights: page-visit analytics + the view→book conversion funnel +
// named recent visitors (privacy-aware) + a profile-completeness nudge.
export default function ProInsights({ pro }) {
  const [stats, setStats] = useState(null)
  const [visitors, setVisitors] = useState([])
  const [services, setServices] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let on = true
    ;(async () => {
      const [s, v, svc] = await Promise.all([
        supabase.rpc('pro_view_stats', { _pro_id: pro.id }),
        supabase.rpc('pro_recent_visitors', { _pro_id: pro.id, _limit: 30 }),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('pro_id', pro.id).eq('active', true),
      ])
      if (!on) return
      if (s.error) setErr(s.error.message)
      setStats(s.data || null)
      setVisitors(v.data || [])
      setServices(svc.count || 0)
      setLoading(false)
    })()
    return () => {
      on = false
    }
  }, [pro.id])

  if (loading) return <p className="text-sm text-black/50">Loading insights…</p>
  if (err) return <p className="text-sm text-red-600">{err}</p>

  const total = stats?.total_views || 0
  const unique = stats?.unique_viewers || 0
  const converted = stats?.converted_viewers || 0
  const completeness = stats?.completeness ?? 0
  const convRate = unique ? Math.round((converted / unique) * 100) : 0

  // Profile-completeness checklist (mirrors pro_completeness's 7 signals).
  const checklist = [
    ['Profile photo', !!pro.avatar_url],
    ['Cover photo', !!pro.cover_url],
    ['3+ portfolio photos', (pro.gallery_urls?.length || 0) >= 3],
    ['A bio (30+ chars)', !!pro.bio && pro.bio.length > 30],
    ['Starting price set', pro.price_from != null],
    ['Payouts enabled', !!pro.charges_enabled],
    ['3+ services', services >= 3],
  ]
  const missing = checklist.filter(([, done]) => !done)

  return (
    <div className="space-y-5">
      {/* Funnel */}
      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Page visits → bookings</h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Funnel label="Page views" value={total} sub={`${stats?.views_7d || 0} this week`} />
          <Funnel label="Unique visitors" value={unique} sub={total ? `${Math.round((unique / total) * 100)}% of views` : '—'} />
          <Funnel label="Booked" value={converted} sub={`${convRate}% conversion`} highlight />
        </div>
        <p className="mt-3 text-xs text-black/45">
          A visit counts once per person every 30 minutes. “Booked” means a visitor went on to book you — your true
          conversion rate.
        </p>
      </section>

      {/* Completeness */}
      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Profile strength</h3>
          <span className="text-sm font-semibold" style={{ color: completeness >= 80 ? '#34D399' : GOLD }}>{completeness}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full transition-all" style={{ width: `${completeness}%`, backgroundColor: completeness >= 80 ? '#34D399' : GOLD }} />
        </div>
        {missing.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-600">✓ Your profile is fully built out — great for conversions.</p>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-black/60">Complete these to win more bookings:</p>
            <ul className="mt-2 space-y-1">
              {missing.map(([label]) => (
                <li key={label} className="flex items-center gap-2 text-sm text-black/70">
                  <span className="text-black/30">○</span> {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Visitors */}
      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Recent visitors</h3>
        {visitors.length === 0 ? (
          <p className="mt-2 text-sm text-black/55">No visits yet. Share your profile link to start tracking.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {visitors.map((v) => (
              <div key={v.viewer_profile_id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black"
                    style={{ backgroundColor: v.avatar_color || 'rgba(0,0,0,0.10)' }}
                  >
                    {v.display_name ? initials(v.display_name) : '👤'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{v.display_name || 'Someone'}</div>
                    <div className="text-xs text-black/45">
                      {v.views} visit{v.views === 1 ? '' : 's'} · {timeAgo(v.last_view)}
                    </div>
                  </div>
                </div>
                {v.booked && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(52,211,153,0.15)', color: '#059669' }}>
                    Booked
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-black/40">
          Visitors who’ve turned off view-sharing appear as “Someone.”
        </p>
      </section>
    </div>
  )
}

function Funnel({ label, value, sub, highlight }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 text-center">
      <div className="text-2xl font-bold" style={highlight ? { color: GOLD } : undefined}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-black/60">{label}</div>
      <div className="text-xs text-black/40">{sub}</div>
    </div>
  )
}
