// Batch 11 P5 — events, ticketing, attendee aggregation, champion perk, payout.
// Verifies: in-app Stripe ticket purchase + capacity-guarded settle; Eventbrite
// import upserts idempotently + matches email->profile; champion crown applies
// featured slot + boost; prize payout guards (admin-only, payouts required).
// Run: node --env-file=.env scripts/test-events.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Event-Pass1!'
const ADMIN = 'ev-admin@example.com'
const BUYER = 'ev-buyer@example.com'
const KNOWN = 'ev-known@example.com' // pre-existing account for email-match
const CHAMP = 'ev-champ@example.com'
const ALL = [ADMIN, BUYER, KNOWN, CHAMP]
const COMP = 'P5 Test Lineup'

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
async function setFlag(on) {
  await admin.from('platform_settings').update({ value: on }).eq('key', 'lineup_on')
}
async function cleanup() {
  const { data: comp } = await admin.from('competitions').select('id').eq('name', COMP).maybeSingle()
  if (comp) {
    const { data: evs } = await admin.from('events').select('id').eq('competition_id', comp.id)
    for (const e of evs || []) await admin.from('events').delete().eq('id', e.id) // attendees cascade
    await admin.from('competitions').delete().eq('id', comp.id) // contestants cascade
  }
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  await setFlag(true)

  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  await mkUser(BUYER)
  const knownId = await mkUser(KNOWN)
  const champUid = await mkUser(CHAMP)
  const { data: champPro } = await admin.from('pros').insert({ profile_id: champUid, handle: 'ev_champ', display_name: 'Champ Pro', category: 'barber' }).select('id,champion_boost').single()

  const { data: comp } = await admin.from('competitions').insert({ name: COMP, scope: 'city', metro: 'EvMetro', status: 'live' }).select('id').single()

  // --- In-app ticketing with capacity = 1 ---
  const { data: event } = await admin.from('events').insert({
    competition_id: comp.id, title: 'Finals Night', venue: 'The Hall', status: 'published',
    capacity: 1, ticket_price: 2500, ticketing_provider: 'stripe',
  }).select('id').single()

  const buyer = await signIn(BUYER)
  const b1 = await buyer.functions.invoke('buy_event_ticket', { body: { event_id: event.id, qty: 1 } })
  check('buy_event_ticket returns clientSecret', !b1.error && !!b1.data?.clientSecret, b1.error?.message || JSON.stringify(b1.data))
  check('ticket total = price x qty', b1.data?.total === 2500, `got ${b1.data?.total}`)
  const a1 = b1.data?.attendee_id

  // Second pending ticket (pre-check passes — none confirmed yet).
  const b2 = await buyer.functions.invoke('buy_event_ticket', { body: { event_id: event.id, qty: 1 } })
  const a2 = b2.data?.attendee_id
  check('second pending ticket created', !!a2)

  // Settle the first (what the webhook does) -> confirmed.
  const { data: s1 } = await admin.rpc('mark_ticket_paid', { _attendee_id: a1 })
  check('first ticket confirmed', s1 === 'confirmed', String(s1))
  // Settling the second exceeds capacity -> authoritative guard rejects.
  const { error: s2err } = await admin.rpc('mark_ticket_paid', { _attendee_id: a2 })
  check('capacity guard blocks oversold ticket', !!s2err, s2err?.message || 'no error!')
  // Idempotent re-settle of the first.
  const { data: s1again } = await admin.rpc('mark_ticket_paid', { _attendee_id: a1 })
  check('re-settle is idempotent', s1again === 'confirmed')

  // --- Eventbrite import: upsert + email match ---
  const ebRows = [
    { external_ref: 'EB-1001', email: KNOWN, name: 'Known Buyer', qty: 2, amount: 5000, ticket_type: 'GA' },
    { external_ref: 'EB-1002', email: 'stranger@nowhere.test', name: 'Walk In', qty: 1, amount: 2500 },
  ]
  const { data: imp1 } = await (await signIn(ADMIN)).rpc('import_event_attendees', { _event_id: event.id, _source: 'eventbrite', _rows: ebRows })
  check('import returns row count', imp1 === 2, String(imp1))
  const { data: matched } = await admin.from('event_attendees').select('profile_id,qty').eq('external_ref', 'EB-1001').single()
  check('imported attendee matched to known profile', matched.profile_id === knownId)
  const { data: unmatched } = await admin.from('event_attendees').select('profile_id').eq('external_ref', 'EB-1002').single()
  check('unknown email left unmatched', unmatched.profile_id === null)
  // Re-import same refs -> idempotent (no duplicates).
  await (await signIn(ADMIN)).rpc('import_event_attendees', { _event_id: event.id, _source: 'eventbrite', _rows: ebRows })
  const { data: ebCount } = await admin.from('event_attendees').select('id').eq('event_id', event.id).eq('source', 'eventbrite')
  check('re-import does not duplicate', ebCount.length === 2, `count ${ebCount.length}`)

  // --- Champion perk: featured slot + permanent boost on crown ---
  const { data: contestant } = await admin.from('contestants').insert({ competition_id: comp.id, pro_id: champPro.id, seed: 1, status: 'active' }).select('id').single()
  await admin.from('contestants').update({ status: 'champion' }).eq('id', contestant.id)
  const { data: proAfter } = await admin.from('pros').select('featured_until,champion_boost').eq('id', champPro.id).single()
  check('champion gets a featured slot', !!proAfter.featured_until && new Date(proAfter.featured_until) > new Date())
  check('champion gets a permanent boost (+0.5)', Number(proAfter.champion_boost) === 0.5, `got ${proAfter.champion_boost}`)

  // --- Prize payout guards ---
  const payNonAdmin = await buyer.functions.invoke('payout_champion', { body: { competition_id: comp.id, amount_cents: 50000 } })
  check('non-admin cannot pay out prize', !!payNonAdmin.error, 'expected 403')
  const payNoPayouts = await (await signIn(ADMIN)).functions.invoke('payout_champion', { body: { competition_id: comp.id, amount_cents: 50000 } })
  check('payout blocked until champion completes payout setup', !!payNoPayouts.error, payNoPayouts.error?.message || 'no error!')

  await setFlag(false)
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nEVENTS / TICKETING TEST\n=======================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-----------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
