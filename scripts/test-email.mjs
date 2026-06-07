// Transactional email (Resend) — outbox enqueue + opt-out + RLS + processor.
// Verifies: email-worthy notifications enqueue an outbox row; off-list kinds and
// opted-out users don't; the outbox is admin-only; the processor fails safe when
// RESEND_API_KEY isn't configured. Run: node --env-file=.env scripts/test-email.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Email-Pass1!'
const USER = 'email-user@example.com'
const OPTOUT = 'email-optout@example.com'
const ADMIN = 'email-admin@example.com'
const ALL = [USER, OPTOUT, ADMIN]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
async function mkUser(email) { const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true }); return data.user.id }
async function signIn(email) { const c = createClient(URL, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: PW }); return c }
const outboxFor = async (email) => (await admin.from('email_outbox').select('id,subject,kind,status').eq('to_email', email)).data || []
async function cleanup() {
  for (const e of ALL) await admin.from('email_outbox').delete().eq('to_email', e)
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users) if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  const userId = await mkUser(USER)
  const optoutId = await mkUser(OPTOUT)
  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })

  // --- Email-worthy kind enqueues an outbox row ---
  await admin.from('notifications').insert({ recipient_profile_id: userId, kind: 'booking', body: 'Your appointment is confirmed.' })
  let ob = await outboxFor(USER)
  check('booking notification enqueues an email', ob.length === 1 && ob[0].subject === 'Your StyleProfiles appointment', JSON.stringify(ob))
  check('outbox row starts pending', ob[0]?.status === 'pending')

  // --- Off-list kind does NOT enqueue ---
  await admin.from('notifications').insert({ recipient_profile_id: userId, kind: 'points', body: 'You earned 50 StylePoints.' })
  ob = await outboxFor(USER)
  check('non-transactional kind not emailed', ob.length === 1, `rows ${ob.length}`)

  // --- Opted-out user does NOT enqueue ---
  await admin.from('profiles').update({ email_notifications: false }).eq('id', optoutId)
  await admin.from('notifications').insert({ recipient_profile_id: optoutId, kind: 'chair', body: 'A flash deal near you.' })
  check('opted-out user gets no email', (await outboxFor(OPTOUT)).length === 0)

  // --- Outbox is admin-only ---
  const user = await signIn(USER)
  const { data: userSees } = await user.from('email_outbox').select('id').eq('to_email', USER)
  check('non-admin cannot read outbox', (userSees || []).length === 0, `saw ${userSees?.length}`)
  const adminC = await signIn(ADMIN)
  const { data: adminSees } = await adminC.from('email_outbox').select('id').eq('to_email', USER)
  check('admin can read outbox', (adminSees || []).length === 1)

  // --- Processor fails safe without a configured key ---
  const proc = await admin.functions.invoke('process_email_outbox', { body: {} })
  const status = proc.error ? (await proc.error.context.json().catch(() => ({}))) : proc.data
  const keyConfigured = !(proc.error && proc.error.context?.status === 503)
  if (keyConfigured) {
    // RESEND_API_KEY is set in this env — processor should have sent the pending row.
    const after = await outboxFor(USER)
    check('processor sent the queued email (key configured)', after[0]?.status === 'sent', JSON.stringify(after))
  } else {
    check('processor fails safe without RESEND_API_KEY (503)', true)
    check('queued email stays pending when unconfigured', (await outboxFor(USER))[0]?.status === 'pending')
  }

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nTRANSACTIONAL EMAIL TEST\n========================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('------------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => { console.error('\nTest error:', e.message); process.exit(2) })
