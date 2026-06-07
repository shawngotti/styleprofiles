// Batch 7 — create_booking acceptance test.
// Signs in as a temp client, calls the deployed Edge Function, and asserts the
// booking engine is server-authoritative: correct totals from DB prices,
// back-to-back schedule, and rejection of a service that belongs to another pro.
// Run:  node --env-file=.env scripts/test-booking.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const FN = `${URL}/functions/v1/create_booking`
const EMAIL = 'booking-test@example.com'
const PASSWORD = 'Booking-Pass1!'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

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
  // Temp client user
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)
  const { error: cErr } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (cErr) throw cErr

  // Sign in to get a user JWT
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (sErr) throw sErr
  const token = sess.session.access_token

  // Pick a pro + two of ITS services, plus one service from a DIFFERENT pro
  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()
  const { data: imani } = await admin.from('pros').select('id').eq('handle', 'imani.silkpress').single()
  const { data: dreSvcs } = await admin
    .from('services')
    .select('id,price,deposit,duration_min')
    .eq('pro_id', dre.id)
    .eq('is_addon', false)
    .order('sort')
    .limit(2)
  const { data: imaniSvc } = await admin
    .from('services')
    .select('id')
    .eq('pro_id', imani.id)
    .limit(1)
    .single()

  const [s1, s2] = dreSvcs
  const start = '2026-07-15T14:00:00.000Z'

  // --- Happy path ---
  const ok = await callFn(token, {
    pro_id: dre.id,
    service_date: '2026-07-15',
    start_time: start,
    items: [{ service_id: s1.id }, { service_id: s2.id }],
  })
  check('returns 201 Created', ok.status === 201, `status ${ok.status}`)
  const b = ok.json?.booking
  check('booking status is pending', b?.status === 'pending')
  check('service_total = sum of service prices', b?.service_total === s1.price + s2.price, `${b?.service_total} vs ${s1.price + s2.price}`)
  check('deposit_total = sum of deposits', b?.deposit_total === s1.deposit + s2.deposit, `${b?.deposit_total} vs ${s1.deposit + s2.deposit}`)
  check('two line items created', b?.booking_line_items?.length === 2)
  const li = (b?.booking_line_items || []).sort((a, c) => a.sort - c.sort)
  check('line item 1 scheduled at start', li[0]?.scheduled_at && new Date(li[0].scheduled_at).getTime() === new Date(start).getTime())
  const expected2 = new Date(new Date(start).getTime() + s1.duration_min * 60000).getTime()
  check('line item 2 scheduled back-to-back', li[1]?.scheduled_at && new Date(li[1].scheduled_at).getTime() === expected2, 'start + duration1')

  // --- Server-authoritative rejection: foreign pro's service ---
  const bad = await callFn(token, {
    pro_id: dre.id,
    service_date: '2026-07-16',
    items: [{ service_id: s1.id }, { service_id: imaniSvc.id }],
  })
  check('rejects a service from another pro (400)', bad.status === 400, `status ${bad.status}: ${bad.json?.error || ''}`)

  // The rejected attempt must not have left a stray booking (atomic rollback).
  const { data: theirBookings } = await admin
    .from('bookings')
    .select('id,service_date')
    .eq('client_profile_id', sess.session.user.id)
  check('only the valid booking persisted (atomic rollback)', (theirBookings || []).length === 1, `${(theirBookings || []).length} booking(s)`)

  // --- Missing items rejected ---
  const empty = await callFn(token, { pro_id: dre.id, service_date: '2026-07-17', items: [] })
  check('rejects empty items (400)', empty.status === 400)

  // Cleanup (cascades the booking + line items)
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)

  // Report
  const pass = results.filter((r) => r.pass).length
  console.log('\nCREATE_BOOKING TEST\n===================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
