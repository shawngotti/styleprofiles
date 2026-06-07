// Batch 7 — booking transition state-machine test.
// Exercises the transition_booking Edge Function across roles and the 24h rule.
// Run:  node --env-file=.env scripts/test-transitions.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const FN = `${URL}/functions/v1/transition_booking`
const PASSWORD = 'Trans-Pass1!'
const USERS = { clientA: 'trans-clienta@example.com', clientB: 'trans-clientb@example.com', admin: 'trans-admin@example.com' }

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return { token: data.session.access_token, uid: data.session.user.id }
}

async function callFn(token, payload) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

async function main() {
  // Fresh users
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emails = new Set(Object.values(USERS))
  for (const u of list.users) if (emails.has(u.email)) await admin.auth.admin.deleteUser(u.id)
  const ids = {}
  for (const [k, email] of Object.entries(USERS)) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    ids[k] = data.user.id
  }
  await admin.from('user_roles').insert({ user_id: ids.admin, role: 'admin' })

  const clientA = await tokenFor(USERS.clientA)
  const clientB = await tokenFor(USERS.clientB)
  const adminTok = await tokenFor(USERS.admin)

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const iso = (ms) => new Date(Date.now() + ms).toISOString()
  const HOUR = 3600000

  async function makeBooking(status, startMs) {
    const { data, error } = await admin
      .from('bookings')
      .insert({ client_profile_id: clientA.uid, pro_id: dre.id, service_date: '2026-07-20', start_time: iso(startMs), status, deposit_total: 1500 })
      .select('id')
      .single()
    if (error) throw new Error(`makeBooking ${status}: ${error.message}`)
    return data.id
  }

  // 1) admin confirm: pending -> confirmed
  let r = await callFn(adminTok.token, { booking_id: await makeBooking('pending', 120 * HOUR), action: 'confirm' })
  check('admin confirm pending -> confirmed', r.status === 200 && r.json?.result?.status === 'confirmed', JSON.stringify(r.json))

  // 2) admin complete: confirmed -> completed (deposit applied)
  r = await callFn(adminTok.token, { booking_id: await makeBooking('confirmed', 120 * HOUR), action: 'complete' })
  check('admin complete -> completed + applied', r.json?.result?.status === 'completed' && r.json?.result?.deposit_outcome === 'applied')

  // 3) admin no_show: confirmed -> no_show (forfeited)
  r = await callFn(adminTok.token, { booking_id: await makeBooking('confirmed', 120 * HOUR), action: 'no_show' })
  check('admin no_show -> no_show + forfeited', r.json?.result?.status === 'no_show' && r.json?.result?.deposit_outcome === 'forfeited')

  // 4) client cancel > 24h before start -> released
  r = await callFn(clientA.token, { booking_id: await makeBooking('confirmed', 120 * HOUR), action: 'cancel' })
  check('client cancel >24h -> cancelled + released', r.json?.result?.status === 'cancelled' && r.json?.result?.deposit_outcome === 'released', JSON.stringify(r.json))

  // 5) client cancel < 24h before start -> forfeited
  r = await callFn(clientA.token, { booking_id: await makeBooking('confirmed', 2 * HOUR), action: 'cancel' })
  check('client cancel <24h -> cancelled + forfeited', r.json?.result?.status === 'cancelled' && r.json?.result?.deposit_outcome === 'forfeited', JSON.stringify(r.json))

  // 6) invalid transition: complete a pending booking -> 400
  r = await callFn(adminTok.token, { booking_id: await makeBooking('pending', 120 * HOUR), action: 'complete' })
  check('reject complete on pending (400)', r.status === 400, `status ${r.status}`)

  // 7) authorization: a different client cannot transition someone else's booking
  r = await callFn(clientB.token, { booking_id: await makeBooking('pending', 120 * HOUR), action: 'cancel' })
  check('reject unauthorized actor (400)', r.status === 400, `${r.json?.error || ''}`)

  // 8) a client cannot complete (staff-only action)
  r = await callFn(clientA.token, { booking_id: await makeBooking('confirmed', 120 * HOUR), action: 'complete' })
  check('reject client complete (400)', r.status === 400, `${r.json?.error || ''}`)

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (emails.has(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((x) => x.pass).length
  console.log('\nBOOKING TRANSITION TEST\n=======================')
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.detail ? `  (${x.detail})` : ''}`)
  console.log('-----------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
