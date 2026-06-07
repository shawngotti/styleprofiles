// Fill My Chair — promotional open slots.
// Verifies: posting a deal notifies the pro's past clients; claiming atomically
// reserves the slot, creates a discounted booking with a deposit PI, and notifies
// the pro; a second claim on the same slot is rejected; expired deals can't be
// claimed. Run: node --env-file=.env scripts/test-chair.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Chair-Pass1!'
const PRO = 'chair-pro@example.com'
const C1 = 'chair-c1@example.com'
const C2 = 'chair-c2@example.com'
const ALL = [PRO, C1, C2]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
async function mkUser(email) { const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true }); return data.user.id }
async function signIn(email) { const c = createClient(URL, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: PW }); return c }
async function cleanup() {
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id) // pros/services/promos/bookings/notifs cascade
}
const iso = (ms) => new Date(ms).toISOString()

async function main() {
  await cleanup()
  const now = Date.now()
  const proUid = await mkUser(PRO)
  const c1 = await mkUser(C1)
  const c2 = await mkUser(C2)
  const { data: pro } = await admin.from('pros').insert({ profile_id: proUid, handle: 'chair_pro', display_name: 'Chair Pro', category: 'barber', charges_enabled: true }).select('id').single()
  const { data: service } = await admin.from('services').insert({ pro_id: pro.id, name: 'Fade', price: 5000, deposit: 2000, duration_min: 45, is_addon: false, active: true, sort: 0 }).select('id').single()
  // C1 is a past client (in the audience); C2 is not.
  await admin.from('bookings').insert({ client_profile_id: c1, pro_id: pro.id, service_date: '2026-01-05', status: 'completed' })

  // --- Pro posts a deal (RLS owner insert; notify trigger fires) ---
  const proC = await signIn(PRO)
  const { data: promo, error: postErr } = await proC.from('chair_promotions').insert({
    pro_id: pro.id, service_id: service.id, slot_label: 'This Saturday', slot_time: '3:00 PM',
    slot_at: iso(now + 2 * 86400000), expires_at: iso(now + 6 * 3600000),
    promo_type: 'last_minute', discount_pct: 20, audience: 'loyalty', status: 'open',
  }).select('id,notified_count').single()
  check('pro posts a deal', !postErr, postErr?.message || '')
  // notified_count is set by an AFTER-INSERT trigger, so re-read it from the table.
  const { data: posted } = await admin.from('chair_promotions').select('notified_count').eq('id', promo.id).single()
  check('audience notified count recorded', posted?.notified_count >= 1, `notified ${posted?.notified_count}`)
  const { data: c1notif } = await admin.from('notifications').select('id').eq('recipient_profile_id', c1).eq('kind', 'chair')
  check('past client received a deal notification', (c1notif || []).length >= 1)

  // --- C1 claims (Edge Function -> atomic claim + discounted booking + PI) ---
  const cli1 = await signIn(C1)
  const r = await cli1.functions.invoke('claim_chair_promotion', { body: { promo_id: promo.id } })
  check('claim succeeds', !r.error && !!r.data?.booking_id, r.error?.message || JSON.stringify(r.data))
  check('discounted deposit returned (2000 - 20% = 1600)', r.data?.deposit_total === 1600, `got ${r.data?.deposit_total}`)
  check('deposit clientSecret returned', typeof r.data?.clientSecret === 'string' && r.data.clientSecret.includes('secret'))

  const { data: claimed } = await admin.from('chair_promotions').select('status,claimed_by_profile_id,booking_id').eq('id', promo.id).single()
  check('promo marked claimed by C1', claimed.status === 'claimed' && claimed.claimed_by_profile_id === c1 && !!claimed.booking_id)
  const { data: bk } = await admin.from('bookings').select('client_profile_id,service_total,deposit_total').eq('id', r.data.booking_id).single()
  check('booking is the claimer\'s, discounted (5000->4000)', bk.client_profile_id === c1 && bk.service_total === 4000 && bk.deposit_total === 1600)
  const { data: proNotif } = await admin.from('notifications').select('id').eq('recipient_profile_id', proUid).eq('kind', 'chair')
  check('pro notified of the claim', (proNotif || []).length >= 1)

  // --- C2 can't claim the same slot ---
  const cli2 = await signIn(C2)
  const r2 = await cli2.functions.invoke('claim_chair_promotion', { body: { promo_id: promo.id } })
  check('second claim on same slot rejected', !!r2.error, 'expected error')

  // --- Expiry: an open deal past its window can't be claimed ---
  const { data: expired } = await admin.from('chair_promotions').insert({
    pro_id: pro.id, service_id: service.id, slot_at: iso(now + 86400000),
    expires_at: iso(now - 1000), discount_pct: 10, status: 'open',
  }).select('id').single()
  const { data: nExp } = await admin.rpc('expire_chair_promotions')
  check('expire job marks past-window deals expired', nExp >= 1, `expired ${nExp}`)
  const { data: expRow } = await admin.from('chair_promotions').select('status').eq('id', expired.id).single()
  check('deal is now expired', expRow.status === 'expired')
  const r3 = await cli2.functions.invoke('claim_chair_promotion', { body: { promo_id: expired.id } })
  check('claiming an expired deal rejected', !!r3.error, 'expected error')

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nFILL MY CHAIR TEST\n==================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => { console.error('\nTest error:', e.message); process.exit(2) })
