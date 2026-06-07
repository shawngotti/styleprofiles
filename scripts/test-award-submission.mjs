// Batch 9 — Awards submission flow (media + Storage + consent gate).
// Verifies: untagged entry publishes immediately; tagged entry stays pending and
// opens a consent request; a pro cannot self-approve from the browser (guard
// trigger); resolving consent auto-publishes; storage RLS blocks cross-pro
// uploads. Run: node --env-file=.env scripts/test-award-submission.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Submit-Pass1!'
const PRO = 'sub-pro@example.com'
const PRO2 = 'sub-pro2@example.com'
const CLIENT = 'sub-client@example.com'
const ALL = [PRO, PRO2, CLIENT]
const PERIOD = '2024-04-01'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

async function mkUser(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  return data.user.id
}
async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  await c.auth.signInWithPassword({ email, password: PW })
  return c
}

async function cleanup(proIds) {
  const { data: c } = await admin.from('award_cycles').select('id').eq('period', PERIOD).maybeSingle()
  if (c) {
    await admin.from('award_winners').delete().eq('cycle_id', c.id)
    await admin.from('award_cycles').delete().eq('id', c.id) // subs/votes cascade
  }
  for (const pid of proIds || []) {
    await admin.storage.from('award-media').remove([`${pid}/look.png`]).catch(() => {})
    await admin.from('consent_requests').delete().eq('pro_id', pid)
  }
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

// 1x1 transparent PNG.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (ch) => ch.charCodeAt(0))

async function main() {
  await cleanup([])

  const proId0 = await mkUser(PRO)
  const pro2Id0 = await mkUser(PRO2)
  const clientId = await mkUser(CLIENT)
  const { data: pro } = await admin.from('pros').insert({ profile_id: proId0, handle: 'sub_pro', display_name: 'Sub Pro', category: 'barber' }).select('id').single()
  const { data: pro2 } = await admin.from('pros').insert({ profile_id: pro2Id0, handle: 'sub_pro2', display_name: 'Sub Pro2', category: 'barber' }).select('id').single()

  const now = Date.now()
  const { data: cycle } = await admin.from('award_cycles').insert({
    period: PERIOD, status: 'submissions',
    opens_at: new Date(now - 86400000).toISOString(),
    closes_at: new Date(now + 7 * 86400000).toISOString(),
  }).select('id').single()

  // Pro uploads their look (service client stands in for the browser upload).
  const mediaPath = `${pro.id}/look.png`
  const up = await admin.storage.from('award-media').upload(mediaPath, PNG, { contentType: 'image/png', upsert: true })
  check('media uploaded to award-media', !up.error, up.error?.message || '')

  // --- Untagged entry: publishes immediately ---
  const proC = await signIn(PRO)
  const r1 = await proC.functions.invoke('submit_award_entry', { body: { pro_id: pro.id, media_path: mediaPath, look_label: 'Fade', tag: 'none' } })
  check('untagged submit succeeds', !r1.error, r1.error?.message || '')
  check('untagged entry is approved', r1.data?.status === 'approved', JSON.stringify(r1.data))
  const subId = r1.data?.submission_id

  // --- Missing media path is rejected ---
  const rBad = await proC.functions.invoke('submit_award_entry', { body: { pro_id: pro.id, media_path: `${pro.id}/nope.png`, tag: 'none' } })
  check('missing media is rejected', !!rBad.error, 'expected error')

  // --- Tagged entry: opens consent, entry goes pending ---
  const r2 = await proC.functions.invoke('submit_award_entry', { body: { pro_id: pro.id, media_path: mediaPath, look_label: 'Fade', tag: 'public', subject_email: CLIENT } })
  check('tagged submit returns pending', r2.data?.status === 'pending', JSON.stringify(r2.data || r2.error?.message))
  const { data: consent } = await admin.from('consent_requests').select('id,status,for_contest').eq('pro_id', pro.id).maybeSingle()
  check('consent request opened (for_contest)', consent?.for_contest === true && consent?.status === 'pending')
  const { data: subAfterTag } = await admin.from('award_submissions').select('status,consent_id').eq('id', subId).single()
  check('entry is pending with consent linked', subAfterTag.status === 'pending' && subAfterTag.consent_id === consent.id)

  // --- Guard: pro cannot self-approve from the browser ---
  const rGuard = await proC.from('award_submissions').update({ status: 'approved' }).eq('id', subId)
  check('pro cannot self-approve (guard trigger)', !!rGuard.error, rGuard.error?.message || 'no error!')

  // --- Consent resolution auto-publishes ---
  const clientC = await signIn(CLIENT)
  const rResolve = await clientC.from('consent_requests').update({ status: 'public', resolved_at: new Date().toISOString() }).eq('id', consent.id)
  check('client resolves consent (public)', !rResolve.error, rResolve.error?.message || '')
  const { data: subResolved } = await admin.from('award_submissions').select('status').eq('id', subId).single()
  check('entry auto-approved after consent granted', subResolved.status === 'approved', subResolved.status)

  // --- Storage RLS: a different pro cannot write into this pro's folder ---
  const pro2C = await signIn(PRO2)
  const rCross = await pro2C.storage.from('award-media').upload(`${pro.id}/evil.png`, PNG, { contentType: 'image/png' })
  check('cross-pro upload blocked by storage RLS', !!rCross.error, rCross.error?.message || 'no error!')

  await admin.storage.from('award-media').remove([`${pro.id}/evil.png`]).catch(() => {})
  await cleanup([pro.id, pro2.id])

  const pass = results.filter((r) => r.pass).length
  console.log('\nAWARD SUBMISSION TEST\n=====================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('---------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
