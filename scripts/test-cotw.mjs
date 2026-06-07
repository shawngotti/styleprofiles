// Batch 11 P4 — Cut of the Week (weekly challenge + entries + consent + fan vote
// leaderboard + scheduler). Verifies: ensure/advance scheduling; untagged entry
// publishes, tagged entry waits on consent then auto-publishes; one entry per
// week; entry publish guard; fan vote one-per-window feeding the leaderboard.
// Run: node --env-file=.env scripts/test-cotw.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Cotw-Pass1!'
const ADMIN = 'cotw-admin@example.com'
const FAN = 'cotw-fan@example.com'
const PRO1 = 'cotw-pro1@example.com'
const PRO2 = 'cotw-pro2@example.com'
const CLIENT = 'cotw-client@example.com'
const ALL = [ADMIN, FAN, PRO1, PRO2, CLIENT]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

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
async function cleanupCotw() {
  const { data: comp } = await admin.from('competitions').select('id').eq('name', 'Cut of the Week').maybeSingle()
  if (comp) {
    const { data: briefs } = await admin.from('briefs').select('id').eq('competition_id', comp.id)
    const briefIds = (briefs || []).map((b) => b.id)
    if (briefIds.length) await admin.from('weekly_challenges').delete().in('brief_id', briefIds)
    await admin.from('competitions').delete().eq('id', comp.id) // briefs/contestants/entries/windows/fan_votes cascade
  }
}
async function cleanup(proIds) {
  await cleanupCotw()
  for (const pid of proIds || []) {
    await admin.storage.from('lineup-reveals').remove([`${pid}/before.png`, `${pid}/after.png`]).catch(() => {})
    await admin.from('consent_requests').delete().eq('pro_id', pid)
  }
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup([])
  await setFlag(true)

  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const fanId = await mkUser(FAN)
  const clientId = await mkUser(CLIENT)
  const pro1Uid = await mkUser(PRO1)
  const pro2Uid = await mkUser(PRO2)
  const { data: pro1 } = await admin.from('pros').insert({ profile_id: pro1Uid, handle: 'cotw_pro1', display_name: 'Cotw Pro1', category: 'barber' }).select('id').single()
  const { data: pro2 } = await admin.from('pros').insert({ profile_id: pro2Uid, handle: 'cotw_pro2', display_name: 'Cotw Pro2', category: 'barber' }).select('id').single()

  // --- Scheduler: open a week ---
  const { data: wcId } = await admin.rpc('ensure_upcoming_weekly_challenge')
  check('ensure_upcoming opens a weekly challenge', !!wcId, String(wcId))
  const { data: wc } = await admin.from('weekly_challenges').select('id,brief_id,status,voting_window_id,closes_at').eq('id', wcId).single()
  check('challenge is open with a linked voting window', wc.status === 'open' && !!wc.voting_window_id)
  const { data: vw } = await admin.from('voting_windows').select('status,vote_type').eq('id', wc.voting_window_id).single()
  check('voting window is open + cut_of_week', vw.status === 'open' && vw.vote_type === 'cut_of_week')

  // Upload media for both pros.
  for (const pid of [pro1.id, pro2.id]) {
    await admin.storage.from('lineup-reveals').upload(`${pid}/before.png`, PNG, { contentType: 'image/png', upsert: true })
    await admin.storage.from('lineup-reveals').upload(`${pid}/after.png`, PNG, { contentType: 'image/png', upsert: true })
  }

  // --- Pro1: untagged entry publishes immediately ---
  const p1 = await signIn(PRO1)
  const r1 = await p1.functions.invoke('submit_cotw_entry', { body: { pro_id: pro1.id, before_media: `${pro1.id}/before.png`, after_media: `${pro1.id}/after.png`, tag: 'none' } })
  check('untagged CotW entry approved', r1.data?.status === 'approved', JSON.stringify(r1.data || r1.error?.message))
  const entry1 = r1.data?.entry_id

  // --- Pro1 re-submits: still one entry for the week ---
  await p1.functions.invoke('submit_cotw_entry', { body: { pro_id: pro1.id, after_media: `${pro1.id}/after.png`, tag: 'none' } })
  const { data: comp } = await admin.from('briefs').select('competition_id').eq('id', wc.brief_id).single()
  const { data: c1 } = await admin.from('contestants').select('id').eq('competition_id', comp.competition_id).eq('pro_id', pro1.id).single()
  const { data: e1count } = await admin.from('entries').select('id').eq('contestant_id', c1.id).eq('brief_id', wc.brief_id)
  check('one entry per pro per week (re-submit replaces)', e1count.length === 1, `count ${e1count.length}`)

  // --- Pro2: tagged entry waits on consent ---
  const p2 = await signIn(PRO2)
  const r2 = await p2.functions.invoke('submit_cotw_entry', { body: { pro_id: pro2.id, before_media: `${pro2.id}/before.png`, after_media: `${pro2.id}/after.png`, tag: 'public', subject_email: CLIENT } })
  check('tagged CotW entry is submitted (pending)', r2.data?.status === 'submitted', JSON.stringify(r2.data || r2.error?.message))
  const entry2 = r2.data?.entry_id
  const { data: consent } = await admin.from('consent_requests').select('id,for_contest').eq('pro_id', pro2.id).maybeSingle()
  check('consent request opened for tagged entry', consent?.for_contest === true)

  // --- Guard: pro2 cannot self-approve their entry ---
  const guard = await p2.from('entries').update({ status: 'approved' }).eq('id', entry2)
  check('pro cannot self-approve entry (guard)', !!guard.error, guard.error?.message || 'no error!')

  // --- Consent granted -> entry auto-approves ---
  const clientC = await signIn(CLIENT)
  await clientC.from('consent_requests').update({ status: 'public', resolved_at: new Date().toISOString() }).eq('id', consent.id)
  const { data: e2 } = await admin.from('entries').select('status').eq('id', entry2).single()
  check('entry auto-approved after consent granted', e2.status === 'approved', e2.status)

  // --- Fan vote: one per window, feeds the leaderboard ---
  const fan = await signIn(FAN)
  const v1 = await fan.functions.invoke('cast_fan_vote', { body: { voting_window_id: wc.voting_window_id, target_entry_id: entry1 } })
  check('fan vote for an entry accepted', !v1.error, v1.error?.message || '')
  const v2 = await fan.functions.invoke('cast_fan_vote', { body: { voting_window_id: wc.voting_window_id, target_entry_id: entry2 } })
  check('second vote in same window rejected', !!v2.error, 'expected 409')

  const { data: board } = await admin.rpc('cotw_leaderboard', { _challenge_id: wc.id })
  check('leaderboard lists approved entries', board.length === 2, `rows ${board.length}`)
  check('leaderboard ranks the voted entry first', board[0]?.entry_id === entry1 && Number(board[0]?.votes) === 1, JSON.stringify(board))

  // --- advance closes an expired week; ensure opens a fresh one ---
  await admin.from('weekly_challenges').update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq('id', wc.id)
  const { data: adv } = await admin.rpc('advance_weekly_challenges')
  check('advance closes the expired week', adv?.closed >= 1, JSON.stringify(adv))
  const { data: wcClosed } = await admin.from('weekly_challenges').select('status').eq('id', wc.id).single()
  check('challenge marked closed', wcClosed.status === 'closed')
  const { data: vwClosed } = await admin.from('voting_windows').select('status').eq('id', wc.voting_window_id).single()
  check('its voting window closed too', vwClosed.status === 'closed')
  const { data: nextWc } = await admin.rpc('ensure_upcoming_weekly_challenge')
  check('ensure opens a new week after close', nextWc && nextWc !== wc.id, `${nextWc}`)

  await setFlag(false)
  await cleanup([pro1.id, pro2.id])

  const pass = results.filter((r) => r.pass).length
  console.log('\nCUT OF THE WEEK TEST\n====================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('--------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
