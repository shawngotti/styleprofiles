// Batch 8 ticket 4 — Stripe webhook test.
// Pays a booking WITHOUT calling confirm_deposit, then waits for Stripe to
// deliver payment_intent.succeeded to the deployed webhook, which should flip
// the booking to confirmed. Also checks signature rejection.
// Run: node --env-file=.env scripts/test-webhook.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE = process.env.STRIPE_SECRET_KEY
if (!URL || !ANON || !SERVICE || !STRIPE) throw new Error('Missing env vars in .env')

const EMAIL = 'webhook-test@example.com'
const PASSWORD = 'Webhook-Pass1!'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function callFn(name, token, payload) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)
  await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: sess } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  const token = sess.session.access_token

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const { data: svc } = await admin.from('services').select('id').eq('pro_id', dre.id).eq('name', 'Signature Fade').single()

  // Book (pending) — note: we will NOT call confirm_deposit.
  const booked = await callFn('create_booking', token, {
    pro_id: dre.id, service_date: '2026-10-01', start_time: '2026-10-01T15:00:00.000Z', items: [{ service_id: svc.id }],
  })
  const bookingId = booked.json.booking.id
  const { data: bk } = await admin.from('bookings').select('stripe_payment_intent_id,status').eq('id', bookingId).single()
  check('booking starts pending', bk.status === 'pending')

  // Pay the PaymentIntent directly (Stripe will emit payment_intent.succeeded -> webhook)
  await fetch(`https://api.stripe.com/v1/payment_intents/${bk.stripe_payment_intent_id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ payment_method: 'pm_card_visa' }).toString(),
  })

  // Wait for the webhook to confirm the booking (no confirm_deposit call).
  let confirmedVia = null
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const { data: row } = await admin.from('bookings').select('status').eq('id', bookingId).single()
    if (row.status === 'confirmed') { confirmedVia = i * 1500 + 1500; break }
  }
  check('webhook confirmed the booking (no confirm_deposit call)', confirmedVia != null, confirmedVia ? `after ~${confirmedVia}ms` : 'timed out after 30s')

  // Signature rejection: a forged POST with no valid signature must be refused.
  const forged = await fetch(`${URL}/functions/v1/stripe_webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { metadata: { booking_id: bookingId } } } }),
  })
  check('forged webhook (bad signature) is rejected', forged.status === 400, `status ${forged.status}`)

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nSTRIPE WEBHOOK TEST\n===================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
