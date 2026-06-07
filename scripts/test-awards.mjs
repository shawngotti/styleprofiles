// Batch 9 ticket 1 — Awards voting integrity test.
// Run: node --env-file=.env scripts/test-awards.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const EMAIL = 'awards-voter@example.com'
const PASSWORD = 'Awards-Pass1!'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function vote(token, submissionId) {
  const res = await fetch(`${URL}/functions/v1/cast_award_vote`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission_id: submissionId }),
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
  const voterId = sess.session.user.id

  const { data: cycle } = await admin.from('award_cycles').select('id').eq('period', '2026-06-01').single()
  const { data: subs } = await admin
    .from('award_submissions')
    .select('id,category')
    .eq('cycle_id', cycle.id)
  const byCat = Object.fromEntries(subs.map((s) => [s.category, s.id]))

  // 1) Vote in the barber category.
  check('vote in barber category succeeds (201)', (await vote(token, byCat.barber)).status === 201)

  // 2) Second vote in the same category is rejected.
  check('second vote in same category rejected (409)', (await vote(token, byCat.barber)).status === 409)

  // 3) Vote in a different category is allowed.
  check('vote in stylist category succeeds (201)', (await vote(token, byCat.stylist)).status === 201)

  // 4) Two votes recorded for the voter.
  const { data: myVotes } = await admin.from('award_votes').select('category').eq('voter_profile_id', voterId)
  check('exactly two votes recorded across categories', myVotes.length === 2)

  // 5) Unapproved nominee can't be voted on.
  await admin.from('award_submissions').update({ status: 'pending' }).eq('id', byCat.loctician)
  check('voting an unapproved nominee is rejected', (await vote(token, byCat.loctician)).status === 400)
  await admin.from('award_submissions').update({ status: 'approved' }).eq('id', byCat.loctician)

  // 6) No voting outside the 'voting' status.
  await admin.from('award_cycles').update({ status: 'review' }).eq('id', cycle.id)
  const closed = await vote(token, byCat.nail)
  check('voting blocked when cycle is in review', closed.status === 400 && /not open/.test(closed.json?.error || ''))
  await admin.from('award_cycles').update({ status: 'voting' }).eq('id', cycle.id)

  // Cleanup voter (votes cascade)
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nAWARDS VOTING TEST\n==================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
