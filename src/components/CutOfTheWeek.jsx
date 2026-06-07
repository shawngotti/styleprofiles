import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { initials } from '../lib/format.js'

const GOLD = '#F4A93C'
const TAG_OPTIONS = [
  { value: 'none', label: 'No client tagged' },
  { value: 'public', label: 'Request public tag' },
  { value: 'anonymous', label: 'Request anonymous credit' },
]

// Cut of the Week — year-round weekly challenge. Approved before/after entries
// ranked by live fan votes (cast_fan_vote). Pros submit one look per week via
// submit_cotw_entry; tagged-client looks wait on consent. Gated on lineup_on.
export default function CutOfTheWeek() {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState(undefined) // undefined=loading, null=none open
  const [brief, setBrief] = useState(null)
  const [board, setBoard] = useState([])
  const [urls, setUrls] = useState({}) // entry_id -> signed after-media url
  const [myVote, setMyVote] = useState(null)
  const [myPro, setMyPro] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data: wc } = await supabase
      .from('weekly_challenges')
      .select('id,brief_id,status,closes_at,voting_window_id')
      .eq('status', 'open')
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!wc) {
      setChallenge(null)
      return
    }
    const [{ data: br }, { data: lb }, { data: pro }, voteRes] = await Promise.all([
      supabase.from('briefs').select('title,description,constraints').eq('id', wc.brief_id).maybeSingle(),
      supabase.rpc('cotw_leaderboard', { _challenge_id: wc.id }),
      supabase.from('pros').select('id,display_name').eq('profile_id', user.id).maybeSingle(),
      supabase.from('fan_votes').select('target_entry_id').eq('voting_window_id', wc.voting_window_id).maybeSingle(),
    ])
    const rows = lb || []
    setBrief(br || null)
    setBoard(rows)
    setMyPro(pro || null)
    setMyVote(voteRes.data?.target_entry_id || null)
    // Signed URLs for the private reveal media.
    const paths = rows.map((r) => r.after_media).filter(Boolean)
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('lineup-reveals').createSignedUrls(paths, 600)
      const map = {}
      for (const r of rows) {
        const s = (signed || []).find((x) => x.path === r.after_media)
        if (s?.signedUrl) map[r.entry_id] = s.signedUrl
      }
      setUrls(map)
    }
    setChallenge(wc)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function vote(entryId) {
    setBusy(entryId)
    setMsg(null)
    const { error } = await supabase.functions.invoke('cast_fan_vote', {
      body: { voting_window_id: challenge.voting_window_id, target_entry_id: entryId },
    })
    setBusy(null)
    if (error) {
      let text = 'Could not record your vote'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    setMyVote(entryId)
    load()
  }

  if (challenge === undefined) return <p className="text-sm text-white/50">Loading Cut of the Week…</p>
  if (challenge === null) return <p className="text-sm text-white/40">No Cut of the Week is open right now.</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{brief?.title || 'Cut of the Week'}</h2>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
          Voting open
        </span>
      </div>
      {brief?.description && <p className="text-sm text-white/60">{brief.description}</p>}
      <p className="text-xs text-white/40">One vote this week · closes {new Date(challenge.closes_at).toLocaleDateString()}.</p>

      {myPro && <SubmitPanel proId={myPro.id} onDone={load} />}
      {msg && <p className="text-sm text-red-400">{msg.text}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {board.map((e, i) => {
          const isPick = myVote === e.entry_id
          return (
            <div key={e.entry_id} className="overflow-hidden rounded-2xl border" style={{ borderColor: isPick ? GOLD : 'rgba(255,255,255,0.10)' }}>
              {urls[e.entry_id] ? (
                <img src={urls[e.entry_id]} alt={e.display_name} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-white/5 text-2xl font-semibold text-white/30">
                  {initials(e.display_name)}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {i === 0 && Number(e.votes) > 0 ? '🥇 ' : ''}{e.display_name}
                  </div>
                  <div className="text-xs text-white/40">{Number(e.votes)} vote{Number(e.votes) === 1 ? '' : 's'}</div>
                </div>
                {isPick ? (
                  <span className="shrink-0 text-sm font-medium" style={{ color: GOLD }}>✓ Your pick</span>
                ) : (
                  <button
                    onClick={() => vote(e.entry_id)}
                    disabled={busy === e.entry_id || !!myVote}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
                    style={{ backgroundColor: GOLD }}
                  >
                    {busy === e.entry_id ? '…' : 'Vote'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {board.length === 0 && <p className="text-sm text-white/40">No entries yet — be the first.</p>}
      </div>
    </div>
  )
}

function SubmitPanel({ proId, onDone }) {
  const [open, setOpen] = useState(false)
  const [before, setBefore] = useState(null)
  const [after, setAfter] = useState(null)
  const [tag, setTag] = useState('none')
  const [subjectEmail, setSubjectEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const beforeRef = useRef(null)
  const afterRef = useRef(null)

  async function submit() {
    setBusy(true)
    setMsg(null)
    try {
      if (!after) throw new Error('An "after" photo is required')
      if (tag !== 'none' && !subjectEmail.trim()) throw new Error("Enter the client's email to tag them")
      const upload = async (file, name) => {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${proId}/${name}.${ext}`
        const { error } = await supabase.storage.from('lineup-reveals').upload(path, file, { upsert: true, contentType: file.type || undefined })
        if (error) throw new Error(error.message)
        return path
      }
      const afterPath = await upload(after, 'cotw-after')
      const beforePath = before ? await upload(before, 'cotw-before') : null
      const { data, error } = await supabase.functions.invoke('submit_cotw_entry', {
        body: { pro_id: proId, before_media: beforePath, after_media: afterPath, tag, subject_email: tag === 'none' ? undefined : subjectEmail.trim() },
      })
      if (error) {
        let text = 'Could not submit your entry'
        try {
          const j = await error.context.json()
          if (j?.error) text = j.error
        } catch { /* keep generic */ }
        throw new Error(text)
      }
      setMsg({ type: 'ok', text: data.status === 'submitted' ? 'Entry saved — goes live once your tagged client approves.' : "You're entered this week." })
      setOpen(false)
      setBefore(null)
      setAfter(null)
      if (beforeRef.current) beforeRef.current.value = ''
      if (afterRef.current) afterRef.current.value = ''
      onDone()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      {!open ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Enter your best look for this week.</span>
          <button onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black" style={{ backgroundColor: GOLD }}>
            Enter Cut of the Week
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-white/50">After photo (required)</span>
            <input ref={afterRef} type="file" accept="image/*" onChange={(e) => setAfter(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white" />
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Before photo (optional)</span>
            <input ref={beforeRef} type="file" accept="image/*" onChange={(e) => setBefore(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white" />
          </label>
          <label className="block text-sm">
            <span className="text-white/50">Client / model tagging</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30">
              {TAG_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>)}
            </select>
          </label>
          {tag !== 'none' && (
            <label className="block text-sm">
              <span className="text-white/50">Client email (we'll request their consent)</span>
              <input value={subjectEmail} onChange={(e) => setSubjectEmail(e.target.value)} placeholder="client@email.com" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
              {busy ? 'Submitting…' : 'Submit entry'}
            </button>
            <button onClick={() => { setOpen(false); setMsg(null) }} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</p>}
    </section>
  )
}
