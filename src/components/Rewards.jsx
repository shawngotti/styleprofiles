import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const GOLD = '#0FB9A6'
const TIER_COLOR = { Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#0FB9A6', Platinum: '#56C2FF' }

// Client loyalty: StylePoints balance + tier, redeemable rewards, and recent
// ledger activity. Earning happens server-side on booking completion; redeeming
// goes through the redeem_reward RPC (balance checked server-side).
export default function Rewards() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [rewards, setRewards] = useState([])
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const [p, r, t] = await Promise.all([
      supabase.from('profiles').select('style_points,loyalty_tier').eq('id', user.id).single(),
      supabase.from('rewards').select('id,name,cost_points').eq('active', true).order('cost_points'),
      supabase
        .from('loyalty_transactions')
        .select('id,delta,reason,created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setProfile(p.data)
    setRewards(r.data || [])
    setTxns(t.data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function redeem(id) {
    setBusyId(id)
    setMsg(null)
    const { data, error } = await supabase.rpc('redeem_reward', { _reward_id: id })
    setBusyId(null)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'info', text: `Redeemed “${data.reward}” — new balance ${data.balance} pts.` })
    load()
  }

  if (loading) return <p className="text-sm text-black/50">Loading rewards…</p>

  const balance = profile?.style_points ?? 0
  const tier = profile?.loyalty_tier ?? 'Bronze'

  return (
    <div className="space-y-6">
      {/* Balance / tier */}
      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-black/55">StylePoints</p>
        <div className="mt-1 flex items-end justify-between">
          <div className="text-3xl font-semibold" style={{ color: GOLD }}>
            {balance.toLocaleString()} <span className="text-base font-normal text-black/50">pts</span>
          </div>
          <span
            className="rounded-full px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: TIER_COLOR[tier] || '#1f1714' }}
          >
            {tier}
          </span>
        </div>
        <p className="mt-2 text-xs text-black/55">Earn 1 point per $1 on completed visits.</p>
      </section>

      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}

      {/* Rewards */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">Rewards</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {rewards.map((r) => {
            const affordable = balance >= r.cost_points
            return (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-black/50">{r.cost_points.toLocaleString()} pts</div>
                </div>
                <button
                  onClick={() => redeem(r.id)}
                  disabled={!affordable || busyId === r.id}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
                  style={{ backgroundColor: GOLD }}
                  title={affordable ? '' : 'Not enough points yet'}
                >
                  {busyId === r.id ? '…' : 'Redeem'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Activity */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/55">Recent activity</h3>
        {txns.length === 0 ? (
          <p className="text-sm text-black/55">No points activity yet — book and complete a visit to earn.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
            {txns.map((t, i) => (
              <div key={t.id} className={`flex items-center justify-between p-3 text-sm ${i ? 'border-t border-black/5' : ''}`}>
                <div>
                  <div>{t.reason}</div>
                  <div className="text-xs text-black/55">{new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span className={t.delta >= 0 ? 'text-emerald-600' : 'text-black/60'}>
                  {t.delta >= 0 ? '+' : ''}
                  {t.delta} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
