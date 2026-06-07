// Batch 11 P4 — submit_cotw_entry.
// A pro enters the current Cut of the Week: uploads before/after media to the
// lineup-reveals bucket (browser, RLS-gated to their folder), then calls this.
// We verify ownership + the open week, make the pro a contestant in the CotW
// competition (open_call), and upsert their entry for this week's brief. An
// untagged look publishes immediately; tagging the client in the chair opens a
// consent request and the entry waits until it's granted (§4.8). Gated lineup_on.

import { cors, json, serviceClient, getUser, featureEnabled } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  if (!(await featureEnabled(svc, 'lineup_on'))) return json({ error: 'The Lineup is not live yet' }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const proId = body.pro_id as string | undefined
  const beforeMedia = (body.before_media as string) || null
  const afterMedia = (body.after_media as string) || null
  const tag = (body.tag as string) || 'none' // none | public | anonymous
  const subjectEmail = ((body.subject_email as string) || '').trim().toLowerCase()
  if (!proId) return json({ error: 'pro_id is required' }, 400)
  if (!afterMedia) return json({ error: 'an "after" photo is required' }, 400)
  if (!['none', 'public', 'anonymous'].includes(tag)) return json({ error: 'invalid tag option' }, 400)

  // Ownership.
  const { data: pro } = await svc.from('pros').select('id,profile_id').eq('id', proId).maybeSingle()
  if (!pro || pro.profile_id !== user.id) return json({ error: 'not your storefront' }, 403)

  // Media must live under this pro's folder and exist.
  for (const path of [beforeMedia, afterMedia]) {
    if (!path) continue
    if (!path.startsWith(`${proId}/`)) return json({ error: 'media must be under your folder' }, 400)
    const { error: signErr } = await svc.storage.from('lineup-reveals').createSignedUrl(path, 60)
    if (signErr) return json({ error: 'uploaded media not found' }, 400)
  }

  // The current open Cut of the Week.
  const { data: wc } = await svc
    .from('weekly_challenges')
    .select('id,brief_id,status,closes_at')
    .eq('status', 'open')
    .gt('closes_at', new Date().toISOString())
    .order('opens_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!wc) return json({ error: 'no Cut of the Week is open right now' }, 400)

  // Ensure the pro is a contestant in the CotW competition (open call).
  const { data: comp } = await svc.from('briefs').select('competition_id').eq('id', wc.brief_id).maybeSingle()
  const compId = comp?.competition_id
  if (!compId) return json({ error: 'challenge is misconfigured' }, 400)
  let { data: contestant } = await svc
    .from('contestants')
    .select('id')
    .eq('competition_id', compId)
    .eq('pro_id', proId)
    .maybeSingle()
  if (!contestant) {
    const ins = await svc
      .from('contestants')
      .insert({ competition_id: compId, pro_id: proId, qualification_source: 'open_call', status: 'active' })
      .select('id')
      .single()
    if (ins.error) return json({ error: ins.error.message }, 400)
    contestant = ins.data
  }

  // Tagged look -> consent request; entry waits. Untagged -> publish now.
  let consentId: string | null = null
  let status = 'approved'
  let clientId: string | null = null
  if (tag !== 'none') {
    if (!subjectEmail) return json({ error: 'tagging a client needs their email' }, 400)
    const { data: subject } = await svc.from('profiles').select('id').eq('email', subjectEmail).maybeSingle()
    if (!subject) return json({ error: 'no account found for that client email' }, 400)
    clientId = subject.id
    const { data: consent, error: cErr } = await svc
      .from('consent_requests')
      .insert({ pro_id: proId, subject_profile_id: subject.id, look_label: 'Cut of the Week', for_contest: true, status: 'pending' })
      .select('id')
      .single()
    if (cErr) return json({ error: cErr.message }, 400)
    consentId = consent.id
    status = 'submitted'
  }

  // One entry per contestant per brief (partial unique index backstops races).
  // Manual upsert — the index is partial, so ON CONFLICT can't infer it.
  const row = {
    contestant_id: contestant.id,
    brief_id: wc.brief_id,
    client_id: clientId,
    consent_id: consentId,
    before_media: beforeMedia,
    after_media: afterMedia,
    status,
  }
  const { data: prior } = await svc
    .from('entries')
    .select('id')
    .eq('contestant_id', contestant.id)
    .eq('brief_id', wc.brief_id)
    .maybeSingle()
  const writer = prior
    ? svc.from('entries').update(row).eq('id', prior.id)
    : svc.from('entries').insert(row)
  const { data: entry, error: eErr } = await writer.select('id,status').single()
  if (eErr) return json({ error: eErr.message }, 400)

  return json({ ok: true, entry_id: entry.id, status: entry.status, consent_pending: status === 'submitted' }, 201)
})
