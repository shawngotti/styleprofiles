// One-off QA fixture for visual review of the new pro/admin screens (dev only).
// Creates a pro+admin login with a complete profile, reviews (incl. photos +
// a flagged one), profile views, and a conversion. Prints the credentials.
// Run: node --env-file=.env scripts/qa-setup.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const PW = 'QaPreview-1!'
const PRO = 'qa-pro@styleprofiles.test'
const C1 = 'qa-c1@styleprofiles.test'
const C2 = 'qa-c2@styleprofiles.test'
const img = (id, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

async function reset() {
  for (const u of (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users)
    if ([PRO, C1, C2].includes(u.email)) await admin.auth.admin.deleteUser(u.id)
}
async function mk(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  return data.user.id
}

async function main() {
  await reset()
  const proUid = await mk(PRO)
  const c1 = await mk(C1)
  const c2 = await mk(C2)
  await admin.from('user_roles').insert([{ user_id: proUid, role: 'pro' }, { user_id: proUid, role: 'admin' }])
  await admin.from('profiles').update({ display_name: 'Dom (QA)' }).eq('id', proUid)
  await admin.from('profiles').update({ display_name: 'Maya R.' }).eq('id', c1)
  await admin.from('profiles').update({ display_name: 'Jordan P.' }).eq('id', c2)

  const { data: pro } = await admin.from('pros').insert({
    profile_id: proUid, handle: 'dom.qa', display_name: 'Dom Fades (QA)', category: 'barber', city: 'Louisville, KY',
    bio: 'Master barber specializing in skin fades, beard sculpts, and clean lineups. 10+ years behind the chair.',
    price_from: 4500, charges_enabled: true, verified: true,
    avatar_url: img('1503443207922-dff7d543fd0e', 200),
    cover_url: img('1585747860715-2ba37e788b70', 900),
    gallery_urls: [img('1599351431202-1e0f0137899a'), img('1622286342621-4bd786c2447c'), img('1605497788044-5a32c7078486')],
  }).select('id').single()

  const svc = ['Skin Fade', 'Beard Sculpt', 'Lineup', 'Full Service'].map((name, i) => ({
    pro_id: pro.id, name, duration_min: 30 + i * 10, price: 3500 + i * 1500, deposit: 1000, is_addon: i === 2, active: true, sort: i,
  }))
  await admin.from('services').insert(svc)

  // Completed bookings → reviews.
  const { data: bk1 } = await admin.from('bookings').insert({ client_profile_id: c1, pro_id: pro.id, service_date: '2026-06-01', status: 'completed' }).select('id').single()
  await admin.from('bookings').insert({ client_profile_id: c2, pro_id: pro.id, service_date: '2026-06-05', status: 'completed' })

  // Uniform keys: a mixed-key array insert sends explicit NULLs for absent
  // columns (not their defaults), which trips NOT NULL on verified/photo_urls.
  const rbase = { pro_id: pro.id, booking_id: null, tags: [], photo_urls: [], flagged_labels: [], moderation_reason: null, moderated_at: null, verified: false }
  await admin.from('reviews').insert([
    { ...rbase, author_profile_id: c1, booking_id: bk1.id, rating: 5, body: 'Cleanest fade in the city. Booked again on the spot.', tags: ['On time', 'Skilled', 'Would return'], status: 'approved', verified: true, photo_urls: [img('1622286342621-4bd786c2447c', 400)], moderated_at: new Date().toISOString() },
    { ...rbase, author_profile_id: c2, rating: 4, body: 'Great cut. Visit my site http://promo.example.com for deals!', tags: ['Friendly'], status: 'flagged', flagged_labels: ['spam'], moderation_reason: 'Auto-flagged: spam' },
  ])

  // Profile views + a conversion.
  const views = []
  for (let i = 0; i < 7; i++) views.push({ pro_id: pro.id, viewer_profile_id: i % 2 ? c1 : c2, source: 'discover', booked: i === 0 })
  views.push({ pro_id: pro.id, viewer_profile_id: null, source: 'direct', booked: false })
  await admin.from('profile_views').insert(views)

  console.log('\nQA fixture ready (dev). Sign in at the preview:')
  console.log(`  email:    ${PRO}`)
  console.log(`  password: ${PW}`)
  console.log('  roles:    pro + admin · pro handle @dom.qa\n')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
