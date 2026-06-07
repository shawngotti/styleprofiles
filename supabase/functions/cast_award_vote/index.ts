// Batch 9 — Awards vote-integrity Edge Function (§4.7).
// Gates: verified account, voting window open, nominee approved, one vote per
// category per cycle (checked + DB-constraint backstop). Weight is 1; verified-
// client weighting is classified at result-computation time.

import { cors, json, serviceClient, getUser, clientMeta } from '../_shared/util.ts'

const EDGE_DEVICE_LIMIT = 8 // votes per device per minute before we flag + reject

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)
  if (!user.email_confirmed_at) return json({ error: 'verify your account to vote' }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const submissionId = body.submission_id
  if (!submissionId) return json({ error: 'submission_id is required' }, 400)

  const svc = serviceClient()
  const { data: sub } = await svc
    .from('award_submissions')
    .select('id,cycle_id,category,status,award_cycles(status,opens_at,closes_at)')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub || sub.status !== 'approved') return json({ error: 'nominee not available' }, 400)

  const cyc = sub.award_cycles
  if (!cyc || cyc.status !== 'voting') return json({ error: 'voting is not open for this category' }, 400)
  const now = Date.now()
  if (now < Date.parse(cyc.opens_at) || now > Date.parse(cyc.closes_at)) {
    return json({ error: 'the voting window is closed' }, 400)
  }

  // One vote per category per cycle (clean check; unique constraint is the backstop).
  const { data: existing } = await svc
    .from('award_votes')
    .select('id')
    .eq('cycle_id', sub.cycle_id)
    .eq('category', sub.category)
    .eq('voter_profile_id', user.id)
    .maybeSingle()
  if (existing) return json({ error: 'you already voted in this category' }, 409)

  // Per-device edge rate limit (§4.7). Only applies when a fingerprint is sent.
  const { ip, fingerprint } = clientMeta(req)
  if (fingerprint) {
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count } = await svc
      .from('award_votes')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint', fingerprint)
      .gte('created_at', since)
    if ((count ?? 0) >= EDGE_DEVICE_LIMIT) {
      await svc.from('vote_flags').insert({
        context: 'awards',
        note: `device ${fingerprint.slice(0, 16)} exceeded vote rate (${count} in 60s)`,
        vote_count: count,
        status: 'open',
      })
      return json({ error: 'too many votes from this device — try again shortly' }, 429)
    }
  }

  const { error } = await svc.from('award_votes').insert({
    cycle_id: sub.cycle_id,
    category: sub.category,
    submission_id: sub.id,
    voter_profile_id: user.id,
    weight: 1,
    ip,
    fingerprint,
  })
  if (error) {
    if (error.code === '23505') return json({ error: 'you already voted in this category' }, 409)
    return json({ error: error.message }, 400)
  }

  return json({ ok: true }, 201)
})
