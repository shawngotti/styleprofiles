// Batch 6 — RLS acceptance test.
// Seeds disposable test users with the service_role key, then signs in AS EACH
// user and asserts Row Level Security holds across client / pro / admin roles.
// Run:  node --env-file=.env scripts/rls-acceptance.mjs
//
// Safe to re-run: it deletes its own @example.com test users first (cascading
// away their fixtures) and recreates them. It never touches real accounts.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
if (!SERVICE) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env')

const PASSWORD = 'Test-Passw0rd!'
const USERS = {
  admin: { email: 'rls-admin@example.com', extraRole: 'admin' },
  proA: { email: 'rls-proa@example.com', extraRole: 'pro' },
  proB: { email: 'rls-prob@example.com', extraRole: 'pro' },
  clientB: { email: 'rls-clientb@example.com' },
  clientC: { email: 'rls-clientc@example.com' },
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail })
}

async function authedClient(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

async function seeUsersBooking(client, bookingId) {
  const { data, error } = await client.from('bookings').select('id').eq('id', bookingId)
  return !error && data.length === 1
}

async function main() {
  // --- Clean slate: delete any existing test users (cascades their data) ---
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  const byEmail = new Map(list.users.map((u) => [u.email, u.id]))
  for (const u of Object.values(USERS)) {
    if (byEmail.has(u.email)) await admin.auth.admin.deleteUser(byEmail.get(u.email))
  }

  // --- Create users (trigger makes profile + default 'client' role) ---
  for (const u of Object.values(USERS)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`)
    u.id = data.user.id // profiles.id === auth user id
  }

  // --- Seed extra roles (admin / pro) via service_role (bypasses RLS) ---
  const extraRoles = Object.values(USERS)
    .filter((u) => u.extraRole)
    .map((u) => ({ user_id: u.id, role: u.extraRole }))
  {
    const { error } = await admin.from('user_roles').insert(extraRoles)
    if (error) throw new Error(`seed roles: ${error.message}`)
  }

  // --- Fixtures: two pro storefronts + a service each, and one booking ---
  const { data: proARow, error: eProA } = await admin
    .from('pros')
    .insert({ profile_id: USERS.proA.id, handle: 'rls_proa', display_name: 'RLS ProA', category: 'barber' })
    .select()
    .single()
  if (eProA) throw new Error(`pros proA: ${eProA.message}`)

  const { data: proBRow, error: eProB } = await admin
    .from('pros')
    .insert({ profile_id: USERS.proB.id, handle: 'rls_prob', display_name: 'RLS ProB', category: 'barber' })
    .select()
    .single()
  if (eProB) throw new Error(`pros proB: ${eProB.message}`)

  const { data: svcA, error: eSvc } = await admin
    .from('services')
    .insert({ pro_id: proARow.id, name: 'Cut', duration_min: 30, price: 4500, deposit: 1000 })
    .select()
    .single()
  if (eSvc) throw new Error(`service A: ${eSvc.message}`)

  const { data: booking, error: eBk } = await admin
    .from('bookings')
    .insert({ client_profile_id: USERS.clientB.id, pro_id: proARow.id, service_date: '2026-07-01' })
    .select()
    .single()
  if (eBk) throw new Error(`booking: ${eBk.message}`)

  // --- Authenticated clients (real sessions, RLS enforced) ---
  const cAdmin = await authedClient(USERS.admin.email)
  const cProA = await authedClient(USERS.proA.email)
  const cProB = await authedClient(USERS.proB.email)
  const cClientB = await authedClient(USERS.clientB.email)
  const cClientC = await authedClient(USERS.clientC.email)

  // 1) Booking visibility
  check('clientB sees own booking', await seeUsersBooking(cClientB, booking.id))
  check('clientC CANNOT see another client booking', !(await seeUsersBooking(cClientC, booking.id)))
  check('owning pro (proA) sees the booking', await seeUsersBooking(cProA, booking.id))
  check('unrelated pro (proB) CANNOT see the booking', !(await seeUsersBooking(cProB, booking.id)))
  check('admin sees the booking', await seeUsersBooking(cAdmin, booking.id))

  // 2) Service ownership (update)
  {
    const { data, error } = await cProA.from('services').update({ price: 5000 }).eq('id', svcA.id).select()
    check('proA CAN update own service', !error && data.length === 1)
  }
  {
    const { data, error } = await cProB.from('services').update({ price: 9999 }).eq('id', svcA.id).select()
    check('proB CANNOT update proA service', !error && data.length === 0, 'RLS filters non-owned rows')
  }
  {
    const { data, error } = await cClientC.from('services').update({ price: 1 }).eq('id', svcA.id).select()
    check('client CANNOT update a service', !error && data.length === 0)
  }

  // 3) platform_settings (admin-only write, public read)
  {
    const { error } = await cClientC.from('platform_settings').select('key').limit(1)
    check('anyone can READ platform_settings', !error)
  }
  {
    const { error } = await cClientC.from('platform_settings').upsert({ key: 'rls_test_marker', value: { x: 1 } })
    check('non-admin CANNOT write platform_settings', !!error)
  }
  {
    const { error } = await cAdmin.from('platform_settings').upsert({ key: 'rls_test_marker', value: { x: 1 } })
    check('admin CAN write platform_settings', !error)
  }

  // 4) competitions (admin-only write)
  let compId = null
  {
    const { error } = await cClientC.from('competitions').insert({ name: 'RLS Test Comp' })
    check('non-admin CANNOT create a competition', !!error)
  }
  {
    const { data, error } = await cAdmin.from('competitions').insert({ name: 'RLS Test Comp' }).select().single()
    check('admin CAN create a competition', !error)
    compId = data?.id ?? null
  }

  // 5) booking insert WITH CHECK (client_profile_id must equal auth.uid())
  {
    const { error } = await cClientC
      .from('bookings')
      .insert({ client_profile_id: USERS.clientC.id, pro_id: proARow.id, service_date: '2026-07-02' })
    check('client CAN create own booking', !error)
  }
  {
    const { error } = await cClientC
      .from('bookings')
      .insert({ client_profile_id: USERS.clientB.id, pro_id: proARow.id, service_date: '2026-07-03' })
    check('client CANNOT create a booking as another user', !!error)
  }

  // 6) pro storefront insert ownership
  {
    const { error } = await cClientC
      .from('pros')
      .insert({ profile_id: USERS.proA.id, handle: 'rls_hack', display_name: 'x', category: 'barber' })
    check('client CANNOT create a pro storefront for another profile', !!error)
  }

  // --- Cleanup the few service_role-owned artifacts not tied to test users ---
  await admin.from('platform_settings').delete().eq('key', 'rls_test_marker')
  if (compId) await admin.from('competitions').delete().eq('id', compId)
  await admin.from('competitions').delete().eq('name', 'RLS Test Comp')
  void proBRow

  // --- Report ---
  const pass = results.filter((r) => r.pass).length
  const fail = results.length - pass
  console.log('\nRLS ACCEPTANCE TEST\n===================')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  }
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ' — all green'}`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\nTest harness error:', e.message)
  process.exit(2)
})
