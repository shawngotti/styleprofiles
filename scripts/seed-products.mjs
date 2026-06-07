// Batch 10 — seed a few self-care products for the marketplace demo.
// Run after the schema (product_categories are seeded there). Idempotent on name.
// Note: the catalog is hidden until marketplace_on is flipped true.
// Run: node --env-file=.env scripts/seed-products.mjs

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) throw new Error('Missing env vars in .env')

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const PRODUCTS = [
  { name: 'Matte Clay Pomade', brand: 'Studio Grade', category: 'hair', price: 2200, blurb: 'Strong hold, no shine.', inventory_qty: 40 },
  { name: 'Daily Beard Oil', brand: 'Studio Grade', category: 'beard', price: 1800, blurb: 'Argan + jojoba, unscented.', inventory_qty: 25 },
  { name: 'Cooling Aftershave', brand: 'Barber Reserve', category: 'beard', price: 1600, blurb: 'Alcohol-free, soothes the cut.', inventory_qty: 30 },
  { name: 'Brightening Face Cleanser', brand: 'Glow Lab', category: 'skin', price: 2600, blurb: 'Gentle daily foaming wash.', inventory_qty: null },
  { name: 'Cuticle Repair Oil', brand: 'Polished', category: 'nails', price: 1400, blurb: 'Vitamin-E nail + cuticle treatment.', inventory_qty: 50 },
  { name: 'Carbon Fade Comb', brand: 'EdgeWorks', category: 'tools', price: 900, blurb: 'Heat-resistant, anti-static.', inventory_qty: 0 },
]

async function main() {
  let n = 0
  for (const p of PRODUCTS) {
    const { data: existing } = await admin.from('products').select('id').eq('name', p.name).maybeSingle()
    if (existing) {
      await admin.from('products').update(p).eq('id', existing.id)
    } else {
      const { error } = await admin.from('products').insert({ ...p, is_available: true })
      if (error) throw new Error(`${p.name}: ${error.message}`)
    }
    n++
  }
  console.log(`Seeded ${n} products. Flip marketplace_on=true to surface them.`)
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
