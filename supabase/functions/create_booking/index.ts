// Batch 7 — create_booking Edge Function.
// Thin, server-authoritative wrapper over the atomic public.create_booking()
// SQL function. Runs with the CALLER'S JWT so RLS + auth.uid() apply.
// Batch 8 extends this to create the Stripe deposit PaymentIntent.

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

  const { pro_id, service_date, start_time = null, items } = body ?? {}
  if (!pro_id || !service_date || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'pro_id, service_date, and a non-empty items array are required' }, 400)
  }

  const { data: bookingId, error } = await supabase.rpc('create_booking', {
    _pro_id: pro_id,
    _service_date: service_date,
    _start_time: start_time,
    _items: items,
  })
  if (error) return json({ error: error.message }, 400)

  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select(
      'id,pro_id,status,service_date,start_time,service_total,deposit_total,' +
        'booking_line_items(service_name,price,deposit,duration_min,scheduled_at,is_addon,sort)',
    )
    .eq('id', bookingId)
    .order('sort', { foreignTable: 'booking_line_items', ascending: true })
    .single()

  if (fetchErr) return json({ booking_id: bookingId, warning: fetchErr.message }, 201)
  return json({ booking }, 201)
})
