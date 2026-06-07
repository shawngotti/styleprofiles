// Batch 8 — membership_subscribe.
// Creates a recurring Stripe Connect subscription on the pro's connected account
// (platform fee via application_fee_percent), and a pending memberships row.
// The webhook flips it to 'active' once the first invoice is paid (Stripe is the
// source of truth). Returns the first invoice's client_secret for the payment UI.

import { cors, json, stripe, serviceClient, getUser } from '../_shared/util.ts'

const PLATFORM_FEE_PERCENT = '10'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const tierId = body.tier_id
  if (!tierId) return json({ error: 'tier_id is required' }, 400)

  const svc = serviceClient()
  const { data: tier } = await svc
    .from('membership_tiers')
    .select('id,pro_id,name,price,stripe_price_id,active,pros(stripe_account_id,charges_enabled)')
    .eq('id', tierId)
    .maybeSingle()
  if (!tier || !tier.active) return json({ error: 'membership tier not available' }, 400)

  const account = tier.pros?.stripe_account_id
  if (!account || !tier.pros?.charges_enabled) {
    return json({ error: 'this pro is not offering memberships yet' }, 400)
  }

  try {
    // 1) Ensure a recurring price on the connected account.
    let priceId = tier.stripe_price_id
    if (!priceId) {
      const price = await stripe(
        'prices',
        'POST',
        {
          currency: 'usd',
          unit_amount: String(tier.price),
          'recurring[interval]': 'month',
          'product_data[name]': tier.name,
        },
        account,
      )
      priceId = price.id
      await svc.from('membership_tiers').update({ stripe_price_id: priceId }).eq('id', tier.id)
    }

    // 2) Customer on the connected account.
    const customer = await stripe('customers', 'POST', { email: user.email ?? '', 'metadata[member_profile_id]': user.id }, account)

    // 3) Subscription with the platform fee; first invoice is payable now.
    const sub = await stripe(
      'subscriptions',
      'POST',
      {
        customer: customer.id,
        'items[0][price]': priceId,
        application_fee_percent: PLATFORM_FEE_PERCENT,
        payment_behavior: 'default_incomplete',
        'expand[0]': 'latest_invoice.payment_intent',
        'metadata[member_profile_id]': user.id,
        'metadata[tier_id]': tier.id,
      },
      account,
    )

    // 4) Pending membership row (active only after the webhook confirms payment).
    await svc.from('memberships').upsert(
      {
        tier_id: tier.id,
        member_profile_id: user.id,
        status: 'past_due',
        stripe_subscription_id: sub.id,
        stripe_customer_id: customer.id,
      },
      { onConflict: 'tier_id,member_profile_id' },
    )

    const clientSecret = sub.latest_invoice?.payment_intent?.client_secret ?? null
    return json({ subscriptionId: sub.id, clientSecret, account }, 201)
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
