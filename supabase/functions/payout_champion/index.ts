// Batch 11 P5 — payout_champion.
// Admin disburses the season prize to the champion via a Stripe Connect transfer
// from the platform balance to the champion's connected account. Records the
// transfer on the contestant and notifies them. Idempotent: refuses if a prize
// transfer is already recorded.

import { cors, json, stripe, serviceClient, getUser } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  const { data: adminRole } = await svc
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()
  if (!adminRole) return json({ error: 'admins only' }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const competitionId = body.competition_id as string | undefined
  const amount = Math.floor(Number(body.amount_cents) || 0)
  if (!competitionId) return json({ error: 'competition_id is required' }, 400)
  if (amount <= 0) return json({ error: 'amount_cents must be positive' }, 400)

  const { data: champ } = await svc
    .from('contestants')
    .select('id,prize_transfer_id,pro:pros(id,display_name,profile_id,stripe_account_id,payouts_enabled)')
    .eq('competition_id', competitionId)
    .eq('status', 'champion')
    .maybeSingle()
  if (!champ) return json({ error: 'no champion for this competition yet' }, 400)
  if (champ.prize_transfer_id) return json({ error: 'prize already paid', transfer_id: champ.prize_transfer_id }, 409)

  const pro = champ.pro
  if (!pro?.stripe_account_id || !pro.payouts_enabled) {
    return json({ error: 'champion has not completed payout setup' }, 400)
  }

  try {
    const transfer = await stripe('transfers', 'POST', {
      amount: String(amount),
      currency: 'usd',
      destination: pro.stripe_account_id,
      'metadata[competition_id]': competitionId,
      'metadata[contestant_id]': champ.id,
    })
    await svc
      .from('contestants')
      .update({ prize_cents: amount, prize_transfer_id: transfer.id })
      .eq('id', champ.id)
    await svc.from('notifications').insert({
      recipient_profile_id: pro.profile_id,
      kind: 'lineup',
      body: `🏆 Your Lineup prize of $${(amount / 100).toFixed(2)} is on its way to your account!`,
      link_screen: 'lineup',
      feature: 'lineup',
    })
    return json({ ok: true, transfer_id: transfer.id, amount }, 201)
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
