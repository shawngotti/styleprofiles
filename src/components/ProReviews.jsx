import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const GOLD = '#0FB9A6'

// Status pill styling for the pro's own view (clients only ever see 'approved').
const STATUS_BADGE = {
  approved: { label: 'Live', color: '#34D399' },
  pending: { label: 'Pending review', color: GOLD },
  flagged: { label: 'Flagged', color: '#FF6F6F' },
  removed: { label: 'Removed', color: '#9CA3AF' },
}

function Stars({ value = 0 }) {
  const full = Math.round(value)
  return (
    <span style={{ color: GOLD }} aria-label={`${value} stars`}>
      {'★'.repeat(full)}
      <span className="text-black/20">{'★'.repeat(5 - full)}</span>
    </span>
  )
}

function fmtDate(s) {
  return s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

// Pro reviews inbox. The pro sees every review on their profile (any status via
// RLS reviews_pro_read) and can reply once to each. Replies post directly
// through RLS (review_resp_owner_write); a trigger notifies the client.
export default function ProReviews({ proId, proName, onCount }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({}) // review_id -> reply text
  const [editing, setEditing] = useState({}) // review_id -> bool (reply box open)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,rating,body,tags,verified,created_at,status,photo_urls,moderation_reason,review_responses(body,created_at)')
      .eq('pro_id', proId)
      .order('created_at', { ascending: false })
    if (error) setErr(error.message)
    const rows = data || []
    setReviews(rows)
    setLoading(false)
    // Unreplied, live reviews = the "needs attention" count for the tab badge.
    onCount?.(rows.filter((r) => r.status === 'approved' && !r.review_responses?.length).length)
  }, [proId, onCount])

  useEffect(() => {
    load()
  }, [load])

  async function saveReply(reviewId) {
    const body = (drafts[reviewId] || '').trim()
    if (!body) return
    setBusyId(reviewId)
    setErr(null)
    // Replies post through submit_review_reply, which screens the text first.
    const { data, error } = await supabase.functions.invoke('submit_review_reply', {
      body: { review_id: reviewId, body },
    })
    setBusyId(null)
    if (error || !data?.ok) {
      let text = 'Could not post reply'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setErr(data?.error || text)
      return
    }
    setEditing((s) => ({ ...s, [reviewId]: false }))
    setDrafts((s) => ({ ...s, [reviewId]: '' }))
    load()
  }

  if (loading) return <p className="text-sm text-black/50">Loading reviews…</p>

  if (reviews.length === 0) {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 text-center">
        <div className="text-3xl">⭐️</div>
        <h3 className="mt-2 text-sm font-semibold">No reviews yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-black/55">
          After a completed appointment, clients are prompted to rate you and add photos. Replies you post here show
          on your public profile.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      {reviews.map((r) => {
        const badge = STATUS_BADGE[r.status] || STATUS_BADGE.approved
        const reply = r.review_responses?.[0]
        const open = editing[r.id]
        return (
          <section key={r.id} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                {r.verified && <span className="text-xs text-black/45">· Verified visit</span>}
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: badge.color }}
              >
                {badge.label}
              </span>
            </div>

            {r.body && <p className="mt-2 text-sm text-black/75">{r.body}</p>}

            {r.photo_urls?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.photo_urls.map((u, i) => (
                  <img key={i} src={u} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}

            {r.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-black/50">{t}</span>
                ))}
              </div>
            )}

            <div className="mt-2 text-xs text-black/40">{fmtDate(r.created_at)}</div>

            {r.status === 'flagged' && r.moderation_reason && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">
                Held by auto-screening — an admin will review it. {r.moderation_reason}
              </p>
            )}

            {/* Pro reply */}
            {reply && !open ? (
              <div className="mt-3 rounded-xl border-l-2 bg-black/[0.03] px-3 py-2" style={{ borderColor: GOLD }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: GOLD }}>Your reply</div>
                  <button
                    onClick={() => {
                      setDrafts((s) => ({ ...s, [r.id]: reply.body }))
                      setEditing((s) => ({ ...s, [r.id]: true }))
                    }}
                    className="text-xs text-black/50 underline hover:text-black/80"
                  >
                    Edit
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-black/70">{reply.body}</p>
              </div>
            ) : open || (r.status === 'approved' && !reply) ? (
              <div className="mt-3">
                {!open && !reply ? (
                  <button
                    onClick={() => setEditing((s) => ({ ...s, [r.id]: true }))}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/10"
                  >
                    Reply publicly
                  </button>
                ) : (
                  <>
                    <textarea
                      value={drafts[r.id] ?? ''}
                      onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Thank them, or address their feedback…"
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => saveReply(r.id)}
                        disabled={busyId === r.id || !(drafts[r.id] || '').trim()}
                        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                        style={{ backgroundColor: GOLD }}
                      >
                        {busyId === r.id ? 'Posting…' : reply ? 'Save reply' : 'Post reply'}
                      </button>
                      <button
                        onClick={() => setEditing((s) => ({ ...s, [r.id]: false }))}
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/70"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
