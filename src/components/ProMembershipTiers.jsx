import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd } from '../lib/format.js'

const GOLD = '#0FB9A6'
const EMPTY = { name: '', price: '', disc: '', includes: '' }

// Pro-authored membership tiers (RLS tiers_owner_write — direct, no Edge Function).
// Create, edit, and delete tiers. (Stripe price is created lazily on first
// subscribe, so editing here is safe; deleting is blocked by FK if members exist.)
export default function ProMembershipTiers({ proId }) {
  const [tiers, setTiers] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('membership_tiers')
      .select('id,name,price,member_discount_pct,includes')
      .eq('pro_id', proId)
      .order('price')
    setTiers(data || [])
  }, [proId])

  useEffect(() => {
    load()
  }, [load])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  function reset() {
    setForm(EMPTY)
    setEditingId(null)
    setErr(null)
  }
  function startEdit(t) {
    setEditingId(t.id)
    setForm({ name: t.name, price: String(t.price / 100), disc: String(t.member_discount_pct), includes: t.includes || '' })
    setErr(null)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.price) return
    setBusy(true)
    setErr(null)
    const row = {
      name: form.name.trim(),
      price: Math.round(Number(form.price) * 100),
      member_discount_pct: Number(form.disc) || 0,
      includes: form.includes.trim() || null,
    }
    const res = editingId
      ? await supabase.from('membership_tiers').update(row).eq('id', editingId)
      : await supabase.from('membership_tiers').insert({ ...row, pro_id: proId, perks: [] })
    setBusy(false)
    if (res.error) {
      setErr(res.error.message)
      return
    }
    reset()
    load()
  }

  async function remove(id) {
    if (!window.confirm('Delete this tier? This cannot be undone.')) return
    setErr(null)
    const { error } = await supabase.from('membership_tiers').delete().eq('id', id)
    if (error) {
      setErr(error.message.includes('foreign key') || error.code === '23503'
        ? 'This tier has active members and can’t be deleted. Edit it instead.'
        : error.message)
      return
    }
    if (editingId === id) reset()
    load()
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Membership tiers</h3>
      {tiers.length > 0 ? (
        <div className="mt-3 space-y-2">
          {tiers.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{t.name}</div>
                <div className="truncate text-xs text-black/50">{t.includes}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div>{centsToUsd(t.price)}/mo</div>
                  <div className="text-xs text-black/50">{t.member_discount_pct}% off</div>
                </div>
                <button onClick={() => startEdit(t)} className="rounded-lg border border-black/15 px-2.5 py-1 text-xs hover:bg-black/10">Edit</button>
                <button onClick={() => remove(t.id)} className="rounded-lg border border-black/15 px-2.5 py-1 text-xs text-red-600 hover:bg-black/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-black/55">No tiers yet — create one to offer memberships.</p>
      )}

      <form onSubmit={save} className="mt-4 flex flex-wrap gap-2">
        <input value={form.name} onChange={set('name')} placeholder="Tier name" className="min-w-[140px] flex-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40" />
        <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="$/mo" inputMode="decimal" className="w-24 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40" />
        <input value={form.disc} onChange={(e) => setForm((f) => ({ ...f, disc: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="% off" inputMode="numeric" className="w-20 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40" />
        <input value={form.includes} onChange={set('includes')} placeholder="Includes (e.g. 2 cuts / month)" className="min-w-[160px] flex-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40" />
        <button type="submit" disabled={busy || !form.name.trim() || !form.price} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50" style={{ backgroundColor: GOLD }}>
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add tier'}
        </button>
        {editingId && (
          <button type="button" onClick={reset} className="rounded-lg border border-black/15 px-4 py-2.5 text-sm text-black/70 hover:bg-black/10">Cancel</button>
        )}
      </form>
      {err && <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>}
    </section>
  )
}
