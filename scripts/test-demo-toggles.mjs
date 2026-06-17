// Demo Shop/Lineup toggles are self-sufficient: demo content shows to the public
// under demo_shop_on / demo_lineup_on ALONE (marketplace_on / lineup_on off),
// while real (non-demo) content stays gated on the launch flag.
// Run: node --env-file=.env scripts/test-demo-toggles.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const anon = createClient(URL, ANON, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
const setFlag = (k, v) => admin.from('platform_settings').update({ value: v }).eq('key', k)

const TAG = 'ZZ_demotoggle'
async function cleanup() {
  await admin.from('products').delete().like('name', `${TAG}%`)
  await admin.from('competitions').delete().like('name', `${TAG}%`) // cascades rounds/contestants/matchups/windows
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === 'dt-pro@example.com') await admin.auth.admin.deleteUser(u.id)
}
const seePrproducts = async () => ((await anon.from('products').select('id,is_demo').like('name', `${TAG}%`)).data || [])
const seeComp = async () => ((await anon.from('competitions').select('id').like('name', `${TAG}%`)).data || [])

async function main() {
  await cleanup()
  for (const k of ['marketplace_on', 'lineup_on', 'demo_shop_on', 'demo_lineup_on']) await setFlag(k, false)

  // Demo + real product.
  await admin.from('products').insert([
    { name: `${TAG} demo serum`, price: 1999, is_available: true, inventory_qty: 5, is_demo: true },
    { name: `${TAG} real serum`, price: 1999, is_available: true, inventory_qty: 5, is_demo: false },
  ])
  // Demo competition + full bracket.
  const { data: pu } = await admin.auth.admin.createUser({ email: 'dt-pro@example.com', password: 'Dt-1!', email_confirm: true })
  const { data: pro } = await admin.from('pros').insert({ profile_id: pu.user.id, handle: 'dt_pro', display_name: 'DT Pro', category: 'barber', is_demo: true }).select('id').single()
  const { data: comp } = await admin.from('competitions').insert({ name: `${TAG} Showdown`, scope: 'city', metro: 'Chicago, IL', status: 'live', is_demo: true }).select('id').single()
  const { data: round } = await admin.from('competition_rounds').insert({ competition_id: comp.id, name: 'Semifinal', round_order: 1, status: 'live' }).select('id').single()
  const { data: ct } = await admin.from('contestants').insert({ competition_id: comp.id, pro_id: pro.id, seed: 1, status: 'active' }).select('id').single()
  await admin.from('matchups').insert({ round_id: round.id, contestant_a: ct.id, status: 'pending' })
  await admin.from('voting_windows').insert({ competition_id: comp.id, vote_type: 'fan_favorite', status: 'open', opens_at: '2026-06-01T00:00:00Z', closes_at: '2026-12-01T00:00:00Z' })

  // 1. All flags off → public sees nothing.
  check('all off: no demo products visible', (await seePrductsSafe()) === 0)
  check('all off: no demo competition visible', (await seeComp()).length === 0)

  // 2. demo_shop_on alone → demo product visible, real product still hidden.
  await setFlag('demo_shop_on', true)
  const prods = await seePrproducts()
  check('demo_shop_on alone: demo product visible', prods.some((p) => p.is_demo), JSON.stringify(prods))
  check('demo_shop_on alone: real product still hidden', !prods.some((p) => !p.is_demo))

  // 3. demo_lineup_on alone → demo competition + bracket children visible.
  await setFlag('demo_lineup_on', true)
  check('demo_lineup_on alone: competition visible', (await seeComp()).length === 1)
  check('  rounds visible', ((await anon.from('competition_rounds').select('id').eq('competition_id', comp.id)).data || []).length === 1)
  check('  contestants visible', ((await anon.from('contestants').select('id').eq('competition_id', comp.id)).data || []).length === 1)
  check('  matchups visible', ((await anon.from('matchups').select('id').eq('round_id', round.id)).data || []).length === 1)
  check('  voting window visible', ((await anon.from('voting_windows').select('id').eq('competition_id', comp.id)).data || []).length === 1)

  // 4. Turning demo off hides it again.
  await setFlag('demo_shop_on', false)
  await setFlag('demo_lineup_on', false)
  check('demo off again: products hidden', (await seePrductsSafe()) === 0)
  check('demo off again: competition hidden', (await seeComp()).length === 0)

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nDEMO TOGGLE TEST\n================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('----------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}
async function seePrductsSafe() { return (await seePrproducts()).length }
main().catch((e) => { console.error('Test error:', e.message); process.exit(2) })
