// Batch 8 ticket 6 — loyalty ledger test.
// Run: node --env-file=.env scripts/test-loyalty.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const CLIENT = 'loyalty-client@example.com'
const ADMIN = 'loyalty-admin@example.com'
const PASSWORD = 'Loyalty-Pass1!'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { c, uid: data.session.user.id }
}

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of list.users) if ([CLIENT, ADMIN].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
  const { data: cU } = await admin.auth.admin.createUser({ email: CLIENT, password: PASSWORD, email_confirm: true })
  await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true })
  const clientId = cU.user.id
  const adminU = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === ADMIN)
  await admin.from('user_roles').insert({ user_id: adminU.id, role: 'admin' })

  const client = await signIn(CLIENT)
  const adm = await signIn(ADMIN)

  const { data: dre } = await admin.from('pros').select('id').eq('handle', 'dre.thebarber').single()

  // A confirmed booking worth $555 -> should earn 555 points -> Silver tier.
  const { data: bk } = await admin
    .from('bookings')
    .insert({ client_profile_id: clientId, pro_id: dre.id, service_date: '2026-06-01', status: 'confirmed', service_total: 55500, deposit_total: 0 })
    .select('id')
    .single()

  // Complete it via the real state machine (admin) -> earn trigger fires.
  const { error: tErr } = await adm.c.rpc('transition_booking', { _booking_id: bk.id, _action: 'complete' })
  check('admin completes the booking', !tErr, tErr?.message || '')

  const { data: prof } = await admin.from('profiles').select('style_points,loyalty_tier').eq('id', clientId).single()
  check('earned 555 points on completion', prof.style_points === 555, `${prof.style_points}`)
  check('tier bumped to Silver (lifetime >= 500)', prof.loyalty_tier === 'Silver', prof.loyalty_tier)

  const { data: ledger } = await admin.from('loyalty_transactions').select('delta,reason,booking_id').eq('profile_id', clientId)
  check('ledger has the earn row tied to the booking', ledger.some((t) => t.delta === 555 && t.booking_id === bk.id))

  const { data: bkAfter } = await admin.from('bookings').select('points_earned').eq('id', bk.id).single()
  check('booking.points_earned stamped', bkAfter.points_earned === 555)

  // Redeem a 200-point reward (balance 555 -> 355).
  const { data: rwd } = await admin.from('rewards').select('id,cost_points').eq('name', '$10 off next visit').single()
  const { data: redeem, error: rErr } = await client.c.rpc('redeem_reward', { _reward_id: rwd.id })
  check('redeem 200-pt reward succeeds', !rErr && redeem?.balance === 355, rErr?.message || JSON.stringify(redeem))

  const { data: prof2 } = await admin.from('profiles').select('style_points,loyalty_tier').eq('id', clientId).single()
  check('balance decremented to 355', prof2.style_points === 355, `${prof2.style_points}`)
  check('redeeming does NOT lower tier (still Silver)', prof2.loyalty_tier === 'Silver', prof2.loyalty_tier)

  const { data: red } = await admin.from('reward_redemptions').select('cost_points').eq('profile_id', clientId)
  check('a redemption row was written', red.length === 1 && red[0].cost_points === 200)

  // Insufficient balance: VIP costs 1000, balance is 355 -> must fail.
  const { data: vip } = await admin.from('rewards').select('id').eq('name', 'VIP styling session').single()
  const { error: insErr } = await client.c.rpc('redeem_reward', { _reward_id: vip.id })
  check('redeem beyond balance is rejected', !!insErr, insErr?.message || 'no error!')

  // Balance unchanged after the failed redeem.
  const { data: prof3 } = await admin.from('profiles').select('style_points').eq('id', clientId).single()
  check('balance unchanged after failed redeem', prof3.style_points === 355, `${prof3.style_points}`)

  // Cleanup
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([CLIENT, ADMIN].includes(u.email)) await admin.auth.admin.deleteUser(u.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nLOYALTY LEDGER TEST\n===================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
