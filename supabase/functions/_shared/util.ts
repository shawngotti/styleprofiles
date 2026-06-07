// Shared helpers for the Batch 8 payment Edge Functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Minimal Stripe REST client (form-encoded). Throws on non-2xx.
// Pass `account` to act on a connected account (Stripe-Account header).
export async function stripe(path: string, method = 'GET', params?: Record<string, string>, account?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (account) headers['Stripe-Account'] = account
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${path} failed`)
  return data
}

// Service-role client (bypasses RLS) — used to mirror Stripe's truth into the DB.
export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

// Resolve the authenticated user from the caller's JWT.
export async function getUser(authHeader: string) {
  const c = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data, error } = await c.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

// Feature-flag check (§4.9). Flags gate the API too: a disabled feature's
// endpoints must reject. Pass a service client to read platform_settings.
// deno-lint-ignore no-explicit-any
export async function featureEnabled(svc: any, key: string): Promise<boolean> {
  const { data } = await svc.from('platform_settings').select('value').eq('key', key).maybeSingle()
  return data?.value === true
}
