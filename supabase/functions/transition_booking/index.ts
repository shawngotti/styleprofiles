// Batch 7 — transition_booking Edge Function.
// Wraps the public.transition_booking() state machine. Runs with the caller's
// JWT. Batch 8 extends this to capture/refund the Stripe deposit based on the
// returned deposit_outcome.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const ACTIONS = ['confirm', 'complete', 'no_show', 'cancel']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing Authorization header' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

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

  const { data, error } = await supabase.rpc('transition_booking', {
    _booking_id: booking_id,
    _action: action,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ result: data }, 200)
})
