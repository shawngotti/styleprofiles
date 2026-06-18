import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { initials } from '../lib/format.js'

const GOLD = '#0FB9A6'

function countdown(closesAt) {
  if (!closesAt) return null
  const ms = new Date(closesAt) - new Date()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

function Avatar({ pro }) {
  return pro?.avatar_url ? (
    <img src={pro.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/15" />
  ) : (
    <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: '#3a2f1c', color: GOLD }}>
      {initials(pro?.display_name)}
    </div>
  )
}

// The dark cinematic "tentpole" band on the home, beneath the pros. Teases the
// live (or demo) competition and taps through to the full Lineup. Renders
// nothing when there's no competition to show — never an empty band.
export default function LineupBand({ onOpen, demo }) {
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
      const champion = list.find((x) => x.status === 'champion')
      const active = list.filter((x) => x.status !== 'eliminated' && x.status !== 'champion')
      setData({ comp: c, champion, a: active[0], b: active[1], closesAt: wins?.[0]?.closes_at })
    })()
    return () => {
      on = false
    }
  }, [])

  if (!data) return null

  const { comp, champion, a, b, closesAt } = data
  const cd = countdown(closesAt)
  const live = comp.status === 'live'
  const stage = comp.status === 'complete' ? 'Champion crowned' : comp.status === 'qualifying' ? 'Qualifying round' : 'Live now'

  return (
    <section
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen?.())}
      aria-label="Open The Lineup"
      className="relative mt-7 cursor-pointer overflow-hidden rounded-3xl shadow-md transition hover:shadow-lg"
      style={{ backgroundColor: '#120f0c' }}
    >
      {/* warm accent wash (solid, no gradient flashing) */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full" style={{ background: 'rgba(244,169,60,0.10)' }} />

      <div className="relative p-6 sm:p-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-white" style={{ backgroundColor: '#b3251f' }}>
            THE LINEUP
          </span>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: '#ff6b66' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ff4d47' }} /> LIVE NOW
            </span>
          )}
        </div>

        <h2 className="text-2xl font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-3xl">
          {comp.name}
        </h2>
        <p className="mt-1 text-xs" style={{ color: '#c9bfae' }}>
          {(comp.metro || comp.scope) ?? ''} · {stage}
        </p>

        {champion ? (
          <div className="mt-4 flex items-center gap-3">
            <Avatar pro={champion.pro} />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                👑 {champion.pro?.display_name}
              </div>
              <div className="text-[11px]" style={{ color: '#c9bfae' }}>Champion · @{champion.pro?.handle}</div>
            </div>
          </div>
        ) : a && b ? (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Avatar pro={a.pro} />
              <span className="text-sm text-white">{a.pro?.display_name}</span>
            </div>
            <span className="text-sm font-semibold tracking-wide" style={{ color: GOLD }}>VS</span>
            <div className="flex items-center gap-2.5">
              <Avatar pro={b.pro} />
              <span className="text-sm text-white">{b.pro?.display_name}</span>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <span className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: GOLD, color: '#06403a' }}>
            {demo ? 'Preview the bracket' : champion ? 'See the results' : 'Vote now'}
          </span>
          {cd && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#c9bfae' }}>
              <span aria-hidden>⏱</span> Closes in {cd}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
