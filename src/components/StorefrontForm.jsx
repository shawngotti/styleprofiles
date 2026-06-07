import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const GOLD = '#F4A93C'
const TRAVEL = [
  { value: 'shop', label: 'Clients come to my shop' },
  { value: 'mobile', label: 'I travel to clients' },
  { value: 'both', label: 'Both' },
]

// Create or edit a pro storefront. RLS lets a user write only their own pros row
// (profile_id = auth.uid()). Booking acceptance still gates on Stripe payouts
// (handled separately in ProDashboard).
export default function StorefrontForm({ pro, onSaved }) {
  const { user } = useAuth()
  const editing = !!pro
  const [cats, setCats] = useState([])
  const [form, setForm] = useState({
    handle: pro?.handle || '',
    display_name: pro?.display_name || '',
    category: pro?.category || '',
    bio: pro?.bio || '',
    city: pro?.city || '',
    price_from: pro?.price_from != null ? String(Math.round(pro.price_from / 100)) : '',
    travel_mode: pro?.travel_mode || 'shop',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('slug,label')
      .eq('active', true)
      .order('sort')
      .then(({ data }) => setCats(data || []))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    setMsg(null)
    if (!form.handle.trim() || !form.display_name.trim() || !form.category) {
      setBusy(false)
      setMsg({ type: 'error', text: 'Handle, name, and category are required.' })
      return
    }
    const row = {
      profile_id: user.id,
      handle: form.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
      display_name: form.display_name.trim(),
      category: form.category,
      bio: form.bio.trim() || null,
      city: form.city.trim() || null,
      price_from: form.price_from ? Math.round(Number(form.price_from) * 100) : null,
      travel_mode: form.travel_mode,
    }
    const res = editing
      ? await supabase.from('pros').update(row).eq('id', pro.id)
      : await supabase.from('pros').insert(row)
    setBusy(false)
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message.includes('duplicate') ? 'That handle is taken.' : res.error.message })
      return
    }
    onSaved?.()
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
        {editing ? 'Edit storefront' : 'Create your storefront'}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Handle" hint="@yourname">
          <input value={form.handle} onChange={set('handle')} placeholder="dre.thebarber" className={inputCls} />
        </Field>
        <Field label="Display name">
          <input value={form.display_name} onChange={set('display_name')} placeholder="Dre Carter" className={inputCls} />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={set('category')} className={inputCls}>
            <option value="" className="bg-neutral-900">Choose…</option>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug} className="bg-neutral-900">{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <input value={form.city} onChange={set('city')} placeholder="Chicago, IL" className={inputCls} />
        </Field>
        <Field label="Starting price (USD)">
          <input value={form.price_from} onChange={set('price_from')} inputMode="numeric" placeholder="45" className={inputCls} />
        </Field>
        <Field label="Travel">
          <select value={form.travel_mode} onChange={set('travel_mode')} className={inputCls}>
            {TRAVEL.map((t) => (
              <option key={t.value} value={t.value} className="bg-neutral-900">{t.label}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Bio">
            <textarea value={form.bio} onChange={set('bio')} rows={2} placeholder="What you do and who you do it for." className={inputCls} />
          </Field>
        </div>
      </div>
      {msg && <p className="mt-3 text-sm text-red-400" role="alert">{msg.text}</p>}
      <button onClick={save} disabled={busy} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Create storefront'}
      </button>
    </section>
  )
}

const inputCls = 'mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30'

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="text-white/50">{label}{hint && <span className="text-white/30"> · {hint}</span>}</span>
      {children}
    </label>
  )
}
