// Batch 9 ticket 2 — weighted award result computation (50/20/20/10).
// Builds an isolated cycle with two barber nominees and verifies the winner.
// Run: node --env-file=.env scripts/test-award-results.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PASSWORD = 'Award-Pass1!'
const PRO_A = 'award-proa@example.com'
const PRO_B = 'award-prob@example.com'
const ADMIN = 'award-admin@example.com'
const VOTERS = ['award-v1@example.com', 'award-v2@example.com', 'award-v3@example.com', 'award-v4@example.com']
const ALL = [PRO_A, PRO_B, ADMIN, ...VOTERS]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function mkUser(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  return data.user.id
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const proAId = await mkUser(PRO_A)
  const proBId = await mkUser(PRO_B)
  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const voterIds = []
  for (const v of VOTERS) voterIds.push(await mkUser(v))

  // Two barber storefronts with different ratings.
  const { data: proA } = await admin.from('pros').insert({ profile_id: proAId, handle: 'award_proa', display_name: 'Award ProA', category: 'barber', rating_avg: 4.0 }).select('id').single()
  const { data: proB } = await admin.from('pros').insert({ profile_id: proBId, handle: 'award_prob', display_name: 'Award ProB', category: 'barber', rating_avg: 4.9 }).select('id').single()

  // Isolated cycle in 'review'.
  const { data: cycle } = await admin.from('award_cycles').insert({ period: '2025-12-01', opens_at: '2025-12-01T00:00:00Z', closes_at: '2025-12-31T00:00:00Z', status: 'review' }).select('id').single()

  const { data: subA } = await admin.from('award_submissions').insert({ cycle_id: cycle.id, category: 'barber', pro_id: proA.id, look_label: 'A', status: 'approved', judge_score: 10 }).select('id').single()
  const { data: subB } = await admin.from('award_submissions').insert({ cycle_id: cycle.id, category: 'barber', pro_id: proB.id, look_label: 'B', status: 'approved', judge_score: 5 }).select('id').single()

  // Public votes: proA gets 3, proB gets 1 (no completed bookings -> all public).
  await admin.from('award_votes').insert([
    { cycle_id: cycle.id, category: 'barber', submission_id: subA.id, voter_profile_id: voterIds[0] },
    { cycle_id: cycle.id, category: 'barber', submission_id: subA.id, voter_profile_id: voterIds[1] },
    { cycle_id: cycle.id, category: 'barber', submission_id: subA.id, voter_profile_id: voterIds[2] },
    { cycle_id: cycle.id, category: 'barber', submission_id: subB.id, voter_profile_id: voterIds[3] },
  ])

  // Non-admin cannot compute.
  const voter = createClient(URL, ANON, { auth: { persistSession: false } })
  await voter.auth.signInWithPassword({ email: VOTERS[0], password: PASSWORD })
  const { error: denyErr } = await voter.rpc('compute_award_winners', { _cycle_id: cycle.id })
  check('non-admin cannot compute winners', !!denyErr, denyErr?.message || 'no error!')

  // Admin computes.
  const adminC = createClient(URL, ANON, { auth: { persistSession: false } })
  await adminC.auth.signInWithPassword({ email: ADMIN, password: PASSWORD })
  const { data: count, error: cErr } = await adminC.rpc('compute_award_winners', { _cycle_id: cycle.id })
  check('admin computes winners (1 category)', !cErr && count === 1, cErr?.message || `count ${count}`)

  // proA wins: public votes (50%) dominate. (A: 0.5*1+0.2*0.816+0.1*1=0.763; B: 0.5*0.333+0.2*1+0.1*0.5=0.416)
  const { data: win } = await admin.from('award_winners').select('pro_id').eq('cycle_id', cycle.id).eq('category', 'barber').single()
  check('barber winner is ProA (public votes dominate)', win.pro_id === proA.id, win.pro_id === proB.id ? 'got ProB' : 'ok')

  // Cleanup: winners FK is restrict -> remove before deleting pros/cycle.
  await admin.from('award_winners').delete().eq('cycle_id', cycle.id)
  await admin.from('award_cycles').delete().eq('id', cycle.id)
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nAWARD RESULTS TEST\n==================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
