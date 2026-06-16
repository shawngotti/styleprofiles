import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const GOLD = '#F4A93C'
const TABS = [
  ['reports', 'Reports'],
  ['integrity', 'Vote Integrity'],
  ['attendees', 'Attendees'],
  ['demo', 'Demo'],
  ['flags', 'Feature Flags'],
]

// Admin moderation console. RLS already restricts every table here to admins;
// this is the UI over it. Reports queue, the §4.7 Vote Integrity tab (flags +
// anomaly scan), and the feature-flag switches that gate marketplace / lineup.
export default function AdminConsole() {
  const [tab, setTab] = useState('reports')
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
            style={tab === k ? { backgroundColor: GOLD, color: '#000' } : { backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'reports' && <Reports />}
      {tab === 'integrity' && <Integrity />}
      {tab === 'attendees' && <ImportAttendees />}
      {tab === 'demo' && <Demo />}
      {tab === 'flags' && <Flags />}
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
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 ${filter === s ? 'bg-white/15' : 'bg-white/5'}`}>
            {s}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-white/55">No reports.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {r.kind} {r.subject_handle && <span className="text-white/50">· {r.subject_handle}</span>}
                </div>
                <div className="mt-0.5 text-sm text-white/60">{r.reason}</div>
              </div>
              <span className="shrink-0 text-xs font-semibold" style={{ color: sevColor[r.severity] }}>{r.severity}</span>
            </div>
            {r.status === 'open' ? (
              <div className="mt-3 flex gap-2">
                <button onClick={() => resolve(r.id, 'resolved')} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>Resolve</button>
                <button onClick={() => resolve(r.id, 'dismissed')} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm">Dismiss</button>
              </div>
            ) : (
              <div className="mt-2 text-xs text-white/55">{r.status}</div>
            )}
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
        <p className="text-sm text-white/60">Anomalous voting flagged for review. Voiding a flag marks the suspect votes for exclusion.</p>
        <button onClick={scan} disabled={busy} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Scanning…' : 'Run anomaly scan'}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</p>}
      {flags.length === 0 ? (
        <p className="text-sm text-white/55">No vote flags.</p>
      ) : (
        flags.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm">{f.note}</div>
              <div className="text-xs text-white/55">{f.context} · {f.vote_count} votes · {f.status}</div>
            </div>
            {f.status === 'open' && (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setStatus(f.id, 'voided')} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs">Void</button>
                <button onClick={() => setStatus(f.id, 'cleared')} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs">Clear</button>
              </div>
            )}
          </div>
        ))
      )}
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
      <p className="text-sm text-white/60">Flags gate the API + data, not just the UI. Flipping a feature on makes its endpoints and data reachable.</p>
      {TOGGLES.map((key) => {
        const on = valueOf(key)
        return (
          <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="text-sm font-medium">{key}</span>
            <button
              onClick={() => toggle(key, on)}
              role="switch"
              aria-checked={on}
              aria-label={`Toggle ${key}`}
              className="relative h-6 w-11 rounded-full transition"
              style={{ backgroundColor: on ? GOLD : 'rgba(255,255,255,0.15)' }}
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
    return <p className="text-sm text-white/55">No events yet. Create an event before importing attendees.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        Import attendees sold off-platform (Posh, Eventbrite export, or a manual list) into the unified ledger.
        Re-importing the same rows is safe — they upsert on order/ticket id.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-white/50">Event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id} className="bg-neutral-900">
                {ev.title || 'Event'}{ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString()}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-white/50">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
            <option value="posh_vip" className="bg-neutral-900">Posh.Vip</option>
            <option value="eventbrite" className="bg-neutral-900">Eventbrite (export)</option>
            <option value="manual" className="bg-neutral-900">Manual list</option>
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">CSV</span>
          <label className="cursor-pointer text-xs text-white/50 hover:text-white/80">
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
        <p className="mt-1 text-xs text-white/55">
          Recognized columns: order_id/ticket_id, email, name, ticket_type, qty, amount (USD). Header row required.
        </p>
      </div>

      {parseErr && <p className="text-sm text-red-400" role="alert">{parseErr}</p>}
      {parsed.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="text-white/70">
            {parsed.length} row(s) parsed · {matched} with an email (matched to accounts on import)
          </div>
          <div className="mt-2 max-h-40 overflow-auto text-xs text-white/50">
            {parsed.slice(0, 5).map((r, i) => (
              <div key={i} className="truncate">
                {r.external_ref || '—'} · {r.email || 'no email'} · {r.name || ''} · {r.ticket_type || ''} · x{r.qty}
                {r.amount != null ? ` · $${(r.amount / 100).toFixed(2)}` : ''}
              </div>
            ))}
            {parsed.length > 5 && <div className="text-white/30">…and {parsed.length - 5} more</div>}
          </div>
        </div>
      )}

      {result && <p className={`text-sm ${result.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status" aria-live="polite">{result.text}</p>}

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

const inputCls = 'mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30'

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
      <p className="text-sm text-white/60">
        Stage a full, believable preview to share the vision. Seed the dataset, then flip each aspect on to
        reveal it publicly. Demo data is hidden from everyone until its toggle is on, and wipes cleanly.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('seed')} disabled={!!busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
          {busy === 'seed' ? 'Seeding…' : 'Seed demo content'}
        </button>
        <button onClick={() => run('clear')} disabled={!!busy} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">
          {busy === 'clear' ? 'Removing…' : 'Remove all demo content'}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status" aria-live="polite">{msg.text}</p>}

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40">Show / hide each aspect</div>
        {DEMO_TOGGLES.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="text-sm font-medium">{label}</span>
            <button
              onClick={() => toggle(key)}
              role="switch"
              aria-checked={on(key)}
              aria-label={`Toggle ${label}`}
              className="relative h-6 w-11 rounded-full transition"
              style={{ backgroundColor: on(key) ? GOLD : 'rgba(255,255,255,0.15)' }}
            >
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on(key) ? '22px' : '2px' }} />
            </button>
          </div>
        ))}
      </div>

      {(!on('marketplace_on') || !on('lineup_on')) && (
        <p className="text-xs text-white/45">
          Tip: to show the demo <strong>Shop</strong> turn on <code>marketplace_on</code>, and for{' '}
          <strong>The Lineup</strong> + <strong>Cut of the Week</strong> turn on <code>lineup_on</code> (Feature Flags tab).
          Demo Awards show under the existing Awards tab.
        </p>
      )}
    </div>
  )
}
