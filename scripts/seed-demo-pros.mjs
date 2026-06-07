// Batch 7 — seed demo pros + services (integer cents).
// Creates 8 demo pro accounts (no password; cannot sign in), each with the
// 'pro' role, a pros storefront, its services, and category add-ons.
// Mirrors the prototype's PROS seed so the Discover screen has live data.
// Run:  node --env-file=.env scripts/seed-demo-pros.mjs   (re-runnable)

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')

const DEMO_DOMAIN = '@demo.styleprofiles.app'
const c = (dollars) => Math.round(dollars * 100) // dollars -> integer cents

// Approximate coordinates per demo city (for geographic search).
const CITY_COORDS = {
  'Chicago, IL': [41.8781, -87.6298],
  'Atlanta, GA': [33.749, -84.388],
  'Houston, TX': [29.7604, -95.3698],
  'Newark, NJ': [40.7357, -74.1724],
  'Jersey City, NJ': [40.7178, -74.0431],
  'Brooklyn, NY': [40.6782, -73.9442],
  'Miami, FL': [25.7617, -80.1918],
  'Philadelphia, PA': [39.9526, -75.1652],
}

const ADDONS = {
  barber: [{ name: 'Beard oil finish', min: 5, price: 12, dep: 0 }, { name: 'Hot towel', min: 5, price: 8, dep: 0 }, { name: 'Hairline design', min: 10, price: 15, dep: 5 }],
  stylist: [{ name: 'Deep condition', min: 15, price: 25, dep: 0 }, { name: 'Ends trim', min: 10, price: 15, dep: 0 }],
  braider: [{ name: 'Scalp treatment', min: 10, price: 20, dep: 0 }, { name: 'Beads & cuffs', min: 10, price: 15, dep: 0 }],
  loctician: [{ name: 'Scalp detox', min: 15, price: 20, dep: 0 }, { name: 'Loc jewelry', min: 5, price: 12, dep: 0 }],
  nail: [{ name: 'Chrome finish', min: 10, price: 12, dep: 0 }, { name: 'Nail art (2)', min: 10, price: 15, dep: 5 }],
  lash: [{ name: 'Lash bath', min: 10, price: 15, dep: 0 }, { name: 'Bottom lashes', min: 15, price: 25, dep: 0 }],
  makeup: [{ name: 'Strip lashes', min: 5, price: 15, dep: 0 }, { name: 'Touch-up kit', min: 0, price: 20, dep: 0 }],
  colorist: [{ name: 'Bond treatment', min: 15, price: 30, dep: 0 }, { name: 'Gloss top-off', min: 20, price: 35, dep: 0 }],
}

const PROS = [
  { handle: 'dre.thebarber', name: 'Dre Carter', cat: 'barber', rating: 4.9, reviews: 312, city: 'Chicago, IL', from: 45,
    bio: 'Skin fades, beard sculpting, enhancements. 9 years behind the chair. Walk-ins by request.',
    services: [{ name: 'Signature Fade', min: 45, price: 45, dep: 15 }, { name: 'Fade + Beard', min: 60, price: 65, dep: 20 }, { name: 'Kids Cut (12 & under)', min: 30, price: 30, dep: 10 }, { name: 'Line-Up / Edge', min: 20, price: 20, dep: 5 }] },
  { handle: 'imani.silkpress', name: 'Imani Brooks', cat: 'stylist', rating: 5.0, reviews: 198, city: 'Atlanta, GA', from: 80,
    bio: 'Silk presses, healthy-hair styling, special-occasion looks. Consultations included.',
    services: [{ name: 'Silk Press', min: 90, price: 95, dep: 30 }, { name: 'Wash & Style', min: 60, price: 70, dep: 20 }, { name: 'Bridal / Event', min: 120, price: 180, dep: 60 }] },
  { handle: 'knotbynia', name: 'Nia Osei', cat: 'braider', rating: 4.8, reviews: 421, city: 'Houston, TX', from: 120,
    bio: 'Knotless braids, boho, feed-ins, kids styles. Hair included on most styles.',
    services: [{ name: 'Knotless — Medium', min: 240, price: 180, dep: 60 }, { name: 'Boho Knotless', min: 300, price: 230, dep: 70 }, { name: 'Feed-in Cornrows', min: 120, price: 90, dep: 30 }] },
  { handle: 'valeloc', name: 'Marcus Vale', cat: 'loctician', rating: 4.9, reviews: 156, city: 'Newark, NJ', from: 70,
    bio: 'Starter locs, retwists, loc repair and styling. Healthy scalp first.',
    services: [{ name: 'Retwist + Style', min: 90, price: 85, dep: 25 }, { name: 'Starter Locs', min: 150, price: 140, dep: 40 }, { name: 'Loc Detox', min: 75, price: 75, dep: 20 }] },
  { handle: 'priya.nails', name: 'Priya Sharma', cat: 'nail', rating: 4.95, reviews: 503, city: 'Jersey City, NJ', from: 55,
    bio: 'Structured gel, hand-painted art, builder gel overlays. Designs welcome.',
    services: [{ name: 'Gel-X Full Set', min: 90, price: 75, dep: 20 }, { name: 'Builder Gel Overlay', min: 60, price: 60, dep: 15 }, { name: 'Custom Nail Art (set)', min: 120, price: 110, dep: 35 }] },
  { handle: 'lashedbysasha', name: 'Sasha Lin', cat: 'lash', rating: 4.85, reviews: 244, city: 'Brooklyn, NY', from: 90,
    bio: 'Volume & hybrid lash sets, lash lifts. Retention-focused application.',
    services: [{ name: 'Hybrid Full Set', min: 120, price: 130, dep: 40 }, { name: 'Mega Volume', min: 150, price: 165, dep: 50 }, { name: 'Lash Lift + Tint', min: 75, price: 90, dep: 25 }] },
  { handle: 'belbeatface', name: 'Bel Aguilar', cat: 'makeup', rating: 4.9, reviews: 187, city: 'Miami, FL', from: 110,
    bio: 'Soft glam, editorial, bridal. Skin-first, long-wear application.',
    services: [{ name: 'Soft Glam', min: 75, price: 110, dep: 35 }, { name: 'Full Glam + Lashes', min: 90, price: 140, dep: 45 }, { name: 'Bridal Trial', min: 120, price: 180, dep: 60 }] },
  { handle: 'theocolor', name: 'Theo Banks', cat: 'colorist', rating: 4.8, reviews: 132, city: 'Philadelphia, PA', from: 150,
    bio: 'Balayage, vivids, color correction. Bond-building on every service.',
    services: [{ name: 'Balayage + Gloss', min: 180, price: 200, dep: 70 }, { name: 'Root Touch-Up', min: 90, price: 95, dep: 30 }, { name: 'Vivid / Fashion Color', min: 240, price: 260, dep: 90 }] },
]

// A small pool of recent reviews; each pro gets two (authored by demo clients).
const REVIEW_POOL = [
  { rating: 5, body: 'Clean work, exactly what I asked for. Booking was seamless.', tags: ['On time', 'Clean space'] },
  { rating: 5, body: 'Took their time and the result speaks for itself. Worth every dollar.', tags: ['Great detail'] },
  { rating: 4, body: 'Solid experience — ran a few minutes behind but really happy with it.', tags: [] },
  { rating: 5, body: 'The deposit made it painless and they nailed the look. Rebooking already.', tags: ['Easy booking'] },
]
const REVIEWERS = ['reviewer1', 'reviewer2', 'reviewer3']

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  // Clean slate: delete existing demo pro users (cascades pros + services).
  const { data: list, error: lerr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lerr) throw lerr
  let removed = 0
  for (const u of list.users) {
    if ((u.email || '').endsWith(DEMO_DOMAIN)) {
      await admin.auth.admin.deleteUser(u.id)
      removed++
    }
  }
  console.log(`Removed ${removed} existing demo pro user(s).`)

  // Demo client reviewers (default 'client' role from the signup trigger).
  const reviewerIds = []
  for (const r of REVIEWERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${r}${DEMO_DOMAIN}`,
      email_confirm: true,
      user_metadata: { display_name: r.replace(/\d+$/, ' ' + r.slice(-1)) },
    })
    if (error) throw new Error(`reviewer ${r}: ${error.message}`)
    reviewerIds.push(data.user.id)
  }

  let proCount = 0
  let svcCount = 0
  let reviewCount = 0
  for (const p of PROS) {
    const email = `${p.handle}${DEMO_DOMAIN}`
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: p.name },
    })
    if (cerr) throw new Error(`createUser ${email}: ${cerr.message}`)
    const profileId = created.user.id

    const { error: rerr } = await admin.from('user_roles').insert({ user_id: profileId, role: 'pro' })
    if (rerr) throw new Error(`role ${email}: ${rerr.message}`)

    const { data: proRow, error: perr } = await admin
      .from('pros')
      .insert({
        profile_id: profileId,
        handle: p.handle,
        display_name: p.name,
        category: p.cat,
        bio: p.bio,
        city: p.city,
        verified: true,
        rating_avg: p.rating,
        rating_count: p.reviews,
        price_from: c(p.from),
        latitude: (CITY_COORDS[p.city] || [null, null])[0],
        longitude: (CITY_COORDS[p.city] || [null, null])[1],
      })
      .select('id')
      .single()
    if (perr) throw new Error(`pro ${p.handle}: ${perr.message}`)

    const rows = []
    p.services.forEach((s, i) =>
      rows.push({ pro_id: proRow.id, name: s.name, duration_min: s.min, price: c(s.price), deposit: c(s.dep), is_addon: false, sort: i }),
    )
    ;(ADDONS[p.cat] || []).forEach((s, i) =>
      rows.push({ pro_id: proRow.id, name: s.name, duration_min: s.min, price: c(s.price), deposit: c(s.dep), is_addon: true, sort: 100 + i }),
    )
    const { error: serr } = await admin.from('services').insert(rows)
    if (serr) throw new Error(`services ${p.handle}: ${serr.message}`)
    svcCount += rows.length

    // Two recent reviews per pro, by two different demo reviewers.
    const reviewRows = [0, 1].map((k) => {
      const r = REVIEW_POOL[(proCount + k) % REVIEW_POOL.length]
      return {
        pro_id: proRow.id,
        author_profile_id: reviewerIds[(proCount + k) % reviewerIds.length],
        rating: r.rating,
        body: r.body,
        tags: r.tags,
        verified: true,
      }
    })
    const { error: rverr } = await admin.from('reviews').insert(reviewRows)
    if (rverr) throw new Error(`reviews ${p.handle}: ${rverr.message}`)
    reviewCount += reviewRows.length

    proCount++
    console.log(`  seeded ${p.name} (${p.cat}) — ${rows.length} services, ${reviewRows.length} reviews`)
  }

  console.log(`\nDone: ${proCount} pros, ${svcCount} services, ${reviewCount} reviews (prices in integer cents).`)
}

main().catch((e) => {
  console.error('\nSeed error:', e.message)
  process.exit(1)
})
