// Confirms the OPENAI_API_KEY is wired: in AUTO mode a clean review auto-
// publishes (screened & passed), while inappropriate text is auto-flagged.
// Run: node --env-file=.env scripts/verify-openai.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const PW = 'Verify-1!'
const PRO = 'vo-pro@example.com'
const C = 'vo-c@example.com'

async function reset() {
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([PRO, C].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}
async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  await c.auth.signInWithPassword({ email, password: PW })
  return c
}

async function main() {
  await reset()
  const prev = (await admin.from('platform_settings').select('value').eq('key', 'review_moderation_mode').maybeSingle()).data?.value || 'auto'
  await admin.from('platform_settings').update({ value: 'auto' }).eq('key', 'review_moderation_mode')

  const { data: pu } = await admin.auth.admin.createUser({ email: PRO, password: PW, email_confirm: true })
  const { data: cu } = await admin.auth.admin.createUser({ email: C, password: PW, email_confirm: true })
  const { data: pro } = await admin.from('pros').insert({ profile_id: pu.user.id, handle: 'vo_pro', display_name: 'VO Pro', category: 'barber' }).select('id').single()
  const mk = async (d) => (await admin.from('bookings').insert({ client_profile_id: cu.user.id, pro_id: pro.id, service_date: d, status: 'completed' }).select('id').single()).data
  const b1 = await mk('2026-03-01')
  const b2 = await mk('2026-03-02')
  const cli = await signIn(C)

  const clean = await cli.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: b1.id, rating: 5, body: 'Fantastic haircut, super friendly and on time.' } })
  const nasty = await cli.functions.invoke('submit_review', { body: { pro_id: pro.id, booking_id: b2.id, rating: 1, body: 'I am going to find you and kill you, you worthless piece of garbage.' } })

  console.log('\nOPENAI SCREENING VERIFY (auto mode)\n===================================')
  console.log(`clean review  -> status: ${clean.data?.status}   ${clean.data?.status === 'approved' ? 'PASS (auto-published)' : 'CHECK — key may not be set'}`)
  console.log(`abusive review-> status: ${nasty.data?.status}   ${nasty.data?.status === 'flagged' ? 'PASS (held)' : 'CHECK'}`)

  await admin.from('platform_settings').update({ value: prev }).eq('key', 'review_moderation_mode')
  await reset()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
