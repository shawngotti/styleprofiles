// Batch 9 — Awards vote-integrity Edge Function (§4.7).
// Gates: verified account, voting window open, nominee approved, one vote per
// category per cycle (checked + DB-constraint backstop). Weight is 1; verified-
// client weighting is classified at result-computation time.

import { cors, json, serviceClient, getUser } from '../_shared/util.ts'

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

  const { error } = await svc.from('award_votes').insert({
    cycle_id: sub.cycle_id,
    category: sub.category,
    submission_id: sub.id,
    voter_profile_id: user.id,
    weight: 1,
  })
  if (error) {
    if (error.code === '23505') return json({ error: 'you already voted in this category' }, 409)
    return json({ error: error.message }, 400)
  }

  return json({ ok: true }, 201)
})
