// Batch 8 — Connect Express onboarding.
// Creates (once) a Stripe Express account for the caller's pro storefront and
// returns a hosted onboarding URL. Account id is mirrored to pros via
// service_role (clients can't write payment columns — guard trigger).

import { cors, json, stripe, serviceClient, getUser } from '../_shared/util.ts'

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
  } catch { /* optional body */ }
  const base = (typeof body.return_to === 'string' && body.return_to) || 'http://localhost:5173'

  const svc = serviceClient()
  const { data: pro, error } = await svc
    .from('pros')
    .select('id,stripe_account_id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (error) return json({ error: error.message }, 400)
  if (!pro) return json({ error: 'you do not have a pro storefront' }, 403)

  try {
    let accountId = pro.stripe_account_id
    if (!accountId) {
      const acct = await stripe('accounts', 'POST', {
        type: 'express',
        email: user.email ?? '',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
      })
      accountId = acct.id
      const { error: uErr } = await svc.from('pros').update({ stripe_account_id: accountId }).eq('id', pro.id)
      if (uErr) return json({ error: uErr.message }, 400)
    }

    const link = await stripe('account_links', 'POST', {
      account: accountId,
      refresh_url: `${base}?connect=refresh`,
      return_url: `${base}?connect=return`,
      type: 'account_onboarding',
    })
    return json({ url: link.url })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
