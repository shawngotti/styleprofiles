import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const GOLD = '#F4A93C'

const TAG_OPTIONS = [
  { value: 'none', label: 'No client tagged' },
  { value: 'public', label: 'Request public tag' },
  { value: 'anonymous', label: 'Request anonymous credit' },
]

// Pro-side Awards submission (matches the prototype's "Submit to Awards" panel):
// choose a look label, attach a photo, optionally tag a client. The photo is
// uploaded to the private award-media bucket (RLS limits the pro to their own
// folder); submit_award_entry then validates and creates the entry. Untagged
// looks publish immediately; tagged looks wait on the client's consent.
export default function SubmitAwardEntry({ proId, category }) {
  const [cycle, setCycle] = useState(undefined) // undefined=loading, null=none open
  const [entry, setEntry] = useState(null)
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState('')
  const [tag, setTag] = useState('none')
  const [subjectEmail, setSubjectEmail] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString()
    const { data: cyc } = await supabase
      .from('award_cycles')
      .select('id,period,status,closes_at')
      .in('status', ['submissions', 'voting'])
      .gt('closes_at', nowIso)
      .order('period', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCycle(cyc || null)
    if (cyc) {
      // owns_pro read policy lets the pro see their own pending/approved entry.
      const { data: e } = await supabase
        .from('award_submissions')
        .select('id,look_label,status')
        .eq('cycle_id', cyc.id)
        .eq('pro_id', proId)
        .maybeSingle()
      setEntry(e || null)
    }
  }, [proId])

  useEffect(() => {
    load()
  }, [load])

  async function submit() {
    setBusy(true)
    setMsg(null)
    try {
      if (!file) throw new Error('Add a photo of the look')
      if (tag !== 'none' && !subjectEmail.trim()) throw new Error("Enter the client's email to tag them")

      // 1) Upload to the pro's folder in the private bucket.
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${proId}/${cycle.id}.${ext}`
      const upload = await supabase.storage.from('award-media').upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      })
      if (upload.error) throw new Error(upload.error.message)

      // 2) Create the entry server-side (validates media + consent gate).
      const { data, error } = await supabase.functions.invoke('submit_award_entry', {
        body: {
          pro_id: proId,
          media_path: path,
          look_label: look.trim() || 'Signature look',
          tag,
          subject_email: tag === 'none' ? undefined : subjectEmail.trim(),
        },
      })
      if (error) {
        let text = 'Could not submit your entry'
        try {
          const j = await error.context.json()
          if (j?.error) text = j.error
        } catch { /* keep generic */ }
        throw new Error(text)
      }
      setMsg({
        type: 'ok',
        text:
          data.status === 'pending'
            ? 'Entry saved — it goes live once your tagged client approves the consent request.'
            : "You're entered this month.",
      })
      setOpen(false)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  if (cycle === undefined) return null
  if (cycle === null) {
    return (
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Monthly Awards</h3>
        <p className="mt-2 text-sm text-black/50">No awards cycle is accepting entries right now.</p>
      </section>
    )
  }

  const period = new Date(cycle.period + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const statusBadge =
    entry?.status === 'approved'
      ? { text: 'Entered', color: '#34D399' }
      : entry?.status === 'pending'
        ? { text: 'Awaiting consent', color: GOLD }
        : null

  return (
    <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black/55">Awards · {period}</h3>
        {statusBadge && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: statusBadge.color }}
          >
            {statusBadge.text}
          </span>
        )}
      </div>

      {entry && !open ? (
        <p className="mt-3 text-sm text-black/70">
          {entry.status === 'approved' ? '✓ ' : '⏳ '}
          <b>{entry.look_label}</b>{' '}
          {entry.status === 'pending'
            ? '— waiting on your tagged client to approve consent before it goes public.'
            : `is entered for ${category ? `${category} ` : ''}of the month.`}
        </p>
      ) : (
        <p className="mt-3 text-sm text-black/70">
          Enter one completed look this month — one per category. Tagged-client looks publish once consent is granted.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => {
            setOpen(true)
            setLook(entry?.look_label || '')
          }}
          className="mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold text-black"
          style={{ backgroundColor: GOLD }}
        >
          {entry ? 'Replace entry' : 'Submit to Awards'}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-black/50">Look name</span>
            <input
              value={look}
              onChange={(e) => setLook(e.target.value)}
              placeholder="e.g. Textured fade"
              className="mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </label>
          <label className="block text-sm">
            <span className="text-black/50">Photo of the look</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-black/70 file:mr-3 file:rounded-lg file:border-0 file:bg-black/10 file:px-3 file:py-1.5 file:text-sm file:text-gray-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-black/50">Client / model tagging</span>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30"
            >
              {TAG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-white">
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {tag !== 'none' && (
            <label className="block text-sm">
              <span className="text-black/50">Client email (we'll request their consent)</span>
              <input
                value={subjectEmail}
                onChange={(e) => setSubjectEmail(e.target.value)}
                placeholder="client@email.com"
                className="mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </label>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {busy ? 'Submitting…' : 'Submit entry'}
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setMsg(null)
              }}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm text-black/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{msg.text}</p>
      )}
    </section>
  )
}
