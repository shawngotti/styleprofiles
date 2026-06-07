# StyleProfiles — Analytics & Success Metrics

Events are written to `public.analytics_events` via `track(event, props)`
(`src/lib/analytics.js`). The sink is self-hosted (in-stack with Supabase); swap
it for a provider later without changing call sites. Reads are admin-only (RLS).

## Event catalog (instrumented)

| Event | Where | Key props | Funnel stage |
|---|---|---|---|
| `signup` | LoginScreen | `method` | Acquisition |
| `legal_accepted` | LegalGate | `tos`, `privacy` | Activation |
| `pro_profile_open` | AuthedHome (Discover + Lineup) | `pro_id`, `source` | Consideration |
| `award_vote` | Awards | `submission_id` | Engagement |
| `order_placed` | Shop | `order_id`, `total` | Marketplace revenue |
| `ticket_purchased` | EventTickets | `attendee_id`, `total` | Events revenue |
| `client_error` | ErrorBoundary / reportError | `message`, `stack` | Reliability |

## Success metrics (the questions these answer)

- **Contestant-profile conversion** (the Lineup's headline metric): of
  `pro_profile_open` with `source='lineup'`, how many lead to a booking? Join to
  bookings by `pro_id` + user within a window. → measures whether The Lineup
  drives real top-of-funnel acquisition.
- **Activation rate:** `signup` → `legal_accepted` → first `pro_profile_open`.
- **Marketplace / events revenue:** sum of `order_placed.total` /
  `ticket_purchased.total` (cross-check against the authoritative `orders` /
  `event_attendees` ledgers — analytics is directional, the ledgers are truth).
- **Reliability:** `client_error` rate per session.

## Adding an event

`import { track } from '../lib/analytics.js'` then
`track('event_name', { ...props })`. Keep names `snake_case`, put IDs/amounts in
props, never PII beyond IDs. `track` never throws into the caller.

## Next (not yet instrumented)

`booking_created`, `membership_subscribed`, `fan_vote`, `cotw_entry_submitted`,
and server-side events (Edge Functions can insert with the service role). Add as
funnels mature.
