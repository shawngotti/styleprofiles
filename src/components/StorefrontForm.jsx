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
    avatar_url: pro?.avatar_url || '',
    cover_url: pro?.cover_url || '',
    gallery_urls: pro?.gallery_urls || [],
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [msg, setMsg] = useState(null)

  // Upload to the public pro-media bucket (own folder = profile id) and return URL.
  async function upload(file, prefix) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/${prefix}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('pro-media').upload(path, file, { upsert: true, contentType: file.type || undefined })
    if (error) throw new Error(error.message)
    return supabase.storage.from('pro-media').getPublicUrl(path).data.publicUrl
  }
  async function onPick(prefix, e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUploading(prefix)
    setMsg(null)
    try {
      if (prefix === 'gallery') {
        const urls = []
        for (const f of files.slice(0, 6)) urls.push(await upload(f, 'gallery'))
        setForm((s) => ({ ...s, gallery_urls: [...s.gallery_urls, ...urls].slice(0, 12) }))
      } else {
        const url = await upload(files[0], prefix)
        setForm((s) => ({ ...s, [`${prefix}_url`]: url }))
      }
    } catch (e2) {
      setMsg({ type: 'error', text: `Upload failed: ${e2.message}` })
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

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
      avatar_url: form.avatar_url || null,
      cover_url: form.cover_url || null,
      gallery_urls: form.gallery_urls,
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
    <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">
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
            <option value="" className="bg-white">Choose…</option>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug} className="bg-white">{c.label}</option>
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
              <option key={t.value} value={t.value} className="bg-white">{t.label}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Bio">
            <textarea value={form.bio} onChange={set('bio')} rows={2} placeholder="What you do and who you do it for." className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Photos */}
      <div className="mt-5 space-y-3">
        <div className="text-sm text-black/50">Photos</div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="cursor-pointer text-center">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/10 text-xs text-black/50">＋</div>
            )}
            <div className="mt-1 text-xs text-black/50">{uploading === 'avatar' ? 'Uploading…' : 'Avatar'}</div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick('avatar', e)} />
          </label>
          <label className="cursor-pointer text-center">
            {form.cover_url ? (
              <img src={form.cover_url} alt="" className="h-16 w-28 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-black/10 text-xs text-black/50">＋</div>
            )}
            <div className="mt-1 text-xs text-black/50">{uploading === 'cover' ? 'Uploading…' : 'Cover'}</div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick('cover', e)} />
          </label>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm text-black/50">
            Portfolio
            <label className="cursor-pointer text-xs underline" style={{ color: GOLD }}>
              {uploading === 'gallery' ? 'uploading…' : '+ add photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick('gallery', e)} />
            </label>
          </div>
          {form.gallery_urls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.gallery_urls.map((u, i) => (
                <div key={i} className="relative">
                  <img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => setForm((s) => ({ ...s, gallery_urls: s.gallery_urls.filter((_, j) => j !== i) }))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-red-600" role="alert">{msg.text}</p>}
      <button onClick={save} disabled={busy} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Create storefront'}
      </button>
    </section>
  )
}

const inputCls = 'mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30'

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="text-black/50">{label}{hint && <span className="text-black/30"> · {hint}</span>}</span>
      {children}
    </label>
  )
}
