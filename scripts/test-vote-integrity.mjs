// Option A2 / §4.7 — vote-integrity hardening.
// Verifies: a shared device fingerprint trips the per-device edge limit (extra
// votes rejected + a vote_flag written); the admin anomaly scan flags an IP that
// cast an abnormal number of votes. Run: node --env-file=.env scripts/test-vote-integrity.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Integrity-Pass1!'
const ADMIN = 'vi-admin@example.com'
const PRO = 'vi-pro@example.com'
const FP = 'vi-shared-device'
const EDGE_LIMIT = 8 // must match the Edge Function constant
const VOTERS = Array.from({ length: EDGE_LIMIT + 1 }, (_, i) => `vi-v${i}@example.com`)
const ALL = [ADMIN, PRO, ...VOTERS]
const PERIOD = '2023-11-01'

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
async function cleanup() {
  const { data: cyc } = await admin.from('award_cycles').select('id').eq('period', PERIOD).maybeSingle()
  if (cyc) await admin.from('award_cycles').delete().eq('id', cyc.id) // votes/subs cascade
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  const flagsBefore = new Set(((await admin.from('vote_flags').select('id')).data || []).map((f) => f.id))

  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const proUid = await mkUser(PRO)
  const { data: pro } = await admin.from('pros').insert({ profile_id: proUid, handle: 'vi_pro', display_name: 'VI Pro', category: 'barber', rating_avg: 4.5 }).select('id').single()
  const voterIds = []
  for (const v of VOTERS) voterIds.push(await mkUser(v))

  const now = Date.now()
  const { data: cycle } = await admin.from('award_cycles').insert({
    period: PERIOD, status: 'voting',
    opens_at: new Date(now - 86400000).toISOString(), closes_at: new Date(now + 86400000).toISOString(),
  }).select('id').single()
  const { data: sub } = await admin.from('award_submissions').insert({ cycle_id: cycle.id, category: 'barber', pro_id: pro.id, look_label: 'Look', status: 'approved' }).select('id').single()

  // --- Edge per-device limit: all voters share one fingerprint ---
  let ok = 0
  let rejected = 0
  for (const email of VOTERS) {
    const c = await signIn(email)
    const r = await c.functions.invoke('cast_award_vote', {
      body: { submission_id: sub.id },
      headers: { 'x-device-fingerprint': FP },
    })
    if (r.error) rejected++
    else ok++
  }
  check(`first ${EDGE_LIMIT} device votes accepted`, ok === EDGE_LIMIT, `accepted ${ok}`)
  check('over-limit vote rejected', rejected === 1, `rejected ${rejected}`)
  const { data: deviceFlags } = await admin.from('vote_flags').select('id,note').eq('context', 'awards').like('note', `device ${FP.slice(0, 16)}%`)
  check('a vote_flag was written for the device', (deviceFlags || []).length >= 1, JSON.stringify(deviceFlags))

  // Votes captured IP + fingerprint.
  const { data: votes } = await admin.from('award_votes').select('ip,fingerprint').eq('cycle_id', cycle.id)
  check('votes captured the fingerprint', votes.every((v) => v.fingerprint === FP))
  const ips = [...new Set(votes.map((v) => v.ip).filter(Boolean))]
  check('votes captured a client IP', ips.length >= 1, JSON.stringify(ips))

  // --- Admin anomaly scan: the shared IP cast > threshold votes ---
  const adminC = await signIn(ADMIN)
  const { data: created, error: scanErr } = await adminC.rpc('scan_vote_anomalies', { _minutes: 60, _threshold: 3 })
  check('anomaly scan runs (admin)', !scanErr, scanErr?.message || '')
  check('anomaly scan flags the noisy IP', (created ?? 0) >= 1, `created ${created}`)
  // Non-admin cannot scan.
  const voterC = await signIn(VOTERS[0])
  const { error: denyErr } = await voterC.rpc('scan_vote_anomalies', { _minutes: 60, _threshold: 3 })
  check('non-admin cannot run scan', !!denyErr, denyErr?.message || 'no error!')

  // Cleanup new flags + everything.
  const { data: flagsAfter } = await admin.from('vote_flags').select('id')
  const newFlags = (flagsAfter || []).map((f) => f.id).filter((id) => !flagsBefore.has(id))
  if (newFlags.length) await admin.from('vote_flags').delete().in('id', newFlags)
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nVOTE INTEGRITY TEST\n===================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('-------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
