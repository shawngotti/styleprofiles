import { supabase } from './supabaseClient.js'

// Optional error-monitoring sink (Sentry or any provider). main.jsx loads + sets
// it only when VITE_SENTRY_DSN is configured, so there's zero cost otherwise.
let _monitor = null
export function setErrorMonitor(m) {
  _monitor = m
}

// Fire-and-forget analytics. Writes to the analytics_events table (RLS lets a
// user append only their own events). Never throws into the caller — analytics
// must not break a user flow. Swap this sink for a provider later; call sites
// (track('event', props)) stay the same.
export async function track(event, props = {}) {
  try {
    const { data } = await supabase.auth.getUser()
    await supabase.from('analytics_events').insert({
      profile_id: data?.user?.id ?? null,
      event,
      props,
    })
  } catch {
    /* swallow — analytics is best-effort */
  }
}

// Report a client-side error to the same log (provider-agnostic). Wire a real
// monitoring SDK (e.g. Sentry) here later; call sites stay unchanged.
export function reportError(error, context = {}) {
  try {
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context)
    if (_monitor) _monitor.captureException(error, { extra: context })
    track('client_error', {
      message: String(error?.message || error),
      stack: String(error?.stack || '').slice(0, 2000),
      ...context,
    })
  } catch {
    /* best-effort */
  }
}
