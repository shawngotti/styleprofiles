// Batch 8 ticket 3 — deposit capture/refund on transitions.
// Run: node --env-file=.env scripts/test-refunds.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE = process.env.STRIPE_SECRET_KEY
if (!URL || !ANON || !SERVICE || !STRIPE) throw new Error('Missing env vars in .env')

const PASSWORD = 'Refund-Pass1!'
const CLIENT = 'refund-client@example.com'
const ADMIN = 'refund-admin@example.com'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  return data.session.access_token
}
async function callFn(name, token, payload) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}
async function stripePost(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  return res.json()
}
async function refundsFor(piId) {
  const res = await fetch(`https://api.stripe.com/v1/refunds?payment_intent=${piId}`, {
    headers: { Authorization: `Bearer ${STRIPE}` },
  })
  const j = await res.json()
  return j.data || []
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if ([CLIENT, ADMIN].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
  const { data: cU } = await admin.auth.admin.createUser({ email: CLIENT, password: PASSWORD, email_confirm: true })
  const { data: aU } = await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true })
  await admin.from('user_roles').insert({ user_id: aU.user.id, role: 'admin' })
  const clientTok = await tokenFor(CLIENT)
  const adminTok = await tokenFor(ADMIN)

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const { data: svc } = await admin.from('services').select('id').eq('pro_id', dre.id).eq('name', 'Signature Fade').single()

  async function book(start) {
    const r = await callFn('create_booking', clientTok, {
      pro_id: dre.id, service_date: start.slice(0, 10), start_time: start, items: [{ service_id: svc.id }],
    })
    const id = r.json.booking.id
    const { data: bk } = await admin.from('bookings').select('stripe_payment_intent_id,deposit_total').eq('id', id).single()
    return { id, pi: bk.stripe_payment_intent_id, deposit: bk.deposit_total }
  }
  async function pay(b) {
    await stripePost(`payment_intents/${b.pi}/confirm`, { payment_method: 'pm_card_visa' })
    await callFn('confirm_deposit', clientTok, { booking_id: b.id })
  }

  const FUTURE = '2026-12-01T15:00:00.000Z'

  // A) Paid + client cancel >24h -> released -> REFUND
  {
    const b = await book(FUTURE)
    await pay(b)
    const r = await callFn('transition_booking', clientTok, { booking_id: b.id, action: 'cancel' })
    const refs = await refundsFor(b.pi)
    check('A: paid cancel >24h reports refunded', r.json?.refunded === true, JSON.stringify(r.json?.result))
    check('A: one refund of the deposit exists', refs.length === 1 && refs[0].amount === b.deposit, `${refs.length} refund(s), amt ${refs[0]?.amount}`)
  }

  // B) Paid + no_show -> forfeited -> NO refund
  {
    const b = await book(FUTURE)
    await pay(b)
    const r = await callFn('transition_booking', adminTok, { booking_id: b.id, action: 'no_show' })
    const refs = await refundsFor(b.pi)
    check('B: no_show keeps the deposit (forfeited)', r.json?.result?.deposit_outcome === 'forfeited' && r.json?.refunded === false)
    check('B: no refund issued', refs.length === 0)
  }

  // C) Paid + complete -> applied -> NO refund
  {
    const b = await book(FUTURE)
    await pay(b)
    const r = await callFn('transition_booking', adminTok, { booking_id: b.id, action: 'complete' })
    const refs = await refundsFor(b.pi)
    check('C: complete applies the deposit', r.json?.result?.deposit_outcome === 'applied' && r.json?.refunded === false)
    check('C: no refund issued', refs.length === 0)
  }

  // D) Unpaid (deposit never charged) + cancel -> released but nothing to refund
  {
    const b = await book(FUTURE) // not paid
    const r = await callFn('transition_booking', clientTok, { booking_id: b.id, action: 'cancel' })
    const refs = await refundsFor(b.pi)
    check('D: cancel of unpaid booking issues no refund', r.json?.result?.deposit_outcome === 'released' && r.json?.refunded === false)
    check('D: no refund on an uncharged PaymentIntent', refs.length === 0)
  }

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([CLIENT, ADMIN].includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nDEPOSIT REFUND TEST\n===================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
