// Batch 9 — seed an open Awards cycle with approved nominees (one per pro).
// Run after seed-demo-pros (submissions cascade if pros are reseeded).
// Run: node --env-file=.env scripts/seed-awards.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) throw new Error('Missing env vars in .env')

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const PERIOD = '2026-06-01'

async function main() {
  // Open voting cycle for the period (idempotent on unique period).
  const { data: cycle, error: cErr } = await admin
    .from('award_cycles')
    .upsert(
      { period: PERIOD, opens_at: '2026-06-01T00:00:00Z', closes_at: '2026-07-01T00:00:00Z', status: 'voting' },
      { onConflict: 'period' },
    )
    .select('id')
    .single()
  if (cErr) throw cErr

  // Fresh submissions for this cycle.
  await admin.from('award_submissions').delete().eq('cycle_id', cycle.id)

  const { data: pros } = await admin.from('pros').select('id,display_name,category').not('category', 'is', null)
  let n = 0
  for (const p of pros) {
    const { data: svc } = await admin
      .from('services')
      .select('name')
      .eq('pro_id', p.id)
      .eq('is_addon', false)
      .order('sort')
      .limit(1)
      .maybeSingle()
    const { error } = await admin.from('award_submissions').insert({
      cycle_id: cycle.id,
      category: p.category,
      pro_id: p.id,
      look_label: svc?.name || 'Signature look',
      status: 'approved',
    })
    if (error) throw new Error(`submission ${p.display_name}: ${error.message}`)
    n++
  }
  console.log(`Awards cycle ${PERIOD} (voting) with ${n} approved nominees.`)
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
