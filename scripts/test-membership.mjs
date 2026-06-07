// Batch 8 ticket 5 — memberships test.
// Covers: guard (clients can't self-grant), server-side member pricing in
// create_booking, the subscribe gate, and webhook subscription mirroring
// (self-signed valid event). Run: node --env-file=.env scripts/test-membership.mjs

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
if (!URL || !ANON || !SERVICE || !WEBHOOK_SECRET) throw new Error('Missing env vars in .env')

const MEMBER = 'mem-member@example.com'
const NONMEMBER = 'mem-nonmember@example.com'
const PASSWORD = 'Member-Pass1!'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  return { c, token: data.session.access_token, uid: data.session.user.id }
}
async function callFn(name, token, payload) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
async function sendWebhook(event) {
  const body = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')
  const res = await fetch(`${URL}/functions/v1/stripe_webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` },
    body,
  })
  return res.status
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if ([MEMBER, NONMEMBER].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
  const { data: m } = await admin.auth.admin.createUser({ email: MEMBER, password: PASSWORD, email_confirm: true })
  await admin.auth.admin.createUser({ email: NONMEMBER, password: PASSWORD, email_confirm: true })
  const member = await signIn(MEMBER)
  const nonmember = await signIn(NONMEMBER)

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const { data: tier } = await admin.from('membership_tiers').select('id,member_discount_pct').eq('pro_id', dre.id).single()
  const { data: svc } = await admin.from('services').select('id,price,deposit').eq('pro_id', dre.id).eq('name', 'Signature Fade').single()

  // 1) Guard: a client cannot insert a membership row directly.
  {
    const { error } = await member.c.from('memberships').insert({ tier_id: tier.id, member_profile_id: member.uid, status: 'active' })
    check('guard: client cannot self-grant a membership', !!error, error?.message || 'no error!')
  }

  // 2) Give the member an ACTIVE membership (server-side) -> member pricing applies.
  await admin.from('memberships').insert({ tier_id: tier.id, member_profile_id: member.uid, status: 'active' })
  const expectedPrice = Math.round((svc.price * (100 - tier.member_discount_pct)) / 100)
  const expectedDeposit = Math.round((svc.deposit * (100 - tier.member_discount_pct)) / 100)
  {
    const r = await callFn('create_booking', member.token, {
      pro_id: dre.id, service_date: '2026-11-01', start_time: '2026-11-01T15:00:00.000Z', items: [{ service_id: svc.id }],
    })
    const li = r.json?.booking?.booking_line_items?.[0]
    check('member price = service - 15%', li?.price === expectedPrice, `${li?.price} vs ${expectedPrice}`)
    check('member deposit discounted too', li?.deposit === expectedDeposit, `${li?.deposit} vs ${expectedDeposit}`)
    check('booking total reflects member pricing', r.json?.booking?.service_total === expectedPrice)
  }

  // 3) Non-member pays full price.
  {
    const r = await callFn('create_booking', nonmember.token, {
      pro_id: dre.id, service_date: '2026-11-02', start_time: '2026-11-02T15:00:00.000Z', items: [{ service_id: svc.id }],
    })
    check('non-member pays full price', r.json?.booking?.booking_line_items?.[0]?.price === svc.price, `${r.json?.booking?.booking_line_items?.[0]?.price}`)
  }

  // 4) Subscribe gate: demo pros have no real connected account -> rejected.
  {
    const r = await callFn('membership_subscribe', nonmember.token, { tier_id: tier.id })
    check('subscribe gate: demo pro (no Stripe account) rejected', r.status === 400 && /not offering memberships/.test(r.json?.error || ''), r.json?.error || '')
  }

  // 5) Webhook mirrors subscription status into memberships.
  const fakeSub = 'sub_test_' + m.user.id.slice(0, 8)
  await admin.from('memberships').update({ stripe_subscription_id: fakeSub, status: 'past_due' }).eq('member_profile_id', member.uid)
  {
    const code = await sendWebhook({ type: 'customer.subscription.updated', data: { object: { id: fakeSub, status: 'active', current_period_end: 1790000000 } } })
    const { data: mem } = await admin.from('memberships').select('status,current_period_end').eq('stripe_subscription_id', fakeSub).single()
    check('webhook: subscription active -> membership active', code === 200 && mem.status === 'active', `${code} / ${mem.status}`)
    check('webhook: current_period_end synced', !!mem.current_period_end)
  }
  {
    const code = await sendWebhook({ type: 'customer.subscription.deleted', data: { object: { id: fakeSub, status: 'canceled' } } })
    const { data: mem } = await admin.from('memberships').select('status,cancelled_at').eq('stripe_subscription_id', fakeSub).single()
    check('webhook: subscription deleted -> membership cancelled', code === 200 && mem.status === 'cancelled' && !!mem.cancelled_at, `${code} / ${mem.status}`)
  }

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([MEMBER, NONMEMBER].includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nMEMBERSHIP TEST\n===============')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('---------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
