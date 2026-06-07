// Batch 8 ticket 4 — Stripe webhook handler (authoritative reconciler).
// Stripe pushes events here; we mirror its truth into the DB. This endpoint is
// public (verify_jwt = false) and instead authenticates each request by
// verifying the Stripe-Signature against STRIPE_WEBHOOK_SECRET.
//
// Handled events:
//   payment_intent.succeeded  -> booking 'pending' becomes 'confirmed'
//   payment_intent.payment_failed -> (left pending; client can retry)
//   account.updated           -> sync pros.charges_enabled / payouts_enabled

import { serviceClient } from '../_shared/util.ts'

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const encoder = new TextEncoder()

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time-ish string compare.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verify(rawBody: string, sigHeader: string | null): Promise<boolean> {
  if (!sigHeader) return false
  const parts = Object.fromEntries(sigHeader.split(',').map((kv) => kv.split('=')))
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${t}.${rawBody}`))
  return safeEqual(hex(mac), v1)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const raw = await req.text()
  const ok = await verify(raw, req.headers.get('stripe-signature'))
  if (!ok) return new Response('invalid signature', { status: 400 })

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response('bad payload', { status: 400 })
  }

  const svc = serviceClient()
  const obj = event.data.object

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const bookingId = (obj.metadata as Record<string, string> | undefined)?.booking_id
        if (bookingId) {
          await svc.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId).eq('status', 'pending')
        }
        break
      }
      case 'account.updated': {
        const acctId = obj.id as string
        await svc
          .from('pros')
          .update({ charges_enabled: !!obj.charges_enabled, payouts_enabled: !!obj.payouts_enabled })
          .eq('stripe_account_id', acctId)
        break
      }
      default:
        // Acknowledge unhandled events so Stripe stops retrying.
        break
    }
  } catch (e) {
    // Returning 500 makes Stripe retry; log the reason.
    return new Response(`handler error: ${(e as Error).message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
