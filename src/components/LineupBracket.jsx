import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const ACCENT = '#0FB9A6'
const INK = '#06403a' // deep teal for legible text on mint
const RUBRIC = [['Technical', 30], ['Creative', 25], ['Reveal', 20], ['Experience', 15], ['Composure', 10]]

function countdown(closesAt) {
  if (!closesAt) return null
  const ms = new Date(closesAt) - new Date()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

// Bright ESPN-style live-bracket section on the home (Lineup option B). Loads the
// live/demo competition and shows a clean bracket + judge scoring rubric; taps
// into the full Lineup. Renders nothing when there's no competition.
export default function LineupBracket({ onOpen, demo }) {
  const [data, setData] = useState(undefined) // undefined = loading, null = none

  useEffect(() => {
    let on = true
    ;(async () => {
      const { data: c } = await supabase
        .from('competitions')
        .select('id,name,scope,metro,status')
        .in('status', ['qualifying', 'live', 'complete'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!c) {
        if (on) setData(null)
        return
      }
      const [{ data: cts }, { data: wins }] = await Promise.all([
        supabase.from('contestants').select('id,seed,status,pro:pros(display_name,handle,avatar_url)').eq('competition_id', c.id).order('seed'),
        supabase.from('voting_windows').select('closes_at,status').eq('competition_id', c.id).eq('status', 'open'),
      ])
      if (!on) return
      const list = cts || []
      setData({ comp: c, contestants: list, champion: list.find((x) => x.status === 'champion'), closesAt: wins?.[0]?.closes_at })
    })()
    return () => { on = false }
  }, [])

  if (!data) return null
  const { comp, contestants, champion, closesAt } = data
  const cd = countdown(closesAt)
  const live = comp.status === 'live'
  const stage = comp.status === 'complete' ? 'Champion crowned' : comp.status === 'qualifying' ? 'Qualifying round' : 'Live now'
  const semis = contestants.slice(0, 4)

  const Node = ({ c, dim }) => (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${dim ? 'border-black/[0.07] text-black/55' : 'border-black/15'}`}>
      <span className="truncate">{c ? `#${c.seed} ${c.pro?.display_name}` : 'TBD'}</span>
    </div>
  )

  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide" style={{ backgroundColor: ACCENT, color: INK }}>THE LINEUP</span>
            <span className="truncate text-base font-semibold">{comp.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-black/50">{(comp.metro || comp.scope) ?? ''} · {stage}</div>
        </div>
        {live && <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">● Live</span>}
      </div>

      <div className="p-5">
        <div className="flex items-stretch gap-3">
          <div className="flex-1 space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-black/40">Semifinal</div>
            {semis.length ? semis.map((c, i) => <Node key={c.id} c={c} dim={i % 2 === 1} />) : <Node c={null} dim />}
          </div>
          <div className="flex flex-1 flex-col justify-center gap-7">
            <div className="text-[10px] font-medium uppercase tracking-wide text-black/40">Final</div>
            <Node c={semis[0]} />
            <Node c={semis[2]} dim />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <span className="text-3xl" aria-hidden>🏆</span>
            <div className="text-center text-sm font-medium">
              {champion ? champion.pro?.display_name : 'Champion'}
              {!champion && <><br /><span className="font-normal text-black/45">TBD</span></>}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-black/40">Judge scoring</div>
          <div className="flex flex-wrap gap-1.5">
            {RUBRIC.map(([l, n]) => (
              <span key={l} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px]">{l} {n}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={onOpen} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: ACCENT, color: INK }}>
            {demo ? 'Preview the bracket' : champion ? 'See the results' : 'See the full bracket'}
          </button>
          {cd && <span className="text-xs text-black/50">⏱ Vote closes in {cd}</span>}
        </div>
      </div>
    </section>
  )
}
