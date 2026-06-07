// Batch 10 — marketplace backend (flag gate + checkout + inventory).
// Verifies: catalog is unreachable + checkout rejects when marketplace_on is
// false; with it on, server computes totals from the catalog, blocks oversell,
// and mark_order_paid settles + decrements inventory idempotently.
// Run: node --env-file=.env scripts/test-marketplace.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Shop-Pass1!'
const BUYER = 'shop-buyer@example.com'
const ADMIN = 'shop-admin@example.com'
const ALL = [BUYER, ADMIN]
const CAT = 'test-selfcare'

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
  await admin.from('platform_settings').update({ value: on }).eq('key', 'marketplace_on')
}

async function cleanup() {
  // Orders by our buyers, then products/category.
  const ids = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((u) => ALL.includes(u.email))
  for (const u of ids) {
    await admin.from('orders').delete().eq('buyer_profile_id', u.id)
    await admin.auth.admin.deleteUser(u.id)
  }
  await admin.from('products').delete().eq('category', CAT)
  await admin.from('product_categories').delete().eq('slug', CAT)
}

async function main() {
  await cleanup()
  await setFlag(false)

  await mkUser(ADMIN).then((id) => admin.from('user_roles').insert({ user_id: id, role: 'admin' }))
  await mkUser(BUYER)

  await admin.from('product_categories').insert({ slug: CAT, label: 'Test Self-Care', sort: 99 })
  const { data: prods } = await admin.from('products').insert([
    { name: 'Test Pomade', category: CAT, price: 1800, inventory_qty: 3, is_available: true },
    { name: 'Test Beard Oil', category: CAT, price: 2200, inventory_qty: null, is_available: true }, // untracked
  ]).select('id,name,price')
  const pomade = prods.find((p) => p.name === 'Test Pomade')
  const oil = prods.find((p) => p.name === 'Test Beard Oil')

  const buyer = await signIn(BUYER)

  // --- Flag OFF: catalog unreachable, checkout rejected ---
  const { data: hiddenCatalog } = await buyer.from('products').select('id').eq('category', CAT)
  check('catalog hidden when marketplace_on=false', (hiddenCatalog || []).length === 0, `saw ${hiddenCatalog?.length}`)
  const offOrder = await buyer.functions.invoke('create_order', { body: { cart: [{ product_id: pomade.id, qty: 1 }] } })
  check('create_order rejected when flag off', !!offOrder.error, offOrder.error?.message || 'no error!')

  // --- Flip the flag on ---
  await setFlag(true)
  const { data: visible } = await buyer.from('products').select('id,price').eq('category', CAT)
  check('catalog visible when marketplace_on=true', (visible || []).length === 2)

  // --- Oversell blocked (only 3 pomade in stock) ---
  const over = await buyer.functions.invoke('create_order', { body: { cart: [{ product_id: pomade.id, qty: 5 }] } })
  check('oversell blocked at checkout', !!over.error, over.error?.message || 'no error!')

  // --- Valid order: server computes totals from the catalog ---
  const r = await buyer.functions.invoke('create_order', { body: { cart: [{ product_id: pomade.id, qty: 2 }, { product_id: oil.id, qty: 1 }] } })
  check('create_order succeeds', !r.error && !!r.data?.order_id, r.error?.message || JSON.stringify(r.data))
  const expectedSubtotal = 1800 * 2 + 2200
  check('subtotal computed server-side', r.data?.subtotal === expectedSubtotal, `got ${r.data?.subtotal}`)
  check('total = subtotal + shipping', r.data?.total === expectedSubtotal + r.data?.shipping)
  check('returns a Stripe clientSecret', typeof r.data?.clientSecret === 'string' && r.data.clientSecret.includes('secret'))
  const orderId = r.data.order_id

  // Line items snapshot price; order is pending.
  const { data: items } = await admin.from('order_items').select('product_name,unit_price,qty').eq('order_id', orderId).order('product_name')
  check('order_items snapshot price + qty', items.length === 2 && items.every((i) => i.unit_price > 0 && i.qty > 0))
  const { data: ord0 } = await admin.from('orders').select('status').eq('id', orderId).single()
  check('order starts pending', ord0.status === 'pending')

  // --- Settle via mark_order_paid (what the webhook calls) ---
  const { data: settled } = await admin.rpc('mark_order_paid', { _order_id: orderId })
  check('mark_order_paid -> paid', settled === 'paid', String(settled))
  const { data: ord1 } = await admin.from('orders').select('status').eq('id', orderId).single()
  check('order is paid', ord1.status === 'paid')
  const { data: pomadeAfter } = await admin.from('products').select('inventory_qty').eq('id', pomade.id).single()
  check('inventory decremented (3 - 2 = 1)', pomadeAfter.inventory_qty === 1, `got ${pomadeAfter.inventory_qty}`)

  // --- Idempotent: second settle does not double-decrement ---
  const { data: again } = await admin.rpc('mark_order_paid', { _order_id: orderId })
  check('second settle is a no-op', again === 'paid')
  const { data: pomadeAgain } = await admin.from('products').select('inventory_qty').eq('id', pomade.id).single()
  check('inventory unchanged on re-settle', pomadeAgain.inventory_qty === 1, `got ${pomadeAgain.inventory_qty}`)

  await setFlag(false)
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nMARKETPLACE TEST\n================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('----------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
