// Option A1 — reviews are server-authoritative for reputation.
// Verifies: rating_avg/rating_count recompute from the reviews table on
// insert/update/delete; the 'verified' badge is set only for the author's own
// completed booking. Run: node --env-file=.env scripts/test-reviews.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Review-Pass1!'
const PRO = 'rev-pro@example.com'
const C1 = 'rev-c1@example.com'
const C2 = 'rev-c2@example.com'
const ALL = [PRO, C1, C2]

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
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id) // pros/bookings/reviews cascade
}
const ratingOf = async (id) => (await admin.from('pros').select('rating_avg,rating_count').eq('id', id).single()).data

async function main() {
  await cleanup()
  const proUid = await mkUser(PRO)
  const c1 = await mkUser(C1)
  const c2 = await mkUser(C2)
  const { data: pro } = await admin.from('pros').insert({ profile_id: proUid, handle: 'rev_pro', display_name: 'Rev Pro', category: 'barber' }).select('id').single()

  const r0 = await ratingOf(pro.id)
  check('new pro starts at 0 rating', Number(r0.rating_avg) === 0 && r0.rating_count === 0)

  // A completed booking for C1, and a pending one for C2.
  const { data: bk1 } = await admin.from('bookings').insert({ client_profile_id: c1, pro_id: pro.id, service_date: '2026-01-10', status: 'completed' }).select('id').single()
  const { data: bk2 } = await admin.from('bookings').insert({ client_profile_id: c2, pro_id: pro.id, service_date: '2026-01-11', status: 'pending' }).select('id').single()

  // C1 reviews their completed booking -> verified true, rating recomputed.
  const cli1 = await signIn(C1)
  const ins1 = await cli1.from('reviews').insert({ pro_id: pro.id, author_profile_id: c1, booking_id: bk1.id, rating: 4 })
  check('client posts review', !ins1.error, ins1.error?.message || '')
  const { data: rev1 } = await admin.from('reviews').select('verified').eq('booking_id', bk1.id).single()
  check('review on own completed booking is verified', rev1.verified === true)
  let r1 = await ratingOf(pro.id)
  check('rating recomputed after 1 review (avg 4, n 1)', Number(r1.rating_avg) === 4 && r1.rating_count === 1, JSON.stringify(r1))

  // C2 reviews a NON-completed booking -> verified false; avg becomes 3.
  const cli2 = await signIn(C2)
  await cli2.from('reviews').insert({ pro_id: pro.id, author_profile_id: c2, booking_id: bk2.id, rating: 2 })
  const { data: rev2 } = await admin.from('reviews').select('verified').eq('booking_id', bk2.id).single()
  check('review on non-completed booking is not verified', rev2.verified === false)
  let r2 = await ratingOf(pro.id)
  check('rating recomputed after 2 reviews (avg 3, n 2)', Number(r2.rating_avg) === 3 && r2.rating_count === 2, JSON.stringify(r2))

  // Update C1's review rating -> recompute.
  await cli1.from('reviews').update({ rating: 5 }).eq('booking_id', bk1.id)
  let r3 = await ratingOf(pro.id)
  check('rating recomputes on update (avg 3.5)', Number(r3.rating_avg) === 3.5, JSON.stringify(r3))

  // Delete C2's review -> recompute.
  await admin.from('reviews').delete().eq('booking_id', bk2.id)
  let r4 = await ratingOf(pro.id)
  check('rating recomputes on delete (avg 5, n 1)', Number(r4.rating_avg) === 5 && r4.rating_count === 1, JSON.stringify(r4))

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nREVIEWS TEST\n============')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
