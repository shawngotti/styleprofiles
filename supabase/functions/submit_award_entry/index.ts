// Batch 9 — submit_award_entry.
// Server-authoritative Awards submission. A pro uploads media to the award-media
// bucket (browser, RLS-gated to their own folder), then calls this with the
// path. We resolve the open cycle, verify ownership + that the media exists,
// optionally open a consent request for a tagged client, and upsert the entry
// (one per pro per category per cycle). Untagged looks publish immediately;
// tagged looks stay 'pending' until the client resolves consent (§4.8 gate,
// enforced by the award_consent_resolved trigger).

import { cors, json, serviceClient, getUser } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* ignore */ }
  const proId = body.pro_id as string | undefined
  const mediaPath = body.media_path as string | undefined
  const lookLabel = ((body.look_label as string) || '').trim() || 'Signature look'
  const tag = (body.tag as string) || 'none' // 'none' | 'public' | 'anonymous'
  const subjectEmail = ((body.subject_email as string) || '').trim().toLowerCase()
  if (!proId) return json({ error: 'pro_id is required' }, 400)
  if (!mediaPath) return json({ error: 'media_path is required' }, 400)
  if (!['none', 'public', 'anonymous'].includes(tag)) return json({ error: 'invalid tag option' }, 400)

  const svc = serviceClient()

  // Ownership + category.
  const { data: pro } = await svc
    .from('pros')
    .select('id,profile_id,category')
    .eq('id', proId)
    .maybeSingle()
  if (!pro || pro.profile_id !== user.id) return json({ error: 'not your storefront' }, 403)
  if (!pro.category) return json({ error: 'set your storefront category before entering' }, 400)

  // Open cycle: accepting entries while submissions or voting is live and the
  // voting window has not closed.
  const nowIso = new Date().toISOString()
  const { data: cycle } = await svc
    .from('award_cycles')
    .select('id,period,status,closes_at')
    .in('status', ['submissions', 'voting'])
    .gt('closes_at', nowIso)
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cycle) return json({ error: 'awards submissions are not open right now' }, 400)

  // Media must live under this pro's folder and actually exist.
  if (!mediaPath.startsWith(`${proId}/`)) return json({ error: 'media_path must be under your folder' }, 400)
  const { error: signErr } = await svc.storage.from('award-media').createSignedUrl(mediaPath, 60)
  if (signErr) return json({ error: 'uploaded media not found' }, 400)

  // Tagged look -> open a consent request; the entry stays pending until the
  // client resolves it. Untagged -> publish now.
  let consentId: string | null = null
  let status = 'approved'
  if (tag !== 'none') {
    if (!subjectEmail) return json({ error: 'tagging a client needs their email' }, 400)
    const { data: subject } = await svc
      .from('profiles')
      .select('id')
      .eq('email', subjectEmail)
      .maybeSingle()
    if (!subject) return json({ error: 'no account found for that client email' }, 400)
    const { data: consent, error: cErr } = await svc
      .from('consent_requests')
      .insert({
        pro_id: proId,
        subject_profile_id: subject.id,
        look_label: lookLabel,
        for_contest: true,
        status: 'pending',
      })
      .select('id')
      .single()
    if (cErr) return json({ error: cErr.message }, 400)
    consentId = consent.id
    status = 'pending'
  }

  // One entry per pro per category per cycle — upsert replaces a prior draft.
  const { data: sub, error: sErr } = await svc
    .from('award_submissions')
    .upsert(
      {
        cycle_id: cycle.id,
        category: pro.category,
        pro_id: proId,
        look_label: lookLabel,
        media_path: mediaPath,
        status,
        consent_id: consentId,
        flag_reason: null,
      },
      { onConflict: 'cycle_id,category,pro_id' },
    )
    .select('id,status')
    .single()
  if (sErr) return json({ error: sErr.message }, 400)

  return json({ ok: true, submission_id: sub.id, status: sub.status, consent_pending: status === 'pending' }, 201)
})
