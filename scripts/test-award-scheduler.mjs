// Batch 9 ticket 3 — Awards cycle scheduler (submissions → voting → review → complete).
// Builds three isolated cycles, each poised on a different boundary, runs
// advance_award_cycles() once, and asserts each transitioned correctly with the
// right notifications. Also checks ensure_upcoming_award_cycle() is idempotent.
// Run: node --env-file=.env scripts/test-award-scheduler.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) throw new Error('Missing env vars in .env')

const PASSWORD = 'Sched-Pass1!'
const PRO_A = 'sched-proa@example.com'
const PRO_B = 'sched-prob@example.com'
const ALL = [PRO_A, PRO_B]
// Isolated periods well away from any seeded/real cycle.
const P_SUB = '2024-01-01' // submissions, voting window already open -> voting
const P_VOTE = '2024-02-01' // voting, window already closed -> review
const P_REVIEW = '2024-03-01' // review, with votes -> complete + winner

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function mkUser(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  return data.user.id
}

const iso = (d) => new Date(d).toISOString()
const DAY = 86400000

async function cleanup() {
  for (const period of [P_SUB, P_VOTE, P_REVIEW]) {
    const { data: c } = await admin.from('award_cycles').select('id').eq('period', period).maybeSingle()
    if (c) {
      await admin.from('award_winners').delete().eq('cycle_id', c.id)
      await admin.from('award_cycles').delete().eq('id', c.id) // votes/subs cascade
    }
  }
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  const now = Date.now()

  const proAId = await mkUser(PRO_A)
  const proBId = await mkUser(PRO_B)
  const { data: proA } = await admin.from('pros').insert({ profile_id: proAId, handle: 'sched_proa', display_name: 'Sched ProA', category: 'barber', rating_avg: 4.2 }).select('id').single()
  const { data: proB } = await admin.from('pros').insert({ profile_id: proBId, handle: 'sched_prob', display_name: 'Sched ProB', category: 'barber', rating_avg: 4.8 }).select('id').single()

  // --- Cycle in 'submissions' whose voting window has opened (opens past, closes future) ---
  const { data: cSub } = await admin.from('award_cycles').insert({
    period: P_SUB, status: 'submissions',
    opens_at: iso(now - DAY), closes_at: iso(now + 7 * DAY),
  }).select('id').single()
  await admin.from('award_submissions').insert([
    { cycle_id: cSub.id, category: 'barber', pro_id: proA.id, look_label: 'A', status: 'approved' },
    { cycle_id: cSub.id, category: 'barber', pro_id: proB.id, look_label: 'B', status: 'pending' }, // not approved -> no notif
  ])

  // --- Cycle in 'voting' whose window has closed but whose results window is
  //     still open -> should land in 'review' and DWELL there (judges score).
  //     ProB has an approved nominee here, so the voting-closed notice fires. ---
  const { data: cVote } = await admin.from('award_cycles').insert({
    period: P_VOTE, status: 'voting',
    opens_at: iso(now - 30 * DAY), closes_at: iso(now - DAY), results_at: iso(now + 3 * DAY),
  }).select('id').single()
  await admin.from('award_submissions').insert({ cycle_id: cVote.id, category: 'barber', pro_id: proB.id, look_label: 'B-vote', status: 'approved' })

  // --- Cycle in 'review' past its results window, with nominees + votes -> complete ---
  const { data: cRev } = await admin.from('award_cycles').insert({
    period: P_REVIEW, status: 'review',
    opens_at: iso(now - 60 * DAY), closes_at: iso(now - 30 * DAY), results_at: iso(now - DAY),
  }).select('id').single()
  const { data: subRA } = await admin.from('award_submissions').insert({ cycle_id: cRev.id, category: 'barber', pro_id: proA.id, look_label: 'A', status: 'approved', judge_score: 5 }).select('id').single()
  await admin.from('award_submissions').insert({ cycle_id: cRev.id, category: 'barber', pro_id: proB.id, look_label: 'B', status: 'approved', judge_score: 5 })
  // Two public votes for ProA, none for ProB -> ProA wins.
  const v1 = await mkUser('sched-v1@example.com')
  const v2 = await mkUser('sched-v2@example.com')
  ALL.push('sched-v1@example.com', 'sched-v2@example.com')
  await admin.from('award_votes').insert([
    { cycle_id: cRev.id, category: 'barber', submission_id: subRA.id, voter_profile_id: v1 },
    { cycle_id: cRev.id, category: 'barber', submission_id: subRA.id, voter_profile_id: v2 },
  ])

  // Baseline notification counts for the two pros (so we measure only new ones).
  const baseline = async (pid) =>
    (await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_profile_id', pid).eq('kind', 'awards')).count
  const proANotifBefore = await baseline(proAId)
  const proBNotifBefore = await baseline(proBId)

  // --- Run the scheduler once (as service_role, the trusted server identity) ---
  const { data: summary, error: advErr } = await admin.rpc('advance_award_cycles')
  check('advance_award_cycles runs without error', !advErr, advErr?.message || '')
  check('summary reports >=1 to_voting/to_review/completed', summary && summary.to_voting >= 1 && summary.to_review >= 1 && summary.completed >= 1, JSON.stringify(summary))

  const statusOf = async (id) => (await admin.from('award_cycles').select('status').eq('id', id).single()).data.status
  check('submissions cycle advanced to voting', (await statusOf(cSub.id)) === 'voting')
  check('voting cycle advanced to review', (await statusOf(cVote.id)) === 'review')
  check('review cycle advanced to complete', (await statusOf(cRev.id)) === 'complete')

  // Winner written for the review cycle, and it's ProA.
  const { data: win } = await admin.from('award_winners').select('pro_id').eq('cycle_id', cRev.id).eq('category', 'barber').maybeSingle()
  check('winner written for completed cycle', !!win)
  check('winner is ProA (more public votes)', win?.pro_id === proA.id, win?.pro_id === proB.id ? 'got ProB' : '')

  // Notifications across the run:
  //  ProA: voting-open (approved in P_SUB) + winner congrats (P_REVIEW)      = 2
  //  ProB: voting-closed (approved in P_VOTE) + results-in (non-winner P_REV) = 2
  const proANotifAfter = await baseline(proAId)
  const proBNotifAfter = await baseline(proBId)
  check('ProA received 2 award notifications (voting-open + winner)', proANotifAfter - proANotifBefore === 2, `delta ${proANotifAfter - proANotifBefore}`)
  check('ProB received 2 award notifications (voting-closed + results)', proBNotifAfter - proBNotifBefore === 2, `delta ${proBNotifAfter - proBNotifBefore}`)
  const proBBodies = (await admin.from('notifications').select('body').eq('recipient_profile_id', proBId).eq('kind', 'awards')).data.map((n) => n.body)
  check('ProB got a voting-closed notice', proBBodies.some((b) => b.includes('Voting has closed')))
  check('ProB got a results-in notice', proBBodies.some((b) => b.includes('results are in')))

  // --- Idempotency: a second run is a no-op (everything already advanced) ---
  const { data: summary2 } = await admin.rpc('advance_award_cycles')
  const noopForOurs = (await statusOf(cSub.id)) === 'voting' && (await statusOf(cVote.id)) === 'review' && (await statusOf(cRev.id)) === 'complete'
  check('second advance leaves our cycles unchanged (idempotent)', noopForOurs, JSON.stringify(summary2))

  // --- ensure_upcoming_award_cycle: creates next month once, idempotent twice ---
  const { data: up1 } = await admin.rpc('ensure_upcoming_award_cycle')
  const { data: up2 } = await admin.rpc('ensure_upcoming_award_cycle')
  check('ensure_upcoming returns a cycle id', !!up1)
  check('ensure_upcoming is idempotent (same id)', up1 === up2, `${up1} vs ${up2}`)
  const { data: upCycle } = await admin.from('award_cycles').select('status,period').eq('id', up1).single()
  check('upcoming cycle is in submissions', upCycle?.status === 'submissions', upCycle?.status)

  // Cleanup (leave the upcoming cycle? it's a real future cycle — remove it so
  // the test is self-contained and reruns cleanly).
  await admin.from('award_winners').delete().eq('cycle_id', cRev.id)
  if (up1) await admin.from('award_cycles').delete().eq('id', up1)
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nAWARD SCHEDULER TEST\n====================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('--------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
