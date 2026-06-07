// Batch 8 — Connect status sync.
// Reads the caller's Stripe account and mirrors charges_enabled / payouts_enabled
// into pros (service_role). Called when the pro returns from onboarding; a
// Stripe webhook (account.updated) reconciles this authoritatively in a later
// ticket.

import { cors, json, stripe, serviceClient, getUser } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  const { data: pro, error } = await svc
    .from('pros')
    .select('id,stripe_account_id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (error) return json({ error: error.message }, 400)
  if (!pro?.stripe_account_id) return json({ error: 'no connected account yet' }, 400)

  try {
    const acct = await stripe(`accounts/${pro.stripe_account_id}`)
    const charges_enabled = !!acct.charges_enabled
    const payouts_enabled = !!acct.payouts_enabled
    const { error: uErr } = await svc
      .from('pros')
      .update({ charges_enabled, payouts_enabled })
      .eq('id', pro.id)
    if (uErr) return json({ error: uErr.message }, 400)
    return json({ charges_enabled, payouts_enabled, details_submitted: !!acct.details_submitted })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
