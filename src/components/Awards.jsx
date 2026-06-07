import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { initials } from '../lib/format.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Monthly Awards: approved nominees per category with one vote per category.
// Votes go through the cast_award_vote integrity function. Tallies are not shown
// (award_votes is self-read only by design — no bandwagon effect).
export default function Awards() {
  const [cycle, setCycle] = useState(undefined) // undefined = loading, null = none open
  const [subs, setSubs] = useState([])
  const [cats, setCats] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [winners, setWinners] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data: cyc } = await supabase
      .from('award_cycles')
      .select('id,period,status,closes_at')
      .eq('status', 'voting')
      .order('period', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cyc) {
      setCycle(null)
      return
    }
    const [s, c, v, w] = await Promise.all([
      supabase
        .from('award_submissions')
        .select('id,category,look_label,pro:pros(display_name,handle)')
        .eq('cycle_id', cyc.id)
        .eq('status', 'approved'),
      supabase.from('service_categories').select('slug,label,color').eq('active', true).order('sort'),
      supabase.from('award_votes').select('category,submission_id').eq('cycle_id', cyc.id),
      supabase.from('award_winners').select('category,pro:pros(display_name,handle)').eq('cycle_id', cyc.id),
    ])
    setSubs(s.data || [])
    setCats(c.data || [])
    setMyVotes(Object.fromEntries((v.data || []).map((x) => [x.category, x.submission_id])))
    setWinners(w.data || [])
    setCycle(cyc)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function castVote(submissionId) {
    setBusy(submissionId)
    setMsg(null)
    const { error } = await supabase.functions.invoke('cast_award_vote', { body: { submission_id: submissionId } })
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
    track('award_vote', { submission_id: submissionId })
    load()
  }

  if (cycle === undefined) return <p className="text-sm text-white/50">Loading awards…</p>
  if (cycle === null) return <p className="text-sm text-white/40">No awards voting is open right now.</p>

  const period = new Date(cycle.period + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const groups = cats
    .map((c) => ({ cat: c, noms: subs.filter((s) => s.category === c.slug) }))
    .filter((g) => g.noms.length > 0)
  const catLabel = Object.fromEntries(cats.map((c) => [c.slug, c.label]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Awards · {period}</h2>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
          Voting open
        </span>
      </div>

      {winners.length > 0 && (
        <section className="rounded-2xl border p-4" style={{ borderColor: `${GOLD}55`, backgroundColor: `${GOLD}0d` }}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: GOLD }}>🏆 Winners</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {winners.map((w) => (
              <div key={w.category} className="flex items-center justify-between text-sm">
                <span className="text-white/60">{catLabel[w.category] || w.category} of the Month</span>
                <span className="font-medium">{w.pro?.display_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-white/40">One vote per category. Closes {new Date(cycle.closes_at).toLocaleDateString()}.</p>
      {msg && <p className="text-sm text-red-400">{msg.text}</p>}

      {groups.map(({ cat, noms }) => {
        const votedFor = myVotes[cat.slug]
        return (
          <section key={cat.slug}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: cat.color }}>
              {cat.label} of the Month
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {noms.map((n) => {
                const isPick = votedFor === n.id
                const votedOther = votedFor && !isPick
                return (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border p-4"
                    style={{ borderColor: isPick ? GOLD : 'rgba(255,255,255,0.10)', backgroundColor: isPick ? `${GOLD}0d` : 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-black" style={{ backgroundColor: cat.color }}>
                        {initials(n.pro?.display_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{n.pro?.display_name}</div>
                        <div className="truncate text-xs text-white/50">{n.look_label}</div>
                      </div>
                    </div>
                    {isPick ? (
                      <span className="shrink-0 text-sm font-medium" style={{ color: GOLD }}>
                        ✓ Your pick
                      </span>
                    ) : (
                      <button
                        onClick={() => castVote(n.id)}
                        disabled={busy === n.id || votedOther}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
                        style={{ backgroundColor: GOLD }}
                      >
                        {busy === n.id ? '…' : 'Vote'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
