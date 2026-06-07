// Batch 8 ticket 1 — Connect onboarding + booking gate test.
// Run:  node --env-file=.env scripts/test-connect.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE = process.env.STRIPE_SECRET_KEY
if (!URL || !ANON || !SERVICE || !STRIPE) throw new Error('Missing env vars in .env')

const PASSWORD = 'Connect-Pass1!'
const PRO_EMAIL = 'test-connect-pro@example.com'
const CLIENT_EMAIL = 'test-connect-client@example.com'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return { client: c, token: data.session.access_token, uid: data.session.user.id }
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

async function main() {
  // Fresh users
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if ([PRO_EMAIL, CLIENT_EMAIL].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
  const { data: proU } = await admin.auth.admin.createUser({ email: PRO_EMAIL, password: PASSWORD, email_confirm: true })
  const { data: cliU } = await admin.auth.admin.createUser({ email: CLIENT_EMAIL, password: PASSWORD, email_confirm: true })
  await admin.from('user_roles').insert({ user_id: proU.user.id, role: 'pro' })

  // Pro storefront (charges_enabled defaults false) + one service
  const { data: pro } = await admin
    .from('pros')
    .insert({ profile_id: proU.user.id, handle: 'test_connect_pro', display_name: 'Test Connect Pro', category: 'barber' })
    .select('id')
    .single()
  const { data: svc } = await admin
    .from('services')
    .insert({ pro_id: pro.id, name: 'Test Cut', duration_min: 30, price: 4000, deposit: 1000 })
    .select('id')
    .single()

  const proTok = await tokenFor(PRO_EMAIL)
  const cliTok = await tokenFor(CLIENT_EMAIL)

  // 1) Guard trigger: pro cannot self-enable charges
  {
    const { error } = await proTok.client.from('pros').update({ charges_enabled: true }).eq('id', pro.id)
    check('guard: pro CANNOT set charges_enabled', !!error, error?.message || 'no error!')
  }

  // 2) Booking gate: client cannot book a not-yet-onboarded pro
  {
    const r = await callFn('create_booking', cliTok.token, {
      pro_id: pro.id, service_date: '2026-08-01', items: [{ service_id: svc.id }],
    })
    check('gate: booking a non-onboarded pro is rejected (400)', r.status === 400, r.json?.error || '')
  }

  // 3) Onboarding: creates a Stripe account + returns a hosted URL
  let accountId = null
  {
    const r = await callFn('connect_onboard', proTok.token, { return_to: 'http://localhost:5173' })
    check('onboard: returns a Stripe onboarding URL', r.status === 200 && typeof r.json?.url === 'string' && r.json.url.includes('stripe.com'), r.json?.url || r.json?.error || '')
    const { data: after } = await admin.from('pros').select('stripe_account_id').eq('id', pro.id).single()
    accountId = after?.stripe_account_id
    check('onboard: stripe_account_id saved on pro', typeof accountId === 'string' && accountId.startsWith('acct_'), accountId || '')
  }

  // 4) Refresh: syncs charges_enabled from Stripe (false — onboarding not completed)
  {
    const r = await callFn('connect_refresh', proTok.token, {})
    check('refresh: reports charges_enabled = false (not onboarded)', r.status === 200 && r.json?.charges_enabled === false, JSON.stringify(r.json))
  }

  // 5) Simulate completed onboarding, then booking succeeds
  await admin.from('pros').update({ charges_enabled: true }).eq('id', pro.id)
  {
    const r = await callFn('create_booking', cliTok.token, {
      pro_id: pro.id, service_date: '2026-08-02', items: [{ service_id: svc.id }],
    })
    check('gate: booking an onboarded pro succeeds (201)', r.status === 201, `status ${r.status}: ${r.json?.error || ''}`)
  }

  // Cleanup: delete the Stripe test account, then the users
  if (accountId) {
    await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${STRIPE}` } })
  }
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([PRO_EMAIL, CLIENT_EMAIL].includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nCONNECT ONBOARDING + GATE TEST\n==============================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
