// Batch 8 — transition_booking Edge Function (now moves money).
// Runs the state machine (public.transition_booking), then acts on the deposit:
//   - 'released'  (valid/pro cancel)        -> refund the PaymentIntent
//   - 'forfeited' (no-show / late cancel)   -> keep (already captured)
//   - 'applied'   (completion)              -> keep (applies to total)
// Deposits are captured immediately at booking, so only 'released' needs Stripe.
// For destination charges, the transfer + platform fee are also reversed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors, json, stripe, serviceClient } from '../_shared/util.ts'

const ACTIONS = ['confirm', 'complete', 'no_show', 'cancel']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const { booking_id, action } = body ?? {}
  if (!booking_id || !ACTIONS.includes(action as string)) {
    return json({ error: `booking_id and action (${ACTIONS.join(', ')}) are required` }, 400)
  }

  // 1) State machine (authorization + valid transition + deposit_outcome).
  const { data, error } = await supabase.rpc('transition_booking', { _booking_id: booking_id, _action: action })
  if (error) return json({ error: error.message }, 400)

  // 2) Money: refund only when the deposit is released and was actually paid.
  let refunded = false
  if (data?.deposit_outcome === 'released') {
    const svc = serviceClient()
    const { data: bk } = await svc
      .from('bookings')
      .select('stripe_payment_intent_id')
      .eq('id', data.id)
      .single()
    if (bk?.stripe_payment_intent_id) {
      try {
        const pi = await stripe(`payment_intents/${bk.stripe_payment_intent_id}`)
        if (pi.status === 'succeeded') {
          const params: Record<string, string> = { payment_intent: bk.stripe_payment_intent_id }
          if (pi.transfer_data) {
            // destination charge — pull the deposit back from the connected account + platform fee
            params['reverse_transfer'] = 'true'
            params['refund_application_fee'] = 'true'
          }
          await stripe('refunds', 'POST', params)
          refunded = true
        }
      } catch (e) {
        // The status change already committed; surface the refund issue without failing it.
        return json({ result: data, refunded: false, refund_error: (e as Error).message }, 200)
      }
    }
  }

  return json({ result: data, refunded }, 200)
})
