import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd } from '../lib/format.js'

const GOLD = '#F4A93C'
const TYPES = [
  ['last_minute', 'Last-minute opening'],
  ['cancellation', 'Cancellation fill'],
  ['slow_day', 'Slow-day discount'],
]
const EXPIRES = [
  ['1', 'In 1 hour'],
  ['3', 'In 3 hours'],
  ['6', 'Today (6h)'],
]
const STATUS_COLOR = { open: GOLD, claimed: '#34D399', expired: 'rgba(255,255,255,0.4)' }

// Pro-side Fill My Chair: post a time-sensitive discounted opening and watch it
// get claimed. Posting notifies past clients (server trigger); claiming creates a
// real discounted booking (server-authoritative).
export default function FillMyChair({ proId }) {
  const [services, setServices] = useState([])
  const [promos, setPromos] = useState([])
  const [form, setForm] = useState({ service_id: '', slot_at: '', promo_type: 'last_minute', discount_pct: '0', audience: 'loyalty', expires: '3' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const [{ data: svcs }, { data: pr }] = await Promise.all([
      supabase.from('services').select('id,name,price').eq('pro_id', proId).eq('is_addon', false).eq('active', true).order('sort'),
      supabase.from('chair_promotions').select('id,slot_at,slot_label,promo_type,discount_pct,status,notified_count,claimed_by_profile_id,service:services(name)').eq('pro_id', proId).order('created_at', { ascending: false }),
    ])
    setServices(svcs || [])
    setPromos(pr || [])
    if (svcs?.[0] && !form.service_id) setForm((f) => ({ ...f, service_id: svcs[0].id }))
  }, [proId, form.service_id])

  useEffect(() => {
    load()
  }, [load])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function post() {
    setBusy(true)
    setMsg(null)
    if (!form.service_id || !form.slot_at) {
      setBusy(false)
      setMsg({ type: 'error', text: 'Pick a service and a slot time.' })
      return
    }
    const slotIso = new Date(form.slot_at).toISOString()
    const expiresIso = new Date(Date.now() + Number(form.expires) * 3600000).toISOString()
    const { error } = await supabase.from('chair_promotions').insert({
      pro_id: proId,
      service_id: form.service_id,
      slot_at: slotIso,
      slot_label: new Date(form.slot_at).toLocaleString(),
      promo_type: form.promo_type,
      discount_pct: Number(form.discount_pct),
      audience: form.audience,
      expires_at: expiresIso,
      status: 'open',
    })
    setBusy(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'ok', text: 'Deal posted — your clients have been notified.' })
    setForm((f) => ({ ...f, slot_at: '' }))
    load()
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">Fill my chair</h3>
      <p className="mt-1 text-sm text-white/60">Turn a cancellation or slow day into a booked slot — post a flash deal and blast it to your clients.</p>

      {services.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">Add a service to your storefront first.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-white/50">Service</span>
            <select value={form.service_id} onChange={set('service_id')} className={inputCls}>
              {services.map((s) => (
                <option key={s.id} value={s.id} className="bg-neutral-900">{s.name} · {centsToUsd(s.price)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Slot date &amp; time</span>
            <input type="datetime-local" value={form.slot_at} onChange={set('slot_at')} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Deal type</span>
            <select value={form.promo_type} onChange={set('promo_type')} className={inputCls}>
              {TYPES.map(([v, l]) => <option key={v} value={v} className="bg-neutral-900">{l}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Discount</span>
            <select value={form.discount_pct} onChange={set('discount_pct')} className={inputCls}>
              {['0', '10', '15', '20', '25'].map((d) => <option key={d} value={d} className="bg-neutral-900">{d === '0' ? 'None' : `${d}% off`}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Notify</span>
            <select value={form.audience} onChange={set('audience')} className={inputCls}>
              <option value="waitlist" className="bg-neutral-900">Waitlist</option>
              <option value="loyalty" className="bg-neutral-900">Loyalty members</option>
              <option value="followers" className="bg-neutral-900">All followers</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Expires</span>
            <select value={form.expires} onChange={set('expires')} className={inputCls}>
              {EXPIRES.map(([v, l]) => <option key={v} value={v} className="bg-neutral-900">{l}</option>)}
            </select>
          </label>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status" aria-live="polite">{msg.text}</p>}
      {services.length > 0 && (
        <button onClick={post} disabled={busy} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Posting…' : 'Blast this deal'}
        </button>
      )}

      {promos.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Your deals</h4>
          <div className="space-y-2">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium">{p.service?.name || 'Service'}</span>
                  {p.discount_pct > 0 && <span className="ml-2" style={{ color: '#34D399' }}>{p.discount_pct}% off</span>}
                  <div className="text-xs text-white/40">
                    {p.slot_at ? new Date(p.slot_at).toLocaleString() : p.slot_label} · {p.notified_count} notified
                  </div>
                </div>
                <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[p.status] }}>
                  {p.status === 'claimed' ? '✓ Claimed' : p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

const inputCls = 'mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30'
