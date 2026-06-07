import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const GOLD = '#F4A93C'
const TABS = [
  ['reports', 'Reports'],
  ['integrity', 'Vote Integrity'],
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
        <p className="text-sm text-white/40">No reports.</p>
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
              <div className="mt-2 text-xs text-white/40">{r.status}</div>
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
        <p className="text-sm text-white/40">No vote flags.</p>
      ) : (
        flags.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="min-w-0">
              <div className="text-sm">{f.note}</div>
              <div className="text-xs text-white/40">{f.context} · {f.vote_count} votes · {f.status}</div>
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
