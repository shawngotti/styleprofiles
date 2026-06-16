// submit_review_reply — server-authoritative path for a pro replying to a
// review. Verifies the caller owns the pro, screens the reply text via OpenAI
// (+ spam heuristic), and upserts the reply. A flagged reply is rejected so the
// pro can revise; a screening outage fails OPEN for replies (low risk, pro is a
// known/verified author) but still blocks the local spam signal.
import { cors, json, serviceClient, getUser } from '../_shared/util.ts'
import { screenContent } from '../_shared/moderation.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const user = await getUser(req.headers.get('Authorization') || '')
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { review_id, body } = await req.json()
    const text = (body || '').trim()
    if (!review_id || !text) return json({ error: 'A reply is required.' }, 400)
    if (text.length > 1000) return json({ error: 'Reply is too long.' }, 400)

    const svc = serviceClient()

    // Resolve the review's pro and confirm the caller owns it.
    const { data: review } = await svc
      .from('reviews')
      .select('id, pro_id, pros!inner(profile_id)')
      .eq('id', review_id)
      .maybeSingle()
    // deno-lint-ignore no-explicit-any
    const ownerId = (review as any)?.pros?.profile_id
    if (!review || ownerId !== user.id) return json({ error: 'Not authorized to reply to this review.' }, 403)

    // Screen the reply. Reject if flagged so the pro can revise.
    const { flagged, labels } = await screenContent(text)
    if (flagged) {
      return json({ error: `Your reply was held by auto-screening (${labels.join(', ')}). Please revise it.` }, 422)
    }

    const { error } = await svc
      .from('review_responses')
      .upsert({ review_id, pro_id: review.pro_id, body: text }, { onConflict: 'review_id' })
    if (error) return json({ error: error.message }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
