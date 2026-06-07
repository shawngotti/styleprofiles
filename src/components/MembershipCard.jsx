import { useCallback, useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { stripePromise } from '../lib/stripe.js'
import { centsToUsd } from '../lib/format.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Membership offer on a pro's profile. Shows the tier, lets a client subscribe
// (Stripe Connect subscription via membership_subscribe + PaymentElement), and
// surfaces active-member status. Member pricing is applied server-side at booking.
export default function MembershipCard({ pro }) {
  const { user } = useAuth()
  const [tier, setTier] = useState(null)
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [clientSecret, setClientSecret] = useState(null)

  const load = useCallback(async () => {
    const { data: tiers } = await supabase
      .from('membership_tiers')
      .select('id,name,price,includes,perks,member_discount_pct')
      .eq('pro_id', pro.id)
      .eq('active', true)
      .limit(1)
    const t = tiers?.[0] || null
    setTier(t)
    if (t) {
      const { data: mem } = await supabase
        .from('memberships')
        .select('status')
        .eq('member_profile_id', user.id)
        .eq('tier_id', t.id)
        .maybeSingle()
      setMembership(mem)
    }
    setLoading(false)
  }, [pro.id, user.id])

  useEffect(() => {
    load()
  }, [load])

  async function subscribe() {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('membership_subscribe', { body: { tier_id: tier.id } })
    setBusy(false)
    if (error || !data?.clientSecret) {
      let text = 'Could not start membership'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    track('membership_subscribed', { tier_id: tier.id })
    setClientSecret(data.clientSecret)
  }

  if (loading || !tier) return null
  const isMember = membership?.status === 'active'

  return (
    <section className="mt-6 rounded-2xl border p-4" style={{ borderColor: `${GOLD}55`, backgroundColor: `${GOLD}0d` }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{tier.name}</h3>
        {isMember ? (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
            ✓ Member
          </span>
        ) : (
          <span className="text-sm font-medium" style={{ color: GOLD }}>
            {centsToUsd(tier.price)}/mo
          </span>
        )}
      </div>
      {tier.includes && <p className="mt-1 text-sm text-white/60">{tier.includes}</p>}
      {tier.perks?.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-white/50">
          {tier.perks.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}

      {isMember ? (
        <p className="mt-3 text-xs text-emerald-400">
          Member pricing ({tier.member_discount_pct}% off) is applied automatically when you book.
        </p>
      ) : (
        !clientSecret && (
          <button
            onClick={subscribe}
            disabled={busy}
            className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: GOLD }}
          >
            {busy ? 'Starting…' : `Become a member · ${centsToUsd(tier.price)}/mo`}
          </button>
        )
      )}

      {msg && <p className="mt-2 text-sm text-red-400" role="alert">{msg.text}</p>}

      {clientSecret && (
        <div className="mt-4">
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: GOLD, colorBackground: '#141417' } } }}
          >
            <SubscriptionPay
              onPaid={() => {
                setClientSecret(null)
                setMsg({ type: 'info', text: 'Payment received — your membership activates shortly.' })
                setTimeout(load, 2500)
              }}
            />
          </Elements>
        </div>
      )}
    </section>
  )
}

function SubscriptionPay({ onPaid }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function pay() {
    if (!stripe || !elements) return
    setBusy(true)
    setErr(null)
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    setBusy(false)
    if (error) {
      setErr(error.message || 'Payment failed')
      return
    }
    onPaid()
  }

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="mt-2 text-sm text-red-400" role="alert">{err}</p>}
      <button
        onClick={pay}
        disabled={busy || !stripe}
        className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        style={{ backgroundColor: GOLD }}
      >
        {busy ? 'Processing…' : 'Start membership'}
      </button>
    </div>
  )
}
