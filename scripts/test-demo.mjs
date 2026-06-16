// Demo content engine + per-aspect toggles.
// Verifies: admin seeds a full demo dataset (is_demo); demo pros are HIDDEN from
// the public until demo_pros_on is flipped; toggling shows them; clear removes
// everything. Run: node --env-file=.env scripts/test-demo.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Demo-Test1!'
const ADMIN = 'demo-admin@example.com'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })

async function setFlag(key, on) { await admin.from('platform_settings').update({ value: on }).eq('key', key) }
const demoProCount = async (client) => ((await client.from('pros').select('id').eq('is_demo', true)).data || []).length

async function main() {
  // clean any prior
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (u.email === ADMIN || u.email?.endsWith('@styleprofiles.demo')) await admin.auth.admin.deleteUser(u.id)
  await admin.from('pros').delete().eq('is_demo', true)
  await setFlag('demo_pros_on', false)

  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PW, email_confirm: true })
  await admin.from('user_roles').insert({ user_id: au.user.id, role: 'admin' })
  const adminC = createClient(URL, ANON, { auth: { persistSession: false } })
  await adminC.auth.signInWithPassword({ email: ADMIN, password: PW })

  // --- non-admin cannot seed ---
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const denied = await anon.functions.invoke('demo_content', { body: { action: 'seed' } })
  check('non-admin cannot seed', !!denied.error, 'expected 403')

  // --- admin seeds ---
  const seed = await adminC.functions.invoke('demo_content', { body: { action: 'seed' } })
  check('admin seed succeeds', !seed.error, seed.error?.message || JSON.stringify(seed.data))
  check('seeded 6 demo pros', seed.data?.seeded?.pros === 6, JSON.stringify(seed.data))
  check('demo pros exist (service view)', (await demoProCount(admin)) === 6)
  // content populated
  check('demo award cycle created', ((await admin.from('award_cycles').select('id').eq('is_demo', true)).data || []).length === 1)
  check('demo competition created', ((await admin.from('competitions').select('id').eq('is_demo', true)).data || []).length === 1)
  check('demo products created', ((await admin.from('products').select('id').eq('is_demo', true)).data || []).length === 4)
  const { data: oneProMedia } = await admin.from('pros').select('avatar_url,cover_url,gallery_urls').eq('handle', 'dre.carter').single()
  check('pros carry media (avatar/cover/gallery)', !!oneProMedia.avatar_url && !!oneProMedia.cover_url && oneProMedia.gallery_urls.length >= 2)

  // --- toggle gating: anon should NOT see demo pros until demo_pros_on ---
  check('public hides demo pros when toggle OFF', (await demoProCount(anon)) === 0, `saw ${await demoProCount(anon)}`)
  await setFlag('demo_pros_on', true)
  check('public sees demo pros when toggle ON', (await demoProCount(anon)) === 6, `saw ${await demoProCount(anon)}`)
  await setFlag('demo_pros_on', false)
  check('toggle OFF hides them again', (await demoProCount(anon)) === 0)

  // --- clear removes everything ---
  const cleared = await adminC.functions.invoke('demo_content', { body: { action: 'clear' } })
  check('clear succeeds', !cleared.error, cleared.error?.message || '')
  check('no demo pros after clear', (await demoProCount(admin)) === 0)
  check('demo auth users removed', !(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.some((u) => u.email?.endsWith('@styleprofiles.demo')))

  // cleanup admin
  await admin.auth.admin.deleteUser(au.user.id)

  const pass = results.filter((r) => r.pass).length
  console.log('\nDEMO CONTENT TEST\n=================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-----------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => { console.error('\nTest error:', e.message); process.exit(2) })
