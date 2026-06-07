import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { initials } from '../lib/format.js'
import EventTickets from './EventTickets.jsx'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'
const PRO_FIELDS = 'id,handle,display_name,category,bio,city,verified,rating_avg,rating_count,price_from,charges_enabled'

// The Lineup — public, read-only season bracket (top-of-funnel). Bracket outcomes
// are judge/admin-decided; the only thing fans do here is the Redemption/Fan
// Favorite vote when a window is open (via the cast_fan_vote integrity function).
// Whole screen is gated on lineup_on upstream (tab is hidden when dark).
export default function Lineup({ onOpenPro }) {
  const [comp, setComp] = useState(undefined) // undefined=loading, null=none
  const [rounds, setRounds] = useState([])
  const [matchups, setMatchups] = useState([])
  const [byId, setById] = useState({}) // contestant_id -> { ...contestant, pro }
  const [openWindow, setOpenWindow] = useState(null)
  const [myVote, setMyVote] = useState(null) // contestant_id I voted for
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data: c } = await supabase
      .from('competitions')
      .select('id,name,scope,metro,status')
      .in('status', ['qualifying', 'live', 'complete'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!c) {
      setComp(null)
      return
    }
    const [rd, ct, wd] = await Promise.all([
      supabase.from('competition_rounds').select('id,name,round_order,status').eq('competition_id', c.id).order('round_order'),
      supabase.from('contestants').select(`id,seed,status,pro:pros(${PRO_FIELDS})`).eq('competition_id', c.id),
      supabase.from('voting_windows').select('id,vote_type,status,closes_at').eq('competition_id', c.id).eq('status', 'open'),
    ])
    const roundIds = (rd.data || []).map((r) => r.id)
    const { data: ms } = roundIds.length
      ? await supabase.from('matchups').select('id,round_id,contestant_a,contestant_b,winner_contestant_id,status').in('round_id', roundIds)
      : { data: [] }
    setRounds(rd.data || [])
    setMatchups(ms || [])
    setById(Object.fromEntries((ct.data || []).map((x) => [x.id, x])))
    const win = (wd.data || [])[0] || null
    setOpenWindow(win)
    if (win) {
      const { data: mine } = await supabase.from('fan_votes').select('target_contestant_id').eq('voting_window_id', win.id).maybeSingle()
      setMyVote(mine?.target_contestant_id || null)
    }
    setComp(c)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function vote(contestantId) {
    setBusy(contestantId)
    setMsg(null)
    const { error } = await supabase.functions.invoke('cast_fan_vote', {
      body: { voting_window_id: openWindow.id, target_contestant_id: contestantId },
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
    track('fan_vote', { context: 'lineup', window_id: openWindow.id, contestant_id: contestantId })
    setMyVote(contestantId)
  }

  if (comp === undefined) return <p className="text-sm text-white/50">Loading The Lineup…</p>
  if (comp === null) return <p className="text-sm text-white/40">No competition is running right now.</p>

  const champion = Object.values(byId).find((c) => c.status === 'champion')

  function Contestant({ id, isWinner }) {
    const c = id ? byId[id] : null
    if (!c) return <span className="text-sm text-white/30">TBD</span>
    const canVote = openWindow && !myVote && c.status !== 'eliminated'
    return (
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => c.pro && onOpenPro?.(c.pro, GOLD)}
          className="flex min-w-0 items-center gap-2 text-left"
          title="View storefront / book"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black" style={{ backgroundColor: isWinner ? GOLD : 'rgba(255,255,255,0.25)' }}>
            {initials(c.pro?.display_name)}
          </span>
          <span className={`truncate text-sm ${isWinner ? 'font-semibold' : ''}`}>
            <span className="text-white/40">#{c.seed} </span>
            {c.pro?.display_name}
          </span>
          {c.status === 'champion' && <span title="Champion">👑</span>}
          {c.status === 'redeemed' && <span className="text-xs" style={{ color: GOLD }}>↩ redeemed</span>}
        </button>
        {canVote && (
          <button
            onClick={() => vote(c.id)}
            disabled={busy === c.id}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-40"
            style={{ backgroundColor: GOLD }}
          >
            {busy === c.id ? '…' : 'Vote'}
          </button>
        )}
        {openWindow && myVote === c.id && <span className="shrink-0 text-xs font-medium" style={{ color: GOLD }}>✓ Your pick</span>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{comp.name}</h2>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: GOLD }}>
          {comp.metro || comp.scope} · {comp.status}
        </span>
      </div>

      {champion && (
        <section className="rounded-2xl border p-4" style={{ borderColor: `${GOLD}55`, backgroundColor: `${GOLD}0d` }}>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide" style={{ color: GOLD }}>👑 Champion</h3>
          <button onClick={() => champion.pro && onOpenPro?.(champion.pro, GOLD)} className="font-medium">
            {champion.pro?.display_name}
          </button>
        </section>
      )}

      {openWindow && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold" style={{ color: GOLD }}>
              {openWindow.vote_type === 'redemption' ? 'Redemption Wildcard' : openWindow.vote_type === 'fan_favorite' ? 'Fan Favorite' : 'Fan vote'} voting is open
            </span>
            <span className="text-white/40">· closes {new Date(openWindow.closes_at).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 text-xs text-white/40">
            Fan votes decide only the wildcard &amp; fan favorite — never the bracket itself. One vote per window.
          </p>
        </section>
      )}
      {msg && <p className="text-sm text-red-400" role="alert" aria-live="assertive">{msg.text}</p>}

      <EventTickets competitionId={comp.id} />

      <div className="space-y-5">
        {rounds.map((r) => {
          const ms = matchups.filter((m) => m.round_id === r.id)
          return (
            <section key={r.id}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
                {r.name} {r.status === 'complete' ? '· done' : r.status === 'live' ? '· live' : ''}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ms.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Contestant id={m.contestant_a} isWinner={m.winner_contestant_id === m.contestant_a} />
                    <div className="border-t border-white/5" />
                    <Contestant id={m.contestant_b} isWinner={m.winner_contestant_id === m.contestant_b} />
                  </div>
                ))}
                {ms.length === 0 && <p className="text-sm text-white/30">Matchups not set yet.</p>}
              </div>
            </section>
          )
        })}
        {rounds.length === 0 && <p className="text-sm text-white/40">The bracket hasn't been drawn yet.</p>}
      </div>
    </div>
  )
}
