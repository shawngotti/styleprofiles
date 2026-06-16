import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import ProMembershipTiers from './ProMembershipTiers.jsx'
import SubmitAwardEntry from './SubmitAwardEntry.jsx'
import StorefrontForm from './StorefrontForm.jsx'
import FillMyChair from './FillMyChair.jsx'

const GOLD = '#F4A93C'

// Pro dashboard. For now: the Stripe payouts/onboarding card. Booking
// acceptance is gated on charges_enabled (mirrored from Stripe by the server).
export default function ProDashboard() {
  const { user } = useAuth()
  const [pro, setPro] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(false)

  const loadPro = useCallback(async () => {
    const { data, error } = await supabase
      .from('pros')
      .select('id,handle,display_name,category,bio,city,price_from,travel_mode,charges_enabled,payouts_enabled,stripe_account_id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (error) setMsg({ type: 'error', text: error.message })
    setPro(data)
    setLoading(false)
  }, [user.id])

  // On return from Stripe onboarding (?connect=...), sync status then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connect = params.get('connect')
    ;(async () => {
      if (connect) {
        await supabase.functions.invoke('connect_refresh').catch(() => {})
        params.delete('connect')
        const qs = params.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
      }
      await loadPro()
    })()
  }, [loadPro])

  async function startOnboarding() {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('connect_onboard', {
      body: { return_to: window.location.origin },
    })
    setBusy(false)
    if (error || !data?.url) {
      let text = error?.message || 'Could not start onboarding'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    window.location.href = data.url // redirect to Stripe-hosted onboarding
  }

  if (loading) return <p className="text-sm text-black/50">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pro dashboard</h2>
        {pro && !editing && (
          <button onClick={() => setEditing(true)} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/10">
            Edit storefront
          </button>
        )}
      </div>

      {!pro ? (
        <StorefrontForm onSaved={() => loadPro()} />
      ) : editing ? (
        <StorefrontForm
          pro={pro}
          onSaved={() => {
            setEditing(false)
            loadPro()
          }}
        />
      ) : (
        <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Payouts</h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: 'rgba(0,0,0,0.06)',
                color: pro.charges_enabled ? '#34D399' : GOLD,
              }}
            >
              {pro.charges_enabled ? 'Active' : 'Setup needed'}
            </span>
          </div>

          {pro.charges_enabled ? (
            <p className="mt-3 text-sm text-black/70">
              ✓ You're accepting bookings. Deposits and payouts route to your connected Stripe account.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-black/70">
                Set up payouts with Stripe to start accepting bookings. Until then, clients see your storefront but
                can't book.
              </p>
              <button
                onClick={startOnboarding}
                disabled={busy}
                className="mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                style={{ backgroundColor: GOLD }}
              >
                {busy ? 'Starting…' : pro.stripe_account_id ? 'Continue payout setup' : 'Set up payouts'}
              </button>
            </>
          )}

          {msg && <p className={`mt-3 text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}
        </section>
      )}

      {pro && <FillMyChair proId={pro.id} />}
      {pro && <SubmitAwardEntry proId={pro.id} category={pro.category} />}
      {pro && <ProMembershipTiers proId={pro.id} />}
    </div>
  )
}
