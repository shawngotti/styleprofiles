import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { centsToUsd } from '../lib/format.js'

const GOLD = '#F4A93C'

// Pro-authored membership tiers (RLS tiers_owner_write — direct, no Edge Function).
export default function ProMembershipTiers({ proId }) {
  const [tiers, setTiers] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [disc, setDisc] = useState('')
  const [includes, setIncludes] = useState('')
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

  async function create(e) {
    e.preventDefault()
    if (!name.trim() || !price) return
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('membership_tiers').insert({
      pro_id: proId,
      name: name.trim(),
      price: Math.round(Number(price) * 100),
      member_discount_pct: Number(disc) || 0,
      includes: includes.trim() || null,
      perks: [],
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setName('')
    setPrice('')
    setDisc('')
    setIncludes('')
    load()
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">Membership tiers</h3>
      {tiers.length > 0 ? (
        <div className="mt-3 space-y-2">
          {tiers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3 text-sm">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-white/50">{t.includes}</div>
              </div>
              <div className="text-right">
                <div>{centsToUsd(t.price)}/mo</div>
                <div className="text-xs text-white/50">{t.member_discount_pct}% off</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/40">No tiers yet — create one to offer memberships.</p>
      )}

      <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tier name"
          className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="$/mo"
          inputMode="decimal"
          className="w-24 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
        />
        <input
          value={disc}
          onChange={(e) => setDisc(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="% off"
          inputMode="numeric"
          className="w-20 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
        />
        <input
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
          placeholder="Includes (e.g. 2 cuts / month)"
          className="min-w-[160px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={busy || !name.trim() || !price}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          style={{ backgroundColor: GOLD }}
        >
          {busy ? 'Adding…' : 'Add tier'}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </section>
  )
}
