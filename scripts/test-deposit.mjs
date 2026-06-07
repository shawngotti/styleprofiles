// Batch 8 ticket 2 — deposit PaymentIntent chain test.
// book -> PaymentIntent created -> confirm card (Stripe API) -> confirm_deposit
// -> booking confirmed. Run: node --env-file=.env scripts/test-deposit.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE = process.env.STRIPE_SECRET_KEY
if (!URL || !ANON || !SERVICE || !STRIPE) throw new Error('Missing env vars in .env')

const EMAIL = 'deposit-test@example.com'
const PASSWORD = 'Deposit-Pass1!'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

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

async function stripeApi(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  return res.json()
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)
  await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: sess } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  const token = sess.session.access_token

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const { data: svc } = await admin
    .from('services')
    .select('id,deposit')
    .eq('pro_id', dre.id)
    .eq('name', 'Signature Fade')
    .single()

  // 1) Book -> creates PaymentIntent, returns client secret
  const booked = await callFn('create_booking', token, {
    pro_id: dre.id,
    service_date: '2026-09-01',
    start_time: '2026-09-01T15:00:00.000Z',
    items: [{ service_id: svc.id }],
  })
  check('create_booking returns 201', booked.status === 201, `status ${booked.status}`)
  check('returns a client secret', typeof booked.json?.clientSecret === 'string' && booked.json.clientSecret.includes('_secret_'))
  const bookingId = booked.json?.booking?.id

  const { data: bkRow } = await admin
    .from('bookings')
    .select('status,deposit_total,stripe_payment_intent_id')
    .eq('id', bookingId)
    .single()
  check('PaymentIntent id stored on booking', typeof bkRow.stripe_payment_intent_id === 'string' && bkRow.stripe_payment_intent_id.startsWith('pi_'))
  check('booking starts pending', bkRow.status === 'pending')

  // 2) Confirm the PaymentIntent with a test card (server-side, simulating the PaymentElement)
  const confirmed = await stripeApi(`payment_intents/${bkRow.stripe_payment_intent_id}/confirm`, {
    payment_method: 'pm_card_visa',
  })
  check('PaymentIntent amount == deposit_total', confirmed.amount === bkRow.deposit_total, `${confirmed.amount} vs ${bkRow.deposit_total}`)
  check('card payment succeeds', confirmed.status === 'succeeded', confirmed.status || confirmed.error?.message)

  // 3) confirm_deposit flips the booking to confirmed (server-verified)
  const cd = await callFn('confirm_deposit', token, { booking_id: bookingId })
  check('confirm_deposit reports paid + confirmed', cd.json?.paid === true && cd.json?.booking_status === 'confirmed', JSON.stringify(cd.json))

  const { data: after } = await admin.from('bookings').select('status').eq('id', bookingId).single()
  check('booking is confirmed in DB', after.status === 'confirmed', after.status)

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nDEPOSIT PAYMENTINTENT TEST\n==========================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('--------------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
