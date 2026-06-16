// submit_review — the single server-authoritative path for posting a review.
//
// Flow: verify the caller is reviewing their OWN completed booking → screen the
// text + photos with OpenAI omni-moderation (plus a light spam heuristic) →
// set status by the platform mode (auto publishes clean reviews; manual queues
// everything) → insert with the service role. A screening outage fails SAFE to
// the manual queue, never auto-publishes unscreened content.
import { cors, json, serviceClient, getUser } from '../_shared/util.ts'
import { screenContent } from '../_shared/moderation.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const user = await getUser(req.headers.get('Authorization') || '')
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { pro_id, booking_id, rating, body, tags, photo_urls } = await req.json()
    if (!pro_id || !Number.isInteger(rating) || rating < 1 || rating > 5)
      return json({ error: 'Invalid review.' }, 400)
    if (!booking_id) return json({ error: 'A completed booking is required to review.' }, 403)

    const svc = serviceClient()

    // Must be the caller's own completed booking with this pro (verified reviews).
    const { data: bk } = await svc
      .from('bookings')
      .select('id,pro_id,client_profile_id,status')
      .eq('id', booking_id)
      .maybeSingle()
    if (!bk || bk.client_profile_id !== user.id || bk.pro_id !== pro_id || bk.status !== 'completed')
      return json({ error: 'You can only review a completed visit.' }, 403)

    // One review per booking.
    const { data: existing } = await svc
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .eq('author_profile_id', user.id)
      .maybeSingle()
    if (existing) return json({ error: 'You already reviewed this visit.' }, 409)

    // Photos must live in the caller's own review-media folder (defense in depth).
    const photos: string[] = Array.isArray(photo_urls)
      ? photo_urls.filter((u: unknown) => typeof u === 'string').slice(0, 6)
      : []
    if (!photos.every((u) => u.includes(`/review-media/${user.id}/`)))
      return json({ error: 'Invalid photo upload.' }, 400)

    const cleanBody = (body || '').trim() || null
    const { flagged, labels, screenError } = await screenContent(cleanBody, photos)

    // Mode → status. flagged → held; screening outage → manual queue (fail safe).
    const { data: modeRow } = await svc
      .from('platform_settings')
      .select('value')
      .eq('key', 'review_moderation_mode')
      .maybeSingle()
    const mode = modeRow?.value === 'manual' ? 'manual' : 'auto'
    const status = flagged ? 'flagged' : screenError ? 'pending' : mode === 'manual' ? 'pending' : 'approved'

    const { data: review, error: insErr } = await svc
      .from('reviews')
      .insert({
        pro_id,
        author_profile_id: user.id,
        booking_id,
        rating,
        body: cleanBody,
        tags: Array.isArray(tags) ? tags.slice(0, 8) : [],
        photo_urls: photos,
        status,
        flagged_labels: labels,
        moderation_reason: flagged
          ? `Auto-flagged: ${labels.join(', ')}`
          : screenError
            ? 'Awaiting moderation (auto-screening unavailable)'
            : null,
        moderated_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .select('id,status')
      .single()
    if (insErr) return json({ error: insErr.message }, 400)

    return json({
      ok: true,
      status,
      review_id: review.id,
      message:
        status === 'approved'
          ? 'Review posted — thank you!'
          : status === 'flagged'
            ? 'Thanks! Your review is under review before it goes live.'
            : 'Thanks! Your review will appear once it’s approved.',
    })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
