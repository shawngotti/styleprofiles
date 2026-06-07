// Option A3+ — admin CSV attendee import (Posh / manual / Eventbrite export).
// Verifies the client CSV parse → import_event_attendees path: quoted commas,
// dollars→cents, qty default, email→profile match, and idempotency on re-import.
// The parseCSV/mapRows here mirror src/components/AdminConsole.jsx (keep in sync).
// Run: node --env-file=.env scripts/test-attendee-import.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('Missing env vars in .env')

// ---- mirror of the UI parser ----
function parseCSV(text) {
  const rows = []
  let cur = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { cur.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(field); rows.push(cur); cur = []; field = '' }
    else field += c
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
const ALIASES = {
  external_ref: ['external_ref', 'order_id', 'order id', 'ticket_id', 'id'],
  email: ['email'], name: ['name', 'attendee'], ticket_type: ['ticket_type', 'ticket type', 'type'],
  qty: ['qty', 'quantity'], amount: ['amount', 'total', 'price'], status: ['status'],
}
function mapRows(text) {
  const grid = parseCSV(text)
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const idx = {}
  for (const [f, names] of Object.entries(ALIASES)) idx[f] = header.findIndex((h) => names.includes(h))
  return grid.slice(1).map((cols) => {
    const get = (f) => (idx[f] >= 0 ? (cols[idx[f]] ?? '').trim() : '')
    const amt = get('amount'); const qty = parseInt(get('qty'), 10)
    return {
      external_ref: get('external_ref') || null, email: get('email') || null, name: get('name') || null,
      ticket_type: get('ticket_type') || null, qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      amount: amt ? Math.round(parseFloat(amt.replace(/[^0-9.]/g, '')) * 100) : null, status: get('status') || 'confirmed',
    }
  })
}
// ----

const PW = 'Imp-Pass1!'
const ADMIN = 'imp-admin@example.com'
const KNOWN = 'imp-known@example.com'
const ALL = [ADMIN, KNOWN]
const COMP = 'Import Test Comp'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const results = []
const check = (n, p, d = '') => results.push({ name: n, pass: !!p, detail: d })
async function mkUser(email) { const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true }); return data.user.id }
async function signIn(email) { const c = createClient(URL, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: PW }); return c }
async function cleanup() {
  const { data: comp } = await admin.from('competitions').select('id').eq('name', COMP).maybeSingle()
  if (comp) await admin.from('competitions').delete().eq('id', comp.id) // events/attendees cascade
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users) if (ALL.includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}

async function main() {
  await cleanup()
  const adminId = await mkUser(ADMIN)
  await admin.from('user_roles').insert({ user_id: adminId, role: 'admin' })
  const knownId = await mkUser(KNOWN)
  const { data: comp } = await admin.from('competitions').insert({ name: COMP, scope: 'city', metro: 'ImpMetro', status: 'live' }).select('id').single()
  const { data: ev } = await admin.from('events').insert({ competition_id: comp.id, title: 'Import Night', status: 'published' }).select('id').single()

  // CSV with a quoted comma in a name + dollar amounts + a missing-qty row.
  const csv = [
    'order_id,email,name,ticket_type,qty,amount',
    `POSH-1,${KNOWN},"Lee, Jordan",VIP,2,75.00`,
    'POSH-2,stranger@nowhere.test,Walk In,GA,,25',
  ].join('\n')
  const rows = mapRows(csv)
  check('parser handles quoted comma in name', rows[0].name === 'Lee, Jordan', rows[0].name)
  check('dollars converted to cents', rows[0].amount === 7500 && rows[1].amount === 2500, JSON.stringify(rows.map((r) => r.amount)))
  check('missing qty defaults to 1', rows[1].qty === 1, String(rows[1].qty))

  // Non-admin cannot import.
  const known = await signIn(KNOWN)
  const deny = await known.rpc('import_event_attendees', { _event_id: ev.id, _source: 'posh_vip', _rows: rows })
  check('non-admin import denied', !!deny.error, deny.error?.message || 'no error!')

  // Admin imports.
  const adminC = await signIn(ADMIN)
  const { data: n1, error: impErr } = await adminC.rpc('import_event_attendees', { _event_id: ev.id, _source: 'posh_vip', _rows: rows })
  check('admin import returns count', !impErr && n1 === 2, impErr?.message || `n ${n1}`)
  const { data: matched } = await admin.from('event_attendees').select('profile_id,amount,qty').eq('event_id', ev.id).eq('external_ref', 'POSH-1').single()
  check('known email matched to profile', matched.profile_id === knownId)
  check('amount + qty persisted', matched.amount === 7500 && matched.qty === 2)
  const { data: unmatched } = await admin.from('event_attendees').select('profile_id').eq('external_ref', 'POSH-2').single()
  check('unknown email unmatched', unmatched.profile_id === null)

  // Re-import is idempotent.
  await adminC.rpc('import_event_attendees', { _event_id: ev.id, _source: 'posh_vip', _rows: rows })
  const { data: all } = await admin.from('event_attendees').select('id').eq('event_id', ev.id)
  check('re-import does not duplicate', all.length === 2, `count ${all.length}`)

  await cleanup()
  const pass = results.filter((r) => r.pass).length
  console.log('\nATTENDEE IMPORT TEST\n====================')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  console.log('--------------------')
  console.log(`${pass}/${results.length} passed${pass === results.length ? ' — all green' : ''}`)
  process.exit(pass === results.length ? 0 : 1)
}

main().catch((e) => { console.error('\nTest error:', e.message); process.exit(2) })
