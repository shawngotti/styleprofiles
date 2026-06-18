import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { initials } from '../lib/format.js'
import EventTickets from './EventTickets.jsx'
import { track } from '../lib/analytics.js'

const GOLD = '#0FB9A6'
const PRO_FIELDS = 'id,handle,display_name,category,bio,city,verified,rating_avg,rating_count,price_from,charges_enabled'
const SPONSORS = ['WAHL', 'ANDIS', 'BABYLISSPRO', 'RED BULL', 'HENNESSY']

function countdown(closesAt) {
  if (!closesAt) return null
  const ms = new Date(closesAt) - new Date()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

// The Lineup — public, read-only season bracket (top-of-funnel). Bracket outcomes
// are judge/admin-decided; the only thing fans do here is the Redemption/Fan
// Favorite vote when a window is open (via the cast_fan_vote integrity function).
// Whole screen is gated on lineup_on upstream (tab is hidden when dark).
export default function Lineup({ demo = false, onOpenPro }) {
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

  if (comp === undefined) return <p className="text-sm text-black/50">Loading The Lineup…</p>
  if (comp === null) return <p className="text-sm text-black/55">No competition is running right now.</p>

  const champion = Object.values(byId).find((c) => c.status === 'champion')

  function Contestant({ id, isWinner }) {
    const c = id ? byId[id] : null
    if (!c) return <span className="text-sm text-black/30">TBD</span>
    const canVote = openWindow && !myVote && c.status !== 'eliminated' && !demo
    return (
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => c.pro && onOpenPro?.(c.pro, GOLD)}
          className="flex min-w-0 items-center gap-2 text-left"
          title="View storefront / book"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black" style={{ backgroundColor: isWinner ? GOLD : 'rgba(0,0,0,0.18)' }}>
            {initials(c.pro?.display_name)}
          </span>
          <span className={`truncate text-sm ${isWinner ? 'font-semibold' : ''}`}>
            <span className="text-black/55">#{c.seed} </span>
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

  const stage = comp.status === 'complete' ? 'Champion crowned' : comp.status === 'qualifying' ? 'Qualifying round' : 'Live now'
  const contestantCount = Object.keys(byId).length
  const cd = countdown(openWindow?.closes_at)

  return (
    <div>
      {/* Cinematic hero — full bleed */}
      <section className="relative overflow-hidden" style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', backgroundColor: '#100d0a' }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" style={{ background: 'rgba(15,185,166,0.12)' }} />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full" style={{ background: 'rgba(179,37,31,0.14)' }} />
        <div className="relative mx-auto max-w-5xl px-4 py-9 sm:px-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-white" style={{ backgroundColor: '#b3251f' }}>THE LINEUP</span>
            {comp.status === 'live' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#ff6b66' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ff4d47' }} /> LIVE NOW
              </span>
            )}
            {demo && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">Demo preview</span>}
          </div>

          <h1 className="text-4xl font-extrabold uppercase leading-[0.98] tracking-tight text-white sm:text-5xl">{comp.name}</h1>
          <p className="mt-2 text-sm" style={{ color: '#c9bfae' }}>
            {(comp.metro || comp.scope) ?? ''} · {stage}{contestantCount ? ` · ${contestantCount} contestants` : ''}
          </p>

          <a
            href="/the-lineup/index.html"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-95"
            style={{ backgroundColor: GOLD, color: '#06403a' }}
          >
            ▶ Watch the Making The Cut showcase
          </a>

          {champion ? (
            <button onClick={() => champion.pro && onOpenPro?.(champion.pro, GOLD)} className="mt-5 flex items-center gap-3 text-left">
              <span className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold" style={{ backgroundColor: '#22341f', color: GOLD }}>
                {initials(champion.pro?.display_name)}
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-base font-semibold text-white">👑 {champion.pro?.display_name}</span>
                <span className="text-xs" style={{ color: '#c9bfae' }}>Champion · @{champion.pro?.handle}</span>
              </span>
            </button>
          ) : cd ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">
              <span aria-hidden>⏱</span> Fan vote closes in {cd}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11px] tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {SPONSORS.map((s) => <span key={s}>{s}</span>)}
          </div>
        </div>
      </section>

      {demo && (
        <div className="mt-6 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-black/60 shadow-sm">
          👀 <strong>Demo preview</strong> — a sample bracket to show The Lineup. Voting is disabled until the season launches.
        </div>
      )}

      <div className="mt-6 space-y-5">
      {openWindow && (
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold" style={{ color: GOLD }}>
              {openWindow.vote_type === 'redemption' ? 'Redemption Wildcard' : openWindow.vote_type === 'fan_favorite' ? 'Fan Favorite' : 'Fan vote'} voting is open
            </span>
            <span className="text-black/55">· closes {new Date(openWindow.closes_at).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 text-xs text-black/55">
            Fan votes decide only the wildcard &amp; fan favorite — never the bracket itself. One vote per window.
          </p>
        </section>
      )}
      {msg && <p className="text-sm text-red-600" role="alert" aria-live="assertive">{msg.text}</p>}

      <EventTickets competitionId={comp.id} />

      <div className="space-y-5">
        {rounds.map((r) => {
          const ms = matchups.filter((m) => m.round_id === r.id)
          return (
            <section key={r.id}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50">
                {r.name} {r.status === 'complete' ? '· done' : r.status === 'live' ? '· live' : ''}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ms.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-2xl border border-black/[0.06] bg-white shadow-sm p-3">
                    <Contestant id={m.contestant_a} isWinner={m.winner_contestant_id === m.contestant_a} />
                    <div className="border-t border-black/5" />
                    <Contestant id={m.contestant_b} isWinner={m.winner_contestant_id === m.contestant_b} />
                  </div>
                ))}
                {ms.length === 0 && <p className="text-sm text-black/30">Matchups not set yet.</p>}
              </div>
            </section>
          )
        })}
        {rounds.length === 0 && <p className="text-sm text-black/55">The bracket hasn't been drawn yet.</p>}
      </div>
      </div>
    </div>
  )
}
