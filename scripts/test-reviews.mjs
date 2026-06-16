// Reviews loop — server-authoritative posting + moderation.
// Verifies: direct client insert is blocked by RLS (must go through
// submit_review); submit verifies a completed booking; the local spam heuristic
// flags links; manual mode queues clean reviews; pending/flagged reviews are
// hidden from the public but visible to the author + pro; rating cache counts
// only approved; admin approve/remove works; pro reply notifies the client and
// a new approved review notifies the pro.
// Run: node --env-file=.env scripts/test-reviews.mjs

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
const anon = createClient(URL, ANON, { auth: { persistSession: false } })
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
const ratingOf = async (id) => (await admin.from('pros').select('rating_avg,rating_count').eq('id', id).single()).data
async function setMode(m) {
  await admin.from('platform_settings').update({ value: m }).eq('key', 'review_moderation_mode')
}

async function main() {
  await cleanup()
  const prevMode = (await admin.from('platform_settings').select('value').eq('key', 'review_moderation_mode').maybeSingle()).data?.value || 'auto'
  await setMode('manual') // deterministic: clean reviews queue regardless of OPENAI key

  const proUid = await mkUser(PRO)
  const c1 = await mkUser(C1)
  const c2 = await mkUser(C2)
  // proUid is also an admin so it can moderate (additive role).
  await admin.from('user_roles').insert({ user_id: proUid, role: 'admin' })
  const { data: pro } = await admin.from('pros').insert({ profile_id: proUid, handle: 'rev_pro', display_name: 'Rev Pro', category: 'barber' }).select('id').single()

  // Bookings: completed ones to review + one non-completed.
  const mk = async (cid, date, status) => (await admin.from('bookings').insert({ client_profile_id: cid, pro_id: pro.id, service_date: date, status }).select('id').single()).data
  const bk1 = await mk(c1, '2026-01-10', 'completed')
  const bk2 = await mk(c2, '2026-01-11', 'completed')
  const bk3 = await mk(c1, '2026-01-12', 'completed')
  const bk4 = await mk(c2, '2026-01-13', 'pending')

  const cli1 = await signIn(C1)
  const cli2 = await signIn(C2)
  const proC = await signIn(PRO)

  // 1. Direct client insert is now blocked by RLS.
  const direct = await cli1.from('reviews').insert({ pro_id: pro.id, author_profile_id: c1, booking_id: bk1.id, rating: 5 })
  check('direct client insert blocked by RLS', !!direct.error, direct.error?.message || 'expected denial')

  // 2. submit_review on a non-completed booking is rejected.
  const bad = await cli2.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: bk4.id, rating: 5 } })
  check('submit on non-completed booking rejected', !!bad.error, JSON.stringify(bad.data))

  // 3. Clean review (manual mode) -> pending.
  const ok1 = await cli1.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: bk1.id, rating: 5, body: 'Great cut, very clean.' } })
  check('clean review submits', !ok1.error && ok1.data?.ok, ok1.error?.message || JSON.stringify(ok1.data))
  check('clean review queued as pending (manual)', ok1.data?.status === 'pending', ok1.data?.status)
  const rev1 = (await admin.from('reviews').select('id,verified,status').eq('booking_id', bk1.id).single()).data
  check('submitted review is verified', rev1.verified === true)

  // 4. Pending review is hidden from public, visible to author.
  check('public cannot see pending review', ((await anon.from('reviews').select('id').eq('id', rev1.id)).data || []).length === 0)
  check('author can see own pending review', ((await cli1.from('reviews').select('id').eq('id', rev1.id)).data || []).length === 1)
  check('pro can see pending review on their profile', ((await proC.from('reviews').select('id').eq('id', rev1.id)).data || []).length === 1)
  const rPend = await ratingOf(pro.id)
  check('rating not moved by pending review', rPend.rating_count === 0, JSON.stringify(rPend))

  // 5. Spam (a link in the body) is auto-flagged even without OpenAI.
  const spam = await cli1.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: bk3.id, rating: 5, body: 'Best ever http://promo.example.com call 555-123-4567' } })
  check('spammy review auto-flagged', spam.data?.status === 'flagged', JSON.stringify(spam.data))

  // 6. Duplicate review on the same booking is rejected.
  const dup = await cli1.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: bk1.id, rating: 4 } })
  check('duplicate review rejected', !!dup.error, JSON.stringify(dup.data))

  // 7. Admin approves the pending review -> live, rating recomputes, pro notified.
  await admin.from('reviews').update({ status: 'approved', moderated_at: new Date().toISOString() }).eq('id', rev1.id)
  check('public sees approved review', ((await anon.from('reviews').select('id').eq('id', rev1.id)).data || []).length === 1)
  const rApp = await ratingOf(pro.id)
  check('rating counts only approved (avg 5, n 1)', Number(rApp.rating_avg) === 5 && rApp.rating_count === 1, JSON.stringify(rApp))
  const proNotif = (await admin.from('notifications').select('id').eq('recipient_profile_id', proUid).eq('kind', 'review')).data || []
  check('pro notified of new approved review', proNotif.length >= 1)
  const proEmail = (await admin.from('email_outbox').select('id,subject').eq('to_profile_id', proUid).eq('kind', 'review')).data || []
  check('pro emailed about new review', proEmail.length >= 1, JSON.stringify(proEmail[0]?.subject))

  // 8. Replies post only through the screening function.
  const directReply = await proC.from('review_responses').insert({ review_id: rev1.id, pro_id: pro.id, body: 'hi' })
  check('direct reply insert blocked by RLS', !!directReply.error, directReply.error?.message || 'expected denial')

  const spamReply = await proC.functions.invoke('submit_review_reply', { body: { review_id: rev1.id, body: 'Thanks! More at http://promo.example.com' } })
  check('spammy reply rejected', !!spamReply.error, JSON.stringify(spamReply.data))

  const reply = await proC.functions.invoke('submit_review_reply', { body: { review_id: rev1.id, body: 'Appreciate you — see you next time!' } })
  check('clean reply posts via function', !reply.error && reply.data?.ok, reply.error?.message || JSON.stringify(reply.data))
  const cliNotif = (await admin.from('notifications').select('id').eq('recipient_profile_id', c1).eq('kind', 'review_reply')).data || []
  check('client notified of pro reply (review_reply)', cliNotif.length >= 1)
  const pubReply = (await anon.from('review_responses').select('body').eq('review_id', rev1.id)).data || []
  check('reply is publicly visible', pubReply[0]?.body === 'Appreciate you — see you next time!')

  // A non-owner cannot reply.
  const notOwner = await cli1.functions.invoke('submit_review_reply', { body: { review_id: rev1.id, body: 'sneaky' } })
  check('non-owner cannot reply', !!notOwner.error)

  // 9. Admin removes a review -> drops from public + rating.
  await admin.from('reviews').update({ status: 'removed', removed_by: proUid, moderated_at: new Date().toISOString() }).eq('id', rev1.id)
  check('removed review hidden from public', ((await anon.from('reviews').select('id').eq('id', rev1.id)).data || []).length === 0)
  const rRem = await ratingOf(pro.id)
  check('rating drops after removal (n 0)', rRem.rating_count === 0, JSON.stringify(rRem))

  await setMode(prevMode)
  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nREVIEWS MODERATION TEST\n=======================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-----------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
