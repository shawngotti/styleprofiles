// Profile-view analytics & conversions.
// Verifies: log_profile_view records views, throttles repeats, and excludes the
// owner; booking marks prior views converted; pro_view_stats + pro_recent_visitors
// return correct aggregates and honor the hide_profile_views opt-out; RLS/owner
// checks block non-owners; admin_pro_analytics is admin-only.
// Run: node --env-file=.env scripts/test-analytics.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Analytics-1!'
const PRO = 'an-pro@example.com'
const V1 = 'an-v1@example.com'
const V2 = 'an-v2@example.com'
const ADM = 'an-adm@example.com'
const ALL = [PRO, V1, V2, ADM]

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
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}
const viewCount = async (proId) => ((await admin.from('profile_views').select('id').eq('pro_id', proId)).data || []).length

async function main() {
  await cleanup()
  const proUid = await mkUser(PRO)
  const v1 = await mkUser(V1)
  const v2 = await mkUser(V2)
  const admUid = await mkUser(ADM)
  await admin.from('user_roles').insert({ user_id: admUid, role: 'admin' })
  const { data: pro } = await admin.from('pros').insert({ profile_id: proUid, handle: 'an_pro', display_name: 'An Pro', category: 'barber' }).select('id').single()

  const cliV1 = await signIn(V1)
  const cliV2 = await signIn(V2)
  const cliPro = await signIn(PRO)
  const cliAdm = await signIn(ADM)

  // 1. v1 logs a view, then again immediately (throttled to 1).
  await cliV1.rpc('log_profile_view', { _pro_id: pro.id, _source: 'discover' })
  await cliV1.rpc('log_profile_view', { _pro_id: pro.id, _source: 'discover' })
  check('view logged + repeat throttled (1)', (await viewCount(pro.id)) === 1, `count=${await viewCount(pro.id)}`)

  // 2. v2 logs a view → 2 total, 2 unique.
  await cliV2.rpc('log_profile_view', { _pro_id: pro.id, _source: 'lineup' })
  check('second viewer logged (2)', (await viewCount(pro.id)) === 2)

  // 3. The pro viewing their own page is not counted.
  await cliPro.rpc('log_profile_view', { _pro_id: pro.id, _source: 'discover' })
  check('owner view excluded (still 2)', (await viewCount(pro.id)) === 2)

  // 4. v2 books → their prior view is marked converted.
  await admin.from('bookings').insert({ client_profile_id: v2, pro_id: pro.id, service_date: '2026-02-01', status: 'pending' })
  const conv = ((await admin.from('profile_views').select('booked').eq('pro_id', pro.id).eq('viewer_profile_id', v2)).data || [])
  check('booking marks view converted', conv.every((r) => r.booked) && conv.length === 1)

  // 5. pro_view_stats aggregates.
  const { data: stats } = await cliPro.rpc('pro_view_stats', { _pro_id: pro.id })
  check('stats total_views = 2', stats?.total_views === 2, JSON.stringify(stats))
  check('stats unique_viewers = 2', stats?.unique_viewers === 2)
  check('stats converted_viewers = 1', stats?.converted_viewers === 1)
  check('stats completeness is a number', typeof stats?.completeness === 'number', String(stats?.completeness))

  // 6. Named visitors + opt-out.
  const { data: vis1 } = await cliPro.rpc('pro_recent_visitors', { _pro_id: pro.id })
  check('recent visitors returns 2', (vis1 || []).length === 2)
  check('visitor name visible by default', (vis1 || []).some((v) => v.viewer_profile_id === v1 && v.display_name != null))
  await admin.from('profiles').update({ hide_profile_views: true }).eq('id', v1)
  const { data: vis2 } = await cliPro.rpc('pro_recent_visitors', { _pro_id: pro.id })
  const v1row = (vis2 || []).find((v) => v.viewer_profile_id === v1)
  check('opted-out visitor name hidden', v1row && v1row.display_name === null, JSON.stringify(v1row))

  // 7. Non-owner cannot read stats.
  const denied = await cliV1.rpc('pro_view_stats', { _pro_id: pro.id })
  check('non-owner blocked from stats', !!denied.error, denied.error?.message || 'expected error')

  // 8. RLS: a random client cannot read the pro's view rows; the pro can.
  check('non-owner cannot read profile_views', ((await cliV1.from('profile_views').select('id').eq('pro_id', pro.id)).data || []).length === 0)
  check('owner can read profile_views', ((await cliPro.from('profile_views').select('id').eq('pro_id', pro.id)).data || []).length === 2)

  // 9. Admin analytics.
  const { data: board, error: bErr } = await cliAdm.rpc('admin_pro_analytics', { _days: 365 })
  const mine = (board || []).find((r) => r.pro_id === pro.id)
  check('admin analytics returns pro row', !bErr && mine && Number(mine.views) === 2 && Number(mine.conversions) === 1, bErr?.message || JSON.stringify(mine))
  const nonAdmin = await cliV1.rpc('admin_pro_analytics', { _days: 30 })
  check('non-admin blocked from analytics', !!nonAdmin.error)

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nANALYTICS TEST\n==============')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('--------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
