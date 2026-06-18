import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const GOLD = '#0FB9A6'
const TABS = [
  ['directory', 'Directory'],
  ['analytics', 'Analytics'],
  ['reports', 'Reports'],
  ['reviews', 'Reviews'],
  ['integrity', 'Vote Integrity'],
  ['attendees', 'Attendees'],
  ['demo', 'Demo'],
  ['home', 'Home'],
  ['flags', 'Feature Flags'],
]

// Admin moderation console. RLS already restricts every table here to admins;
// this is the UI over it. Reports queue, the §4.7 Vote Integrity tab (flags +
// anomaly scan), and the feature-flag switches that gate marketplace / lineup.
export default function AdminConsole({ onOpenPro }) {
  const [tab, setTab] = useState('directory')
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Admin console</h2>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="rounded-full px-4 py-1.5 text-sm font-medium"
            style={tab === k ? { backgroundColor: GOLD, color: '#000' } : { backgroundColor: 'rgba(0,0,0,0.06)' }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'directory' && <Directory onOpenPro={onOpenPro} />}
      {tab === 'analytics' && <Analytics onOpenPro={onOpenPro} />}
      {tab === 'reports' && <Reports />}
      {tab === 'reviews' && <ReviewsModeration />}
      {tab === 'integrity' && <Integrity />}
      {tab === 'attendees' && <ImportAttendees />}
      {tab === 'demo' && <Demo />}
      {tab === 'home' && <HomeHero />}
      {tab === 'flags' && <Flags />}
    </div>
  )
}

// Directory: admin browse of every pro and client, with a detail panel
// (roles, bookings, reviews, points). Reads ride on the is_admin() RLS policies.
function Directory({ onOpenPro }) {
  const [kind, setKind] = useState('pros') // 'pros' | 'clients'
  const [pros, setPros] = useState([])
  const [clients, setClients] = useState([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null) // { type, row, detail }

  useEffect(() => {
    supabase
      .from('pros')
      .select('id,handle,display_name,category,city,verified,charges_enabled,rating_avg,rating_count,avatar_url,cover_url,gallery_urls,bio,price_from,is_demo')
      .order('rating_avg', { ascending: false })
      .limit(500)
      .then(({ data }) => setPros(data || []))
    supabase
      .from('profiles')
      .select('id,display_name,email,city,style_points,loyalty_tier,created_at,user_roles(role)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setClients(data || []))
  }, [])

  async function openPro(p) {
    const [{ count: bookings }, { count: reviews }, { count: services }] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('pro_id', p.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('pro_id', p.id),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('pro_id', p.id).eq('active', true),
    ])
    setSel({ type: 'pro', row: p, detail: { bookings, reviews, services } })
  }
  async function openClient(c) {
    const [{ count: bookings }, { count: reviews }] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('client_profile_id', c.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('author_profile_id', c.id),
    ])
    setSel({ type: 'client', row: c, detail: { bookings, reviews } })
  }

  const ql = q.trim().toLowerCase()
  const proRows = pros.filter((p) => !ql || `${p.handle} ${p.display_name} ${p.category} ${p.city}`.toLowerCase().includes(ql))
  const clientRows = clients.filter((c) => !ql || `${c.display_name || ''} ${c.email || ''} ${c.city || ''}`.toLowerCase().includes(ql))

  // Detail panel
  if (sel) {
    const r = sel.row
    return (
      <div className="space-y-4">
        <button onClick={() => setSel(null)} className="text-sm text-black/55 underline">← Back to directory</button>
        {sel.type === 'pro' ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
            <div className="flex items-center gap-3">
              {r.avatar_url
                ? <img src={r.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                : <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-black" style={{ backgroundColor: GOLD }}>{(r.display_name || '?')[0]}</div>}
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">{r.display_name}{r.verified && <span style={{ color: GOLD }}>✓</span>}{r.is_demo && <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs text-black/50">demo</span>}</div>
                <div className="text-sm text-black/50">@{r.handle} · {r.category}{r.city ? ` · ${r.city}` : ''}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Rating" value={`${r.rating_avg ?? 0} (${r.rating_count})`} />
              <Stat label="Services" value={sel.detail.services ?? 0} />
              <Stat label="Bookings" value={sel.detail.bookings ?? 0} />
              <Stat label="Reviews" value={sel.detail.reviews ?? 0} />
            </div>
            <div className="mt-3 text-sm">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: r.charges_enabled ? '#34D399' : GOLD }}>
                {r.charges_enabled ? 'Accepting bookings' : 'Payouts not set up'}
              </span>
            </div>
            {r.bio && <p className="mt-3 text-sm text-black/60">{r.bio}</p>}
            <button onClick={() => onOpenPro?.(r, GOLD)} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>
              View public profile →
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
            <div className="text-lg font-semibold">{r.display_name || 'Client'}</div>
            <div className="text-sm text-black/50">{r.email}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(r.user_roles || []).map((x, i) => (
                <span key={i} className="rounded-full bg-black/10 px-2 py-0.5 text-xs">{x.role}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="StylePoints" value={r.style_points ?? 0} />
              <Stat label="Tier" value={r.loyalty_tier || 'Bronze'} />
              <Stat label="Bookings" value={sel.detail.bookings ?? 0} />
              <Stat label="Reviews" value={sel.detail.reviews ?? 0} />
            </div>
            {r.city && <div className="mt-3 text-sm text-black/50">📍 {r.city}</div>}
            <div className="mt-1 text-xs text-black/40">Joined {new Date(r.created_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-black/10 p-0.5">
          {[['pros', `Pros (${pros.length})`], ['clients', `Clients (${clients.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)} className="rounded-full px-4 py-1.5 text-sm font-medium transition"
              style={kind === k ? { backgroundColor: GOLD, color: '#000' } : { color: '#1f1714' }}>
              {label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40" />
      </div>

      {kind === 'pros' ? (
        <div className="space-y-2">
          {proRows.map((p) => (
            <button key={p.id} onClick={() => openPro(p)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white shadow-sm p-3 text-left hover:bg-black/[0.07]">
              <div className="flex items-center gap-3">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  : <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>{(p.display_name || '?')[0]}</div>}
                <div>
                  <div className="text-sm font-medium">{p.display_name} {p.is_demo && <span className="text-xs text-black/40">· demo</span>}</div>
                  <div className="text-xs text-black/50">@{p.handle} · {p.category}</div>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-black/50">
                <div style={{ color: GOLD }}>★ {p.rating_avg ?? 0}</div>
                <div>{p.charges_enabled ? 'live' : 'setup'}</div>
              </div>
            </button>
          ))}
          {proRows.length === 0 && <p className="text-sm text-black/55">No pros match.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {clientRows.map((c) => (
            <button key={c.id} onClick={() => openClient(c)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white shadow-sm p-3 text-left hover:bg-black/[0.07]">
              <div>
                <div className="text-sm font-medium">{c.display_name || c.email || 'Client'}</div>
                <div className="text-xs text-black/50">{c.email}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {(c.user_roles || []).map((x, i) => (
                  <span key={i} className="rounded-full bg-black/10 px-2 py-0.5 text-xs text-black/55">{x.role}</span>
                ))}
              </div>
            </button>
          ))}
          {clientRows.length === 0 && <p className="text-sm text-black/55">No clients match.</p>}
        </div>
      )}
    </div>
  )
}

// Analytics: per-pro popularity board (views, unique, conversions) + a
// completeness column so you can spot who needs help building their profile.
function Analytics({ onOpenPro }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('admin_pro_analytics', { _days: days }).then(({ data, error }) => {
      if (error) setErr(error.message)
      setRows(data || [])
      setLoading(false)
    })
  }, [days])

  const totalViews = rows.reduce((s, r) => s + Number(r.views), 0)
  const totalConv = rows.reduce((s, r) => s + Number(r.conversions), 0)
  // "Needs help" = live but getting little traction or an unfinished profile.
  const needsHelp = rows.filter((r) => r.completeness < 60 || (Number(r.views) === 0 && r.charges_enabled))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-black/60">Most-visited pros and who converts. Low completeness = a marketing/onboarding nudge.</p>
        <div className="inline-flex rounded-full border border-black/10 p-0.5 text-sm">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className="rounded-full px-3 py-1 font-medium transition"
              style={days === d ? { backgroundColor: GOLD, color: '#000' } : { color: '#1f1714' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-black/50">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={`Views (${days}d)`} value={totalViews} />
            <Stat label="Conversions" value={totalConv} />
            <Stat label="Needs help" value={needsHelp.length} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/45">
                <tr>
                  <th className="p-3">Pro</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Unique</th>
                  <th className="p-3 text-right">Booked</th>
                  <th className="p-3 text-right">Profile</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const conv = Number(r.unique_viewers) ? Math.round((Number(r.conversions) / Number(r.unique_viewers)) * 100) : 0
                  const weak = r.completeness < 60
                  return (
                    <tr key={r.pro_id} className="border-t border-black/5 hover:bg-black/[0.03]">
                      <td className="p-3">
                        <button onClick={() => onOpenPro?.({ id: r.pro_id, handle: r.handle, display_name: r.display_name }, GOLD)} className="text-left">
                          <div className="font-medium">{r.display_name} {r.is_demo && <span className="text-xs text-black/40">· demo</span>}</div>
                          <div className="text-xs text-black/45">@{r.handle}{!r.charges_enabled && ' · no payouts'}</div>
                        </button>
                      </td>
                      <td className="p-3 text-right font-medium">{r.views}</td>
                      <td className="p-3 text-right text-black/60">{r.unique_viewers}</td>
                      <td className="p-3 text-right">
                        {r.conversions > 0 ? <span className="font-medium" style={{ color: '#059669' }}>{r.conversions} ({conv}%)</span> : <span className="text-black/30">0</span>}
                      </td>
                      <td className="p-3 text-right">
                        <span style={{ color: weak ? '#F87171' : r.completeness >= 80 ? '#34D399' : '#1f1714' }}>{r.completeness}%</span>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-black/45">No pros yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
      <div className="text-xs text-black/45">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function Reports() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('open')
  const load = useCallback(async () => {
    let q = supabase.from('reports').select('id,kind,subject_handle,reason,severity,status,created_at').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRows(data || [])
  }, [filter])
  useEffect(() => {
    load()
  }, [load])

  async function resolve(id, status) {
    await supabase.from('reports').update({ status, resolved_at: new Date().toISOString() }).eq('id', id)
    load()
  }
  const sevColor = { high: '#F87171', med: GOLD, low: '#9CA3AF' }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {['open', 'resolved', 'dismissed', 'all'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 ${filter === s ? 'bg-black/15' : 'bg-black/5'}`}>
            {s}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-black/55">No reports.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {r.kind} {r.subject_handle && <span className="text-black/50">· {r.subject_handle}</span>}
                </div>
                <div className="mt-0.5 text-sm text-black/60">{r.reason}</div>
              </div>
              <span className="shrink-0 text-xs font-semibold" style={{ color: sevColor[r.severity] }}>{r.severity}</span>
            </div>
            {r.status === 'open' ? (
              <div className="mt-3 flex gap-2">
                <button onClick={() => resolve(r.id, 'resolved')} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>Resolve</button>
                <button onClick={() => resolve(r.id, 'dismissed')} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">Dismiss</button>
              </div>
            ) : (
              <div className="mt-2 text-xs text-black/55">{r.status}</div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// Reviews moderation: the auto/manual posting toggle + a queue of reviews to
// approve, hold, or remove. Admin writes go straight through RLS
// (reviews_admin_all); the rating cache + notifications react via triggers.
const REVIEW_FILTERS = [
  ['queue', 'Needs review'],
  ['flagged', 'Flagged'],
  ['pending', 'Pending'],
  ['approved', 'Live'],
  ['removed', 'Removed'],
  ['all', 'All'],
]
const RSTATUS_COLOR = { approved: '#34D399', pending: GOLD, flagged: '#FF6F6F', removed: '#9CA3AF' }

function ReviewsModeration() {
  const [mode, setMode] = useState(null) // 'auto' | 'manual'
  const [filter, setFilter] = useState('queue')
  const [rows, setRows] = useState([])
  const [adminId, setAdminId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id || null))
  }, [])

  const loadMode = useCallback(async () => {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'review_moderation_mode').maybeSingle()
    setMode(data?.value === 'manual' ? 'manual' : 'auto')
  }, [])

  const load = useCallback(async () => {
    let q = supabase
      .from('reviews')
      .select('id,rating,body,tags,status,photo_urls,moderation_reason,flagged_labels,created_at,verified,pro:pros(handle,display_name),review_responses(body)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter === 'queue') q = q.in('status', ['pending', 'flagged'])
    else if (filter !== 'all') q = q.eq('status', filter)
    const { data, error } = await q
    if (error) setMsg({ type: 'error', text: error.message })
    setRows(data || [])
  }, [filter])

  useEffect(() => {
    loadMode()
  }, [loadMode])
  useEffect(() => {
    load()
  }, [load])

  async function setPostingMode(next) {
    setMode(next) // optimistic
    await supabase.from('platform_settings').update({ value: next }).eq('key', 'review_moderation_mode')
    loadMode()
  }

  async function act(id, status) {
    setBusyId(id)
    setMsg(null)
    const patch = { status, moderated_at: new Date().toISOString() }
    if (status === 'removed') patch.removed_by = adminId
    const { error } = await supabase.from('reviews').update(patch).eq('id', id)
    setBusyId(null)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    load()
  }

  return (
    <div className="space-y-4">
      {/* Posting mode */}
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
        <div className="text-sm font-semibold">Review posting</div>
        <p className="mt-0.5 text-xs text-black/55">
          Auto publishes clean reviews instantly; flagged ones always wait here. Manual holds every review for approval.
        </p>
        <div className="mt-3 inline-flex rounded-full border border-black/10 p-0.5">
          {['auto', 'manual'].map((m) => (
            <button
              key={m}
              onClick={() => setPostingMode(m)}
              className="rounded-full px-4 py-1.5 text-sm font-medium capitalize transition"
              style={mode === m ? { backgroundColor: GOLD, color: '#000' } : { color: '#1f1714' }}
            >
              {m === 'auto' ? 'Auto-post' : 'Manual approve'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        {REVIEW_FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 ${filter === k ? 'bg-black/15' : 'bg-black/5'}`}>
            {label}
          </button>
        ))}
      </div>

      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status">{msg.text}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-black/55">Nothing here.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  <span style={{ color: GOLD }}>{'★'.repeat(r.rating)}</span>{' '}
                  <span className="text-black/50">@{r.pro?.handle}</span>
                  {r.verified && <span className="ml-1 text-xs text-black/40">· verified visit</span>}
                </div>
                {r.body && <p className="mt-1 text-sm text-black/70">{r.body}</p>}
              </div>
              <span className="shrink-0 text-xs font-semibold capitalize" style={{ color: RSTATUS_COLOR[r.status] }}>{r.status}</span>
            </div>

            {r.photo_urls?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.photo_urls.map((u, i) => (
                  <img key={i} src={u} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}

            {r.moderation_reason && <p className="mt-2 text-xs text-red-600">{r.moderation_reason}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== 'approved' && (
                <button onClick={() => act(r.id, 'approved')} disabled={busyId === r.id} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
                  Approve & publish
                </button>
              )}
              {r.status === 'approved' && (
                <button onClick={() => act(r.id, 'flagged')} disabled={busyId === r.id} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
                  Hold
                </button>
              )}
              {r.status !== 'removed' && (
                <button onClick={() => act(r.id, 'removed')} disabled={busyId === r.id} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-red-600">
                  Remove
                </button>
              )}
              {r.status === 'removed' && (
                <button onClick={() => act(r.id, 'approved')} disabled={busyId === r.id} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
                  Restore
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function Integrity() {
  const [flags, setFlags] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('vote_flags').select('id,context,note,vote_count,status,created_at').order('created_at', { ascending: false }).limit(100)
    setFlags(data || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function scan() {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.rpc('scan_vote_anomalies', { _minutes: 60, _threshold: 20 })
    setBusy(false)
    setMsg(error ? { type: 'error', text: error.message } : { type: 'ok', text: `Scan complete — ${data} new flag(s).` })
    load()
  }
  async function setStatus(id, status) {
    await supabase.from('vote_flags').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/60">Anomalous voting flagged for review. Voiding a flag marks the suspect votes for exclusion.</p>
        <button onClick={scan} disabled={busy} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Scanning…' : 'Run anomaly scan'}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{msg.text}</p>}
      {flags.length === 0 ? (
        <p className="text-sm text-black/55">No vote flags.</p>
      ) : (
        flags.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white shadow-sm p-3">
            <div className="min-w-0">
              <div className="text-sm">{f.note}</div>
              <div className="text-xs text-black/55">{f.context} · {f.vote_count} votes · {f.status}</div>
            </div>
            {f.status === 'open' && (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setStatus(f.id, 'voided')} className="rounded-lg border border-black/15 px-2.5 py-1 text-xs">Void</button>
                <button onClick={() => setStatus(f.id, 'cleared')} className="rounded-lg border border-black/15 px-2.5 py-1 text-xs">Clear</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// Home search-hero media: set the background video (and poster) by pasting a
// hosted MP4 link OR uploading to the home-media bucket. Stored in
// platform_settings; the home reads it via useSettings.
const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || '')

function HomeHero() {
  const [video, setVideo] = useState('')
  const [poster, setPoster] = useState('')
  const [landUrl, setLandUrl] = useState('')
  const [landPoster, setLandPoster] = useState('')
  const [uploading, setUploading] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', ['home_hero_video_url', 'home_hero_poster_url', 'landing_media_url', 'landing_media_poster_url'])
      .then(({ data }) => {
        const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]))
        setVideo(m.home_hero_video_url || '')
        setPoster(m.home_hero_poster_url || '')
        setLandUrl(m.landing_media_url || '')
        setLandPoster(m.landing_media_poster_url || '')
      })
  }, [])

  async function uploadTo(file, prefix, setUrl) {
    setUploading(prefix)
    setMsg(null)
    try {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('home-media').upload(path, file, { upsert: true, contentType: file.type || undefined })
      if (error) throw new Error(error.message)
      setUrl(supabase.storage.from('home-media').getPublicUrl(path).data.publicUrl)
    } catch (e) {
      setMsg({ type: 'error', text: `Upload failed: ${e.message}` })
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    const updates = [
      ['home_hero_video_url', video],
      ['home_hero_poster_url', poster],
      ['landing_media_url', landUrl],
      ['landing_media_poster_url', landPoster],
    ]
    let err = null
    for (const [k, v] of updates) {
      const r = await supabase.from('platform_settings').update({ value: v || '' }).eq('key', k)
      if (r.error) err = r.error
    }
    setBusy(false)
    setMsg(err ? { type: 'error', text: err.message } : { type: 'ok', text: 'Saved. Reload to see it.' })
  }

  const UploadLink = ({ prefix, setUrl, accept, label }) => (
    <label className="mt-2 inline-block cursor-pointer text-xs underline" style={{ color: GOLD }}>
      {uploading === prefix ? 'uploading…' : label}
      <input type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && uploadTo(e.target.files[0], prefix, setUrl)} />
    </label>
  )

  return (
    <div className="space-y-6">
      {/* Home search hero */}
      <div>
        <div className="text-sm font-semibold">Home search hero (signed in)</div>
        <p className="mt-0.5 text-sm text-black/55">
          Background video behind the home search bar. Paste a hosted <code>.mp4</code> or upload a short muted clip.
          A poster shows before it loads / for reduced-motion. Blank = built-in gradient.
        </p>
        <div className="relative mt-3 h-36 overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(125deg,#0c2b27,#0b3b35,#0FB9A6)' }}>
          {video ? <video src={video} poster={poster || undefined} autoPlay muted loop playsInline className="h-full w-full object-cover" />
            : poster ? <img src={poster} alt="" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 flex items-end p-4" style={{ background: 'rgba(0,0,0,0.42)' }}>
            <span className="text-xl font-bold text-white">Find your next look</span>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium">Background video</div>
            <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…/clip.mp4" className={inputCls} />
            <UploadLink prefix="hero-video" setUrl={setVideo} accept="video/*" label="or upload a clip" />
          </div>
          <div>
            <div className="text-sm font-medium">Poster image</div>
            <input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://…/poster.jpg" className={inputCls} />
            <UploadLink prefix="hero-poster" setUrl={setPoster} accept="image/*" label="or upload an image" />
          </div>
        </div>
      </div>

      {/* Landing featured media */}
      <div className="border-t border-black/[0.06] pt-5">
        <div className="text-sm font-semibold">Landing featured media (logged out)</div>
        <p className="mt-0.5 text-sm text-black/55">
          The big featured image on the public landing page. Paste an image or <code>.mp4</code> link, or upload one.
          Blank = the default photo. (Add a poster when using a video.)
        </p>
        <div className="mt-3 h-44 overflow-hidden rounded-2xl border border-black/[0.06] bg-black/5">
          {landUrl ? (
            isVideoUrl(landUrl)
              ? <video src={landUrl} poster={landPoster || undefined} autoPlay muted loop playsInline className="h-full w-full object-cover" />
              : <img src={landUrl} alt="" className="h-full w-full object-cover" />
          ) : <div className="flex h-full items-center justify-center text-sm text-black/40">Default photo</div>}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium">Image or video</div>
            <input value={landUrl} onChange={(e) => setLandUrl(e.target.value)} placeholder="https://…/feature.jpg or .mp4" className={inputCls} />
            <UploadLink prefix="landing-media" setUrl={setLandUrl} accept="image/*,video/*" label="or upload a file" />
          </div>
          <div>
            <div className="text-sm font-medium">Poster (if video)</div>
            <input value={landPoster} onChange={(e) => setLandPoster(e.target.value)} placeholder="https://…/poster.jpg" className={inputCls} />
            <UploadLink prefix="landing-poster" setUrl={setLandPoster} accept="image/*" label="or upload an image" />
          </div>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}

      <div className="flex gap-2 border-t border-black/[0.06] pt-4">
        <button onClick={save} disabled={busy || !!uploading} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
          {busy ? 'Saving…' : 'Save media'}
        </button>
      </div>
    </div>
  )
}

function Flags() {
  const [settings, setSettings] = useState([])
  const TOGGLES = ['marketplace_on', 'lineup_on', 'awards_on']
  const load = useCallback(async () => {
    const { data } = await supabase.from('platform_settings').select('key,value').in('key', TOGGLES)
    setSettings(data || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function toggle(key, current) {
    await supabase.from('platform_settings').update({ value: !current }).eq('key', key)
    load()
  }
  const valueOf = (key) => settings.find((s) => s.key === key)?.value === true

  return (
    <div className="space-y-3">
      <p className="text-sm text-black/60">Flags gate the API + data, not just the UI. Flipping a feature on makes its endpoints and data reachable.</p>
      {TOGGLES.map((key) => {
        const on = valueOf(key)
        return (
          <div key={key} className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
            <span className="text-sm font-medium">{key}</span>
            <button
              onClick={() => toggle(key, on)}
              role="switch"
              aria-checked={on}
              aria-label={`Toggle ${key}`}
              className="relative h-6 w-11 rounded-full transition"
              style={{ backgroundColor: on ? GOLD : 'rgba(0,0,0,0.14)' }}
            >
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? '22px' : '2px' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// CSV parser that respects quoted fields, embedded commas, and "" escapes.
function parseCSV(text) {
  const rows = []
  let cur = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      cur.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      cur.push(field)
      rows.push(cur)
      cur = []
      field = ''
    } else field += c
  }
  if (field.length || cur.length) {
    cur.push(field)
    rows.push(cur)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Header aliases -> our attendee fields.
const ALIASES = {
  external_ref: ['external_ref', 'order_id', 'order id', 'order #', 'ticket_id', 'ticket id', 'confirmation', 'id'],
  email: ['email', 'email address', 'e-mail'],
  name: ['name', 'attendee', 'full name', 'attendee name'],
  ticket_type: ['ticket_type', 'ticket type', 'type', 'ticket', 'tier'],
  qty: ['qty', 'quantity', 'tickets'],
  amount: ['amount', 'total', 'price', 'paid', 'gross'],
  status: ['status'],
}

function mapRows(text) {
  const grid = parseCSV(text)
  if (grid.length < 2) return { rows: [], error: 'Need a header row plus at least one data row.' }
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const idx = {}
  for (const [field, names] of Object.entries(ALIASES)) {
    idx[field] = header.findIndex((h) => names.includes(h))
  }
  const rows = grid.slice(1).map((cols) => {
    const get = (f) => (idx[f] >= 0 ? (cols[idx[f]] ?? '').trim() : '')
    const amt = get('amount')
    const qty = parseInt(get('qty'), 10)
    return {
      external_ref: get('external_ref') || null,
      email: get('email') || null,
      name: get('name') || null,
      ticket_type: get('ticket_type') || null,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      amount: amt ? Math.round(parseFloat(amt.replace(/[^0-9.]/g, '')) * 100) : null, // dollars -> cents
      status: get('status') || 'confirmed',
    }
  })
  return { rows, error: null }
}

// Import ticket attendees sold off-platform (Posh, Eventbrite export, manual)
// into the unified event_attendees ledger via the admin import RPC. Idempotent
// on (source, external_ref); rows with an email are matched to a profile.
function ImportAttendees() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [source, setSource] = useState('posh_vip')
  const [csv, setCsv] = useState('')
  const [parsed, setParsed] = useState([])
  const [parseErr, setParseErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id,title,venue,event_date')
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        setEvents(data || [])
        if (data?.[0]) setEventId(data[0].id)
      })
  }, [])

  function onCsv(text) {
    setCsv(text)
    setResult(null)
    if (!text.trim()) {
      setParsed([])
      setParseErr(null)
      return
    }
    const { rows, error } = mapRows(text)
    setParsed(rows)
    setParseErr(error)
  }

  async function doImport() {
    setBusy(true)
    setResult(null)
    const { data, error } = await supabase.rpc('import_event_attendees', {
      _event_id: eventId,
      _source: source,
      _rows: parsed,
    })
    setBusy(false)
    setResult(error ? { type: 'error', text: error.message } : { type: 'ok', text: `Imported ${data} attendee row(s).` })
    if (!error) {
      setCsv('')
      setParsed([])
    }
  }

  const matched = parsed.filter((r) => r.email).length

  if (events.length === 0) {
    return <p className="text-sm text-black/55">No events yet. Create an event before importing attendees.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-black/60">
        Import attendees sold off-platform (Posh, Eventbrite export, or a manual list) into the unified ledger.
        Re-importing the same rows is safe — they upsert on order/ticket id.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-black/50">Event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id} className="bg-white">
                {ev.title || 'Event'}{ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString()}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-black/50">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
            <option value="posh_vip" className="bg-white">Posh.Vip</option>
            <option value="eventbrite" className="bg-white">Eventbrite (export)</option>
            <option value="manual" className="bg-white">Manual list</option>
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-black/50">CSV</span>
          <label className="cursor-pointer text-xs text-black/50 hover:text-black/80">
            Upload .csv
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) f.text().then(onCsv)
              }}
            />
          </label>
        </div>
        <textarea
          value={csv}
          onChange={(e) => onCsv(e.target.value)}
          rows={6}
          placeholder={'order_id,email,name,ticket_type,qty,amount\nA1001,fan@example.com,Jordan Fan,GA,2,50.00'}
          className={`${inputCls} font-mono text-xs`}
        />
        <p className="mt-1 text-xs text-black/55">
          Recognized columns: order_id/ticket_id, email, name, ticket_type, qty, amount (USD). Header row required.
        </p>
      </div>

      {parseErr && <p className="text-sm text-red-600" role="alert">{parseErr}</p>}
      {parsed.length > 0 && (
        <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-3 text-sm">
          <div className="text-black/70">
            {parsed.length} row(s) parsed · {matched} with an email (matched to accounts on import)
          </div>
          <div className="mt-2 max-h-40 overflow-auto text-xs text-black/50">
            {parsed.slice(0, 5).map((r, i) => (
              <div key={i} className="truncate">
                {r.external_ref || '—'} · {r.email || 'no email'} · {r.name || ''} · {r.ticket_type || ''} · x{r.qty}
                {r.amount != null ? ` · $${(r.amount / 100).toFixed(2)}` : ''}
              </div>
            ))}
            {parsed.length > 5 && <div className="text-black/30">…and {parsed.length - 5} more</div>}
          </div>
        </div>
      )}

      {result && <p className={`text-sm ${result.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{result.text}</p>}

      <button
        onClick={doImport}
        disabled={busy || parsed.length === 0 || !eventId}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        style={{ backgroundColor: GOLD }}
      >
        {busy ? 'Importing…' : `Import ${parsed.length || ''} attendee${parsed.length === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}

const inputCls = 'mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30'

// Demo content control: seed/clear a believable dataset and show or hide it per
// aspect. Demo rows are flagged is_demo and stay invisible to the public until
// the matching toggle is on — so you can stage the full vision, then wipe it.
const DEMO_TOGGLES = [
  ['demo_pros_on', 'Demo pros & profiles'],
  ['demo_awards_on', 'Demo Awards'],
  ['demo_lineup_on', 'Demo The Lineup'],
  ['demo_deals_on', 'Demo Deals'],
  ['demo_shop_on', 'Demo Shop'],
]

function Demo() {
  const [settings, setSettings] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const keys = [...DEMO_TOGGLES.map((t) => t[0]), 'marketplace_on', 'lineup_on']
    const { data } = await supabase.from('platform_settings').select('key,value').in('key', keys)
    setSettings(data || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const on = (key) => settings.find((s) => s.key === key)?.value === true
  async function toggle(key) {
    await supabase.from('platform_settings').update({ value: !on(key) }).eq('key', key)
    load()
  }
  async function run(action) {
    setBusy(action)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('demo_content', { body: { action } })
    setBusy(null)
    if (error) {
      let text = `Could not ${action}`
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    setMsg({ type: 'ok', text: action === 'seed' ? `Seeded ${data?.seeded?.pros ?? ''} demo pros + content.` : 'Demo content removed.' })
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/60">
        Stage a full, believable preview to share the vision. Seed the dataset, then flip each aspect on to
        reveal it publicly. Demo data is hidden from everyone until its toggle is on, and wipes cleanly.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('seed')} disabled={!!busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
          {busy === 'seed' ? 'Seeding…' : 'Seed demo content'}
        </button>
        <button onClick={() => run('clear')} disabled={!!busy} className="rounded-lg border border-black/15 px-4 py-2 text-sm text-black/80 hover:bg-black/10 disabled:opacity-50">
          {busy === 'clear' ? 'Removing…' : 'Remove all demo content'}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-black/40">Show / hide each aspect</div>
        {DEMO_TOGGLES.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
            <span className="text-sm font-medium">{label}</span>
            <button
              onClick={() => toggle(key)}
              role="switch"
              aria-checked={on(key)}
              aria-label={`Toggle ${label}`}
              className="relative h-6 w-11 rounded-full transition"
              style={{ backgroundColor: on(key) ? GOLD : 'rgba(0,0,0,0.14)' }}
            >
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on(key) ? '22px' : '2px' }} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-black/45">
        Each toggle reveals its own demo content — no need to launch the real feature. The demo <strong>Shop</strong> and{' '}
        <strong>The Lineup</strong> run <strong>browse-only</strong> (no real checkout or voting). Demo Awards show under the Awards tab.
      </p>
    </div>
  )
}
