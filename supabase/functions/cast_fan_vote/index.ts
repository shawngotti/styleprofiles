// Batch 11 P2 — The Lineup fan-vote integrity function (§4.7).
// CRITICAL product promise: fan votes NEVER decide bracket outcomes. They only
// drive the Redemption Wildcard and Fan Favorite, structurally — a fan vote
// targets a contestant/entry within a voting_window of a vote_type; matchup
// winners are set only by judges/admin. Gates here: lineup_on, verified account,
// window open, one vote per window (+ DB unique backstop), metro weighting, and
// a light per-window device-fingerprint rate check.

import { cors, json, serviceClient, getUser, featureEnabled } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)
  if (!user.email_confirmed_at) return json({ error: 'verify your account to vote' }, 403)

  const svc = serviceClient()
  if (!(await featureEnabled(svc, 'lineup_on'))) return json({ error: 'The Lineup is not live yet' }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const windowId = body.voting_window_id as string | undefined
  const targetContestantId = (body.target_contestant_id as string) || null
  const targetEntryId = (body.target_entry_id as string) || null
  const metro = (body.metro as string) || null
  if (!windowId) return json({ error: 'voting_window_id is required' }, 400)
  if (!targetContestantId && !targetEntryId) return json({ error: 'pick something to vote for' }, 400)

  // Window must be open right now. (vote_type is redemption | fan_favorite |
  // cut_of_week — all fan-only outcomes; none feed the judged bracket.)
  const { data: win } = await svc
    .from('voting_windows')
    .select('id,competition_id,vote_type,status,opens_at,closes_at')
    .eq('id', windowId)
    .maybeSingle()
  if (!win || win.status !== 'open') return json({ error: 'voting is not open' }, 400)
  const now = Date.now()
  if (now < Date.parse(win.opens_at) || now > Date.parse(win.closes_at)) {
    return json({ error: 'the voting window is closed' }, 400)
  }

  // If targeting a contestant, it must belong to this competition.
  if (targetContestantId) {
    const { data: c } = await svc
      .from('contestants')
      .select('id')
      .eq('id', targetContestantId)
      .eq('competition_id', win.competition_id)
      .maybeSingle()
    if (!c) return json({ error: 'that contestant is not in this competition' }, 400)
  }

  // One vote per window (clean check; unique constraint is the backstop).
  const { data: existing } = await svc
    .from('fan_votes')
    .select('id')
    .eq('voting_window_id', windowId)
    .eq('voter_user_id', user.id)
    .maybeSingle()
  if (existing) return json({ error: 'you already voted in this window' }, 409)

  // Metro weighting: an in-metro vote counts slightly more for city rounds.
  const weight = metro && metro === (body.home_metro as string) ? 1.5 : 1

  const { error } = await svc.from('fan_votes').insert({
    voting_window_id: windowId,
    voter_user_id: user.id,
    target_contestant_id: targetContestantId,
    target_entry_id: targetEntryId,
    metro,
    weight,
  })
  if (error) {
    if (error.code === '23505') return json({ error: 'you already voted in this window' }, 409)
    return json({ error: error.message }, 400)
  }

  return json({ ok: true }, 201)
})
