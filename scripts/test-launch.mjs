// Batch 12 — launch-readiness data layer (legal acceptance + analytics RLS).
// Verifies: required legal versions are configured; a user records only their
// own acceptance; analytics events can be appended only for self/anon and read
// only by admins. Run: node --env-file=.env scripts/test-launch.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Launch-Pass1!'
const ADMIN = 'launch-admin@example.com'
const USER = 'launch-user@example.com'
const OTHER = 'launch-other@example.com'
const ALL = [ADMIN, USER, OTHER]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })

async function mkUser(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  return data.user.id
}
async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  await c.auth.signInWithPassword({ email, password: PW })
  return c
}
async function cleanup() {
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id) // acceptances/events cascade or null
}

async function main() {
  await cleanup()
  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const userId = await mkUser(USER)
  const otherId = await mkUser(OTHER)

  // --- Legal versions configured ---
  const { data: settings } = await admin.from('platform_settings').select('key,value').in('key', ['legal_tos_version', 'legal_privacy_version'])
  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
  check('required ToS + Privacy versions configured', !!map.legal_tos_version && !!map.legal_privacy_version, JSON.stringify(map))

  const user = await signIn(USER)
  // Record own acceptance.
  const acc = await user.from('legal_acceptances').insert([
    { profile_id: userId, doc: 'tos', version: map.legal_tos_version },
    { profile_id: userId, doc: 'privacy', version: map.legal_privacy_version },
  ])
  check('user records own acceptance', !acc.error, acc.error?.message || '')
  // Cannot record for another user.
  const forged = await user.from('legal_acceptances').insert({ profile_id: otherId, doc: 'tos', version: map.legal_tos_version })
  check('cannot record acceptance for another user', !!forged.error, 'expected RLS violation')
  // Reads only own.
  const { data: mine } = await user.from('legal_acceptances').select('doc')
  check('user reads only own acceptances', (mine || []).length === 2, `saw ${mine?.length}`)

  // --- Analytics RLS ---
  const ev = await user.from('analytics_events').insert({ profile_id: userId, event: 'unit_test', props: { ok: true } })
  check('user appends own analytics event', !ev.error, ev.error?.message || '')
  const evForged = await user.from('analytics_events').insert({ profile_id: otherId, event: 'forged' })
  check('cannot append event for another user', !!evForged.error, 'expected RLS violation')
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const evAnon = await anon.from('analytics_events').insert({ event: 'anon_visit', props: {} })
  check('anon appends event with null profile', !evAnon.error, evAnon.error?.message || '')
  // Non-admin cannot read the analytics log.
  const { data: userRead } = await user.from('analytics_events').select('id').eq('event', 'unit_test')
  check('non-admin cannot read analytics', (userRead || []).length === 0, `saw ${userRead?.length}`)
  // Admin can.
  const adminC = await signIn(ADMIN)
  const { data: adminRead } = await adminC.from('analytics_events').select('id').eq('event', 'unit_test')
  check('admin can read analytics', (adminRead || []).length >= 1)

  // Cleanup events explicitly (profile_id set null on user delete, would linger).
  await admin.from('analytics_events').delete().in('event', ['unit_test', 'forged', 'anon_visit'])
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nLAUNCH READINESS TEST\n=====================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('---------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
