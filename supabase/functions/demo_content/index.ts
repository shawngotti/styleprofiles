// Admin-only demo content engine. action: 'seed' | 'clear'.
//  - seed: wipes any prior demo data, then creates a believable, photo-rich
//    dataset (pros + services + reviews, an Awards cycle with nominees, a Lineup
//    bracket with an open fan vote, Fill-My-Chair deals, and Shop products) — all
//    flagged is_demo=true and owned by demo auth users (@styleprofiles.demo).
//  - clear: removes all demo rows + demo auth users.
// Visibility is controlled per-aspect by the demo_* toggles (see the migration);
// seeding does NOT flip them on — the admin does that from the Demo tab.

import { cors, json, serviceClient, getUser } from '../_shared/util.ts'

const img = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`
const DEMO_PW = 'Demo-Tour-2026!'

const PROS = [
  { handle: 'dre.carter', name: 'Dre Carter', cat: 'barber', city: 'Chicago, IL', price: 4500, bio: 'Skin fades, beard sculpting, and clean lineups. 9 years behind the chair.',
    cover: '1503951914875-452162b0f3f1', avatar: '1585747860715-2ba37e788b70', gallery: ['1521590832167-7bcbfaa6381f', '1522335789203-aabd1fc54bc9', '1599351431202-1e0f0137899a'],
    services: [['Signature Fade', 4500, 2000, 45], ['Beard Sculpt', 2500, 1000, 30]] },
  { handle: 'marcus.lee', name: 'Marcus Lee', cat: 'barber', city: 'Atlanta, GA', price: 4000, bio: 'Precision cuts and hot-towel shaves. Walk-ins welcome by request.',
    cover: '1521590832167-7bcbfaa6381f', avatar: '1522335789203-aabd1fc54bc9', gallery: ['1503951914875-452162b0f3f1', '1585747860715-2ba37e788b70'],
    services: [['Classic Cut', 4000, 1500, 40], ['Hot Towel Shave', 3000, 1000, 35]] },
  { handle: 'bianca.rae', name: 'Bianca Rae', cat: 'stylist', city: 'Chicago, IL', price: 7000, bio: 'Color, balayage, and silk presses. Healthy hair, bold looks.',
    cover: '1560066984-138dadb4c035', avatar: '1562322140-8baeececf3df', gallery: ['1580618672591-eb180b1a973f', '1560066984-138dadb4c035'],
    services: [['Cut & Style', 7000, 3000, 60], ['Full Color', 12000, 5000, 120]] },
  { handle: 'nina.park', name: 'Nina Park', cat: 'nail', city: 'Atlanta, GA', price: 5000, bio: 'Gel art, structured manis, and the cleanest cuticle work in the city.',
    cover: '1633681926022-84c23e8cb2d6', avatar: '1556760544-74068565f05c', gallery: ['1556760544-74068565f05c', '1633681926022-84c23e8cb2d6'],
    services: [['Gel Manicure', 5000, 2000, 50], ['Full Set', 8000, 3000, 75]] },
  { handle: 'lola.vance', name: 'Lola Vance', cat: 'lash', city: 'Chicago, IL', price: 9000, bio: 'Wispy volume sets and lash lifts that last. Eyes open, looking fresh.',
    cover: '1595476108010-b4d1f102b1b1', avatar: '1487412947147-5cebf100ffc2', gallery: ['1595476108010-b4d1f102b1b1', '1487412947147-5cebf100ffc2'],
    services: [['Classic Set', 9000, 4000, 90], ['Volume Fill', 6000, 2500, 60]] },
  { handle: 'theo.brooks', name: 'Theo Brooks', cat: 'makeup', city: 'Atlanta, GA', price: 8000, bio: 'Soft glam to full beat — editorial-trained, bridal specialist.',
    cover: '1580618672591-eb180b1a973f', avatar: '1599351431202-1e0f0137899a', gallery: ['1487412947147-5cebf100ffc2', '1580618672591-eb180b1a973f'],
    services: [['Soft Glam', 8000, 3000, 60], ['Bridal', 18000, 8000, 120]] },
]

const REVIEWS = [
  [5, 'Cleanest fade I have ever had. Booking + deposit made it effortless.'],
  [5, 'On time, professional, and the result speaks for itself. Rebooked already.'],
  [4, 'Great work and easy to book. Will be back.'],
]

const PRODUCTS = [
  ['Matte Clay Pomade', 'Studio Grade', 'hair', 2200, 'Strong hold, no shine.'],
  ['Daily Beard Oil', 'Studio Grade', 'beard', 1800, 'Argan + jojoba, unscented.'],
  ['Cuticle Repair Oil', 'Polished', 'nails', 1400, 'Vitamin-E nail treatment.'],
  ['Brightening Cleanser', 'Glow Lab', 'skin', 2600, 'Gentle daily foaming wash.'],
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)
  const user = await getUser(authHeader)
  if (!user) return json({ error: 'invalid session' }, 401)

  const svc = serviceClient()
  const { data: adminRole } = await svc.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
  if (!adminRole) return json({ error: 'admins only' }, 403)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* ignore */ }
  const action = body.action

  // ---- clear helper ----
  async function clearAll() {
    await svc.from('competitions').delete().eq('is_demo', true) // cascades contestants/rounds/matchups/windows
    await svc.from('award_cycles').delete().eq('is_demo', true)
    await svc.from('chair_promotions').delete().eq('is_demo', true)
    await svc.from('products').delete().eq('is_demo', true)
    await svc.from('pros').delete().eq('is_demo', true) // cascades services/reviews/bookings
    // Remove demo auth users (@styleprofiles.demo) → cascades their profiles.
    const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of list.users) if (u.email?.endsWith('@styleprofiles.demo')) await svc.auth.admin.deleteUser(u.id)
  }

  if (action === 'clear') {
    await clearAll()
    return json({ ok: true, cleared: true })
  }
  if (action !== 'seed') return json({ error: "action must be 'seed' or 'clear'" }, 400)

  // ---- seed (idempotent: clear first) ----
  await clearAll()

  async function mkUser(email: string) {
    const { data, error } = await svc.auth.admin.createUser({ email, password: DEMO_PW, email_confirm: true })
    if (error) throw new Error(`user ${email}: ${error.message}`)
    return data.user.id
  }

  // Demo clients power reviews + votes.
  const clientIds: string[] = []
  for (let i = 1; i <= 4; i++) clientIds.push(await mkUser(`demo-client-${i}@styleprofiles.demo`))

  const proRows: { id: string; cat: string; city: string }[] = []
  for (const p of PROS) {
    const uid = await mkUser(`demo-${p.handle}@styleprofiles.demo`)
    const { data: pro, error } = await svc.from('pros').insert({
      profile_id: uid, handle: p.handle, display_name: p.name, category: p.cat, city: p.city,
      bio: p.bio, price_from: p.price, verified: true, charges_enabled: true, is_demo: true,
      avatar_url: img(p.avatar, 300), cover_url: img(p.cover, 1200), gallery_urls: p.gallery.map((g) => img(g, 700)),
    }).select('id').single()
    if (error) return json({ error: `pro ${p.handle}: ${error.message}` }, 400)
    proRows.push({ id: pro.id, cat: p.cat, city: p.city })

    await svc.from('services').insert(p.services.map(([name, price, deposit, dur], i) => ({
      pro_id: pro.id, name, price, deposit, duration_min: dur, is_addon: false, active: true, sort: i,
    })))
    // Reviews (rating cache is recomputed by trigger).
    await svc.from('reviews').insert(REVIEWS.map(([rating, b], i) => ({
      pro_id: pro.id, author_profile_id: clientIds[i % clientIds.length], rating, body: b,
    })))
  }

  // ---- Awards: a voting cycle with each demo pro as an approved nominee ----
  // Mid-month period avoids colliding with real first-of-month cycles; best-effort.
  const now = Date.now()
  const { data: cycle } = await svc.from('award_cycles').insert({
    period: '2026-06-15', status: 'voting', is_demo: true,
    opens_at: new Date(now - 5 * 86400000).toISOString(), closes_at: new Date(now + 20 * 86400000).toISOString(),
  }).select('id').maybeSingle()
  if (cycle) {
    await svc.from('award_submissions').insert(proRows.map((p) => ({
      cycle_id: cycle.id, category: p.cat, pro_id: p.id, look_label: 'Signature look', status: 'approved',
    })))
  }

  // ---- The Lineup: a small demo bracket + an open fan-favorite vote ----
  const { data: comp } = await svc.from('competitions').insert({
    name: 'Spring Showdown · Chicago', scope: 'city', metro: 'Chicago, IL', status: 'live', is_demo: true,
  }).select('id').maybeSingle()
  if (comp) {
    const four = proRows.slice(0, 4)
    const conIds: string[] = []
    for (let i = 0; i < four.length; i++) {
      const { data: c } = await svc.from('contestants').insert({ competition_id: comp.id, pro_id: four[i].id, seed: i + 1, status: 'active' }).select('id').maybeSingle()
      if (c) conIds.push(c.id)
    }
    const { data: round } = await svc.from('competition_rounds').insert({ competition_id: comp.id, name: 'Semifinal', round_order: 1, status: 'live' }).select('id').maybeSingle()
    if (round && conIds.length === 4) {
      await svc.from('matchups').insert([
        { round_id: round.id, contestant_a: conIds[0], contestant_b: conIds[3], status: 'live' },
        { round_id: round.id, contestant_a: conIds[1], contestant_b: conIds[2], status: 'live' },
      ])
    }
    await svc.from('voting_windows').insert({
      competition_id: comp.id, vote_type: 'fan_favorite', status: 'open',
      opens_at: new Date(now - 86400000).toISOString(), closes_at: new Date(now + 6 * 86400000).toISOString(),
    })
  }

  // ---- Fill My Chair deals ----
  const dealPros = proRows.slice(0, 2)
  for (const p of dealPros) {
    const { data: svcRow } = await svc.from('services').select('id').eq('pro_id', p.id).limit(1).single()
    await svc.from('chair_promotions').insert({
      pro_id: p.id, service_id: svcRow.id, slot_at: new Date(now + 2 * 86400000).toISOString(),
      slot_label: 'This Saturday', expires_at: new Date(now + 6 * 3600000).toISOString(),
      promo_type: 'cancellation', discount_pct: 15, audience: 'loyalty', status: 'open', is_demo: true,
    })
  }

  // ---- Shop products ----
  await svc.from('products').insert(PRODUCTS.map(([name, brand, category, price, blurb]) => ({
    name, brand, category, price, blurb, is_available: true, inventory_qty: 25, is_demo: true,
  })))

  return json({ ok: true, seeded: { pros: proRows.length, clients: clientIds.length } }, 201)
})
