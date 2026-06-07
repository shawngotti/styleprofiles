// Batch 11 — The Lineup engine (P0-P3).
// Covers: flag gate; seed-from-rankings ordering + first-round pairing; manual
// round-advance with elimination + next-round seeding + champion; judge rubric
// total computed server-side (technical 30/creative 25/reveal 20/client 15/
// composure 10) + score-based result; fan-vote integrity (open window, one per
// window, metro weight) feeding only redemption/fan-favorite.
// Run: node --env-file=.env scripts/test-lineup.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

const PW = 'Lineup-Pass1!'
const METRO = 'LineupTestMetro'
const ADMIN = 'lu-admin@example.com'
const FAN = 'lu-fan@example.com'
const J1 = 'lu-judge1@example.com'
const J2 = 'lu-judge2@example.com'
const PROS = [
  ['lu-pro1@example.com', 'lu_pro1', 4.9],
  ['lu-pro2@example.com', 'lu_pro2', 4.7],
  ['lu-pro3@example.com', 'lu_pro3', 4.5],
  ['lu-pro4@example.com', 'lu_pro4', 4.3],
]
const ALL = [ADMIN, FAN, J1, J2, ...PROS.map((p) => p[0])]

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
const total = (s) => 0.3 * s.technical + 0.25 * s.creative + 0.2 * s.reveal + 0.15 * s.client_experience + 0.1 * s.composure

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
  const { data: comp } = await admin.from('competitions').select('id').eq('metro', METRO).maybeSingle()
  if (comp) await admin.from('competitions').delete().eq('id', comp.id) // rounds/matchups/contestants/entries/windows cascade
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  await setFlag(false)

  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const fanId = await mkUser(FAN)
  const j1User = await mkUser(J1)
  const j2User = await mkUser(J2)
  for (const [email, handle, rating] of PROS) {
    const id = await mkUser(email)
    await admin.from('pros').insert({ profile_id: id, handle, display_name: handle, category: 'barber', city: METRO, rating_avg: rating, rating_count: 50 })
  }

  // Competition (admin-created).
  const { data: comp } = await admin.from('competitions').insert({ name: 'Test Lineup', scope: 'city', metro: METRO, status: 'qualifying' }).select('id').single()

  // --- Flag gate: non-admin cannot read the bracket when lineup_on=false ---
  const fan = await signIn(FAN)
  const { data: hidden } = await fan.from('competitions').select('id').eq('id', comp.id)
  check('bracket hidden when lineup_on=false', (hidden || []).length === 0, `saw ${hidden?.length}`)
  await setFlag(true)
  const { data: visible } = await fan.from('competitions').select('id').eq('id', comp.id)
  check('bracket visible when lineup_on=true', (visible || []).length === 1)

  // --- Non-admin cannot seed ---
  const seedDeny = await fan.rpc('seed_lineup', { _competition_id: comp.id, _n: 4 })
  check('non-admin cannot seed_lineup', !!seedDeny.error, seedDeny.error?.message || 'no error!')

  // --- P0: seed-from-rankings (4 pros by rating) + first round ---
  const adminC = await signIn(ADMIN)
  const { data: seeded } = await adminC.rpc('seed_lineup', { _competition_id: comp.id, _n: 4 })
  check('seed_lineup returns 4 contestants', seeded === 4, String(seeded))
  const { data: contestants } = await admin.from('contestants').select('id,pro_id,seed,status,pros(rating_avg)').eq('competition_id', comp.id).order('seed')
  check('seeds ordered by rating (seed1 = 4.9)', contestants[0].pros.rating_avg === 4.9 && contestants[3].pros.rating_avg === 4.3)
  const { data: rounds } = await admin.from('competition_rounds').select('id,name,round_order').eq('competition_id', comp.id).order('round_order')
  check('round 1 is Semifinal (4 contestants)', rounds[0]?.name === 'Semifinal')
  const { data: r1matchups } = await admin.from('matchups').select('id,contestant_a,contestant_b').eq('round_id', rounds[0].id)
  check('round 1 has 2 matchups', r1matchups.length === 2)
  const bySeed = Object.fromEntries(contestants.map((c) => [c.seed, c.id]))
  const m1 = r1matchups.find((m) => m.contestant_a === bySeed[1])
  const m2 = r1matchups.find((m) => m.contestant_a === bySeed[2])
  check('pairing is 1v4 and 2v3', m1?.contestant_b === bySeed[4] && m2?.contestant_b === bySeed[3])

  // --- P1: manual advance both matchups -> Final seeded, losers eliminated ---
  await adminC.rpc('advance_lineup_matchup', { _matchup_id: m1.id, _winner: bySeed[1] })
  const { data: adv2 } = await adminC.rpc('advance_lineup_matchup', { _matchup_id: m2.id, _winner: bySeed[2] })
  check('round complete after 2nd advance', adv2?.round_complete === true, JSON.stringify(adv2))
  const { data: finalRound } = await admin.from('competition_rounds').select('id,name').eq('competition_id', comp.id).eq('round_order', 2).single()
  check('Final round seeded', finalRound?.name === 'Final')
  const { data: finalMatchups } = await admin.from('matchups').select('id,contestant_a,contestant_b').eq('round_id', finalRound.id)
  check('Final pairs the two winners (1 v 2)', finalMatchups.length === 1 && finalMatchups[0].contestant_a === bySeed[1] && finalMatchups[0].contestant_b === bySeed[2])
  const { data: loser4 } = await admin.from('contestants').select('status').eq('id', bySeed[4]).single()
  check('eliminated contestant marked eliminated', loser4.status === 'eliminated')
  const finalM = finalMatchups[0]

  // --- P3: judge scoring rubric -> total computed server-side -> result ---
  // Entries for each finalist in the final matchup.
  const { data: eA } = await admin.from('entries').insert({ contestant_id: bySeed[1], matchup_id: finalM.id, status: 'approved' }).select('id').single()
  const { data: eB } = await admin.from('entries').insert({ contestant_id: bySeed[2], matchup_id: finalM.id, status: 'approved' }).select('id').single()
  const j1 = (await adminC.rpc('register_judge', { _user_id: j1User, _display_name: 'Judge One' })).data
  const j2 = (await adminC.rpc('register_judge', { _user_id: j2User, _display_name: 'Judge Two' })).data
  await admin.from('matchup_judges').insert([{ matchup_id: finalM.id, judge_id: j1 }, { matchup_id: finalM.id, judge_id: j2 }])
  // Contestant 1 scores higher across the board.
  const sA = { technical: 9, creative: 9, reveal: 8, client_experience: 8, composure: 9 }
  const sB = { technical: 7, creative: 6, reveal: 7, client_experience: 6, composure: 7 }
  await admin.from('scores').insert([
    { entry_id: eA.id, judge_id: j1, ...sA }, { entry_id: eA.id, judge_id: j2, ...sA },
    { entry_id: eB.id, judge_id: j1, ...sB }, { entry_id: eB.id, judge_id: j2, ...sB },
  ])
  const { data: scoreA } = await admin.from('scores').select('total').eq('entry_id', eA.id).eq('judge_id', j1).single()
  check('score total computed by weighted rubric', Math.abs(scoreA.total - total(sA)) < 1e-6, `got ${scoreA.total} want ${total(sA)}`)
  const { data: champWinner } = await adminC.rpc('compute_matchup_result', { _matchup_id: finalM.id })
  check('compute_matchup_result picks higher-scored contestant', champWinner === bySeed[1], champWinner)
  const { data: champ } = await admin.from('contestants').select('status').eq('id', bySeed[1]).single()
  check('winner crowned champion', champ.status === 'champion')
  const { data: compDone } = await admin.from('competitions').select('status').eq('id', comp.id).single()
  check('competition marked complete', compDone.status === 'complete')

  // --- P2: fan-vote integrity (redemption window) ---
  const nowMs = Date.now()
  const { data: openWin } = await admin.from('voting_windows').insert({
    competition_id: comp.id, vote_type: 'redemption', status: 'open',
    opens_at: new Date(nowMs - 3600e3).toISOString(), closes_at: new Date(nowMs + 3600e3).toISOString(),
  }).select('id').single()
  const { data: schedWin } = await admin.from('voting_windows').insert({
    competition_id: comp.id, vote_type: 'redemption', status: 'scheduled',
    opens_at: new Date(nowMs + 3600e3).toISOString(), closes_at: new Date(nowMs + 7200e3).toISOString(),
  }).select('id').single()

  const v1 = await fan.functions.invoke('cast_fan_vote', { body: { voting_window_id: openWin.id, target_contestant_id: bySeed[4] } })
  check('fan vote accepted in open window', !v1.error, v1.error?.message || '')
  const v2 = await fan.functions.invoke('cast_fan_vote', { body: { voting_window_id: openWin.id, target_contestant_id: bySeed[3] } })
  check('second vote in same window rejected', !!v2.error, 'expected 409')
  const v3 = await fan.functions.invoke('cast_fan_vote', { body: { voting_window_id: schedWin.id, target_contestant_id: bySeed[4] } })
  check('vote rejected for not-open window', !!v3.error, 'expected error')

  const { data: tally } = await adminC.rpc('tally_fan_votes', { _window_id: openWin.id })
  check('tally returns the voted contestant', tally?.[0]?.target_contestant_id === bySeed[4], JSON.stringify(tally))
  const { data: redeemed } = await adminC.rpc('apply_redemption', { _window_id: openWin.id })
  check('apply_redemption picks top contestant', redeemed === bySeed[4], redeemed)
  const { data: redContestant } = await admin.from('contestants').select('status').eq('id', bySeed[4]).single()
  check('redeemed contestant marked redeemed', redContestant.status === 'redeemed')

  await setFlag(false)
  await cleanup()

  const pass = results.filter((r) => r.pass).length
  console.log('\nTHE LINEUP TEST\n===============')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('---------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTest error:', e.message)
  process.exit(2)
})
