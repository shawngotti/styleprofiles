# StyleProfiles — Technical Architecture & Build Backlog

**Purpose.** This is the bridge between what's been designed (the clickable prototype + the `styleprofiles_schema.sql` foundation) and the production build. It pins down *where each piece of logic lives*, specifies the engines that must be built correctly the first time, and breaks the remaining work into ordered, Claude Code–ready tickets.

**How to use it.** Hand this to Claude Code (or an engineer) alongside `styleprofiles_schema.sql` and the prototype `StyleProfiles.jsx`. Execute the batches in order; each section's tickets are written to be picked up one at a time.

---

## 1. The two layers

Everything built so far splits cleanly:

- **Prototype (done, in `StyleProfiles.jsx`)** — the entire front-end experience, in-memory and simulated. This is the *spec for the UI* and the source of truth for screens, flows, and interaction design.
- **Production (this doc + schema)** — the real backend: database, auth, server-authoritative logic, payments, scheduled jobs, storage. The prototype's React state gets replaced, screen by screen, with calls to this layer.

The migration path is **screen-by-screen**: keep the prototype's components, swap their `useState` seed data for Supabase queries and Edge Function calls. The visual layer barely changes; the data layer is built underneath it.

---

## 2. Where logic lives (the single most important decision)

The failure mode for an app like this is putting business logic in the browser, where it can be inspected and bypassed. Anything that touches money, points, votes, or eligibility is **server-authoritative**. Use this allocation:

| Concern | Lives in | Why |
|---|---|---|
| Access control (who can read/write what) | **Postgres RLS** (already written) | One enforcement point, can't be bypassed by a malicious client |
| Data integrity (one vote per window, one entry per category) | **Postgres constraints** (already written) | The DB is the last line of defense |
| Derived display data, optimistic UI, form state | **Client (React)** | Cheap, responsive; never authoritative |
| Booking creation, deposit capture, no-show fees | **Edge Function** | Must be atomic and trusted; touches Stripe |
| Loyalty point award/redeem | **Edge Function + ledger table** | Points are currency; never trust a client-sent balance |
| Membership subscribe / benefit application | **Edge Function + Stripe + webhook** | Recurring money |
| Award & Lineup vote writes | **Edge Function** (with DB constraint backstop) | Fraud surface; needs rate limiting + fingerprinting |
| Award/Lineup result computation | **Edge Function**, triggered by **scheduled job** | Weighted, auditable, runs on a clock |
| Monthly cycle open/close, voting windows, weekly challenge | **Scheduled jobs (pg_cron / Supabase cron)** | Time-driven state transitions |
| Payment state (paid, refunded, subscription active) | **Stripe webhooks → Edge Function** | Stripe is the source of truth for money |
| Feature flags (marketplace_on, lineup_on) | **`platform_settings` table**, read on app load, gates **both UI and API** | A hidden feature must be unreachable, not just invisible |

**Rule of thumb:** if a dishonest user could profit by lying to the endpoint, it's an Edge Function with its own validation — RLS is necessary but not sufficient for those.

---

## 3. Auth & roles (Batch 6)

**Approach.** Supabase Auth (email + OAuth). On signup, a trigger creates the `profiles` row and a default `client` role. Becoming a pro or judge adds a row to `user_roles` — a person can hold several roles, which is why roles are a join table, not a column.

**RLS already keys off this** via `has_role()` / `is_admin()` / `owns_pro()`. The only thing Batch 6 adds in SQL is the signup trigger (see Appendix A) and a guarded path for role elevation (a pro applies → admin approves → insert `('pro')` role; never client-self-grantable for `judge`/`admin`).

**Client session model.** The app reads the user's roles once on load and keeps them in context to drive the perspective switcher (Client / Pro / Admin) — but the switcher is a *view convenience*, not a security boundary. Security is RLS + Edge Function checks. A user with only the `client` role who manually hits an admin endpoint is rejected by the server regardless of what the UI shows.

---

## 4. Engine designs (build these exactly)

### 4.1 Booking & deposit engine
- A booking is created in **one transaction**: insert `bookings` (parent) + N `booking_line_items` (per person/per service, services or add-ons), compute back-to-back `scheduled_at` from durations server-side (never trust client times), and create a Stripe PaymentIntent for the **combined deposit**.
- Status flow: `pending` → (deposit captured) `confirmed` → `completed` | `cancelled` | `no_show`.
- **No-show / late-cancel:** an Edge Function checks the 24h rule and the deposit is forfeited (captured) vs released. This is the "deposits saved $X" stat on the pro dashboard — it must come from real captured deposits.
- **Group booking** is just N line items under one parent + one deposit; nothing special beyond the transaction being atomic.
- **Multi-provider** (deferred) would split into multiple `bookings` rows (one per pro) grouped by a shared `group_id`, with deposit split across pros' connected accounts. Add a `booking_group_id` column when you build it.

### 4.2 Loyalty engine
- **Points are a ledger**, never a mutable counter the client sets. `loyalty_transactions` is the source of truth; `profiles.style_points` is a denormalized cache updated by the same Edge Function (or a trigger summing the ledger).
- Earn on `completed` bookings (not on booking creation — prevents farming via book/cancel). Redeem checks `balance >= cost` server-side before writing a negative transaction + a `reward_redemptions` row.
- Tier is derived from lifetime or trailing points; compute it in one place.

### 4.3 Membership engine
- Tiers are pro-authored (`membership_tiers`). Subscribing creates a **Stripe Connect subscription** on the pro's connected account with the platform fee applied, and a `memberships` row mirrors its state.
- **Stripe is the source of truth** for `active` / `past_due` / `cancelled`; the `memberships` row is updated only by the Stripe webhook handler, never optimistically.
- **Benefit application at booking:** when a member books, the booking engine checks for an active membership with that pro and auto-applies included services / member pricing. This is server-side so the discount can't be spoofed.

### 4.4 Monthly Awards engine
- Scoring weights (from the product): **public votes 50% · verified-client votes 20% · performance score 20% · judge review 10%**. Normalize each component to 0–1 across entrants in a category, then weight and sum.
- Cycle state (`submissions` → `voting` → `review` → `complete`) advances on **scheduled jobs**. Winners are written to `award_winners` by the result-computation function (admin can override in the console).
- Constraints already enforce **one submission per pro per category per cycle** and **one vote per category per cycle**. The vote *integrity* layer (§4.7) sits in front of the write.

### 4.5 The Lineup engine
- **Two separate scoring systems — don't conflate with Awards.** Judges score entries on a weighted rubric: **technical 30% · creative 25% · reveal 20% · client_experience 15% · composure 10%** (`scores` table columns). `total` is computed in the Edge Function from the weighted components; never sent by the client.
- **Fans are walled off from outcomes.** Bracket results are 100% judge-decided. Fan votes (`fan_votes`) only drive the **Redemption Wildcard** and **Fan Favorite**. This separation is a product promise and a fraud-surface reducer — enforce it in code, not just convention.
- **Round advancement:** an Edge Function sets `matchups.winner_contestant_id`, flips contestant statuses (`eliminated`/`active`), and seeds the next round. Admin triggers it (Phase 1 is manual advance; later phases automate from scores).
- **Seed-from-rankings:** a function takes top-N pros per metro by rating/bookings and inserts `contestants`. 
- The bracket UI is **public read** for top-of-funnel acquisition (open decision §6 confirmed this is the recommended default).

### 4.6 Payments (Stripe Connect)
- **Onboarding:** each pro completes Stripe Connect Express onboarding (identity, payout bank). Gate "accept bookings" on `charges_enabled`.
- **Deposits:** PaymentIntent on the connected account, `application_fee_amount` = platform cut. Capture on attendance / forfeit rules; refund on valid cancel.
- **Subscriptions:** Connect subscriptions for memberships (§4.3).
- **Marketplace orders:** first-party — charges go to the **platform** account (you're the merchant of record), unlike bookings which route to pros.
- **Prize disbursement (Lineup):** Connect transfer to the champion's account.
- **All money state is reconciled from webhooks**, stored in the `stripe_*` columns already on `bookings` / `orders` / `memberships`.

### 4.7 Vote-integrity layer (shared: Awards + Lineup)
Sits in front of every vote write as an Edge Function:
- **Verified-account gating** (no votes from unverified/just-created accounts).
- **One vote per window** (DB unique constraint is the backstop; check first for a clean error).
- **Per-IP / per-device rate limits** at the edge; capture a device fingerprint.
- **Metro weighting** for city rounds (`weight` column).
- **Admin audit** of anomalous spikes → writes `vote_flags`, surfaced in the moderation console's Vote Integrity tab.

### 4.8 Media & storage
- Supabase Storage buckets: `portfolios`, `award-media`, `lineup-reveals` (before/after), `products`.
- Before/after reveal media for entries **requires a resolved `consent_requests` record** (the Tag & Consent flow) before it can be published — enforce in the publish Edge Function.
- Serve via signed URLs; never make raw buckets public for consented client media.
- If Lineup rounds add video reveals, decide on a transcoding/CDN path early (open decision).

### 4.9 Feature flags
- `platform_settings` is read on app load (cache 1–5 min) and exposed to the client to gate tabs/screens.
- **Critical:** flags gate the **API too**, not just the UI. A disabled feature's Edge Functions reject calls and its RLS-readable data returns empty — so a hidden feature is genuinely unreachable, not just hidden. This is what makes "build it dark, launch later" safe for the marketplace and The Lineup.

---

## 5. Build backlog (ordered, Claude Code–ready)

### Batch 6 — Auth & roles
- [ ] Wire Supabase Auth (email + at least one OAuth provider).
- [ ] `handle_new_user` trigger: create `profiles` + default `client` role on signup (Appendix A).
- [ ] Role-elevation path: pro application → admin approval → insert `pro` role. Lock `judge`/`admin` to admin-only.
- [ ] Client-side auth context exposing session + roles; drive the perspective switcher from it.
- [ ] Smoke-test RLS with three real sessions (client, pro, admin): confirm cross-tenant reads/writes are denied.

### Batch 7 — Core booking backend
- [ ] Migrate Discover + Pro Profile screens to read `pros` / `services` from Supabase.
- [ ] `create_booking` Edge Function: atomic parent + line items, server-computed schedule, deposit PaymentIntent.
- [ ] Booking status transitions + no-show/late-cancel function (deposit capture vs release).
- [ ] Household CRUD (primary holder manages members).
- [ ] **Client "My Appointments" screen** — upcoming + past from `bookings`, with rebook (pre-fills pro+service), cancel/reschedule (deposit/24h rule), and a review prompt on past visits lacking one.
- [ ] **Geographic search** — geocode pro addresses to `pros.latitude/longitude` on save; "use my location" (browser geolocation) + radius filter + sort-by-distance via a distance query (PostGIS `earthdistance`/`ll_to_earth`, or a bounding-box + haversine). Respect `travel_mode` (shop vs mobile) in "near me" semantics.
- [ ] Replace prototype booking state with live data; keep the 6-step UI.

### Batch 8 — Payments (Stripe Connect)
- [ ] Connect Express onboarding flow; gate booking acceptance on `charges_enabled`.
- [ ] Deposit capture/refund with `application_fee_amount`.
- [ ] Membership subscriptions on connected accounts; benefit auto-application in booking engine.
- [ ] Stripe webhook handler → reconcile `bookings` / `memberships` / `orders` money state.
- [ ] Loyalty award-on-completion + redeem Edge Functions (ledger-based).

### Batch 9 — Awards engine
- [ ] Submission flow (media upload + Storage + consent check).
- [ ] Vote write via integrity Edge Function (§4.7).
- [ ] Cycle scheduler (pg_cron): submissions → voting → review → complete.
- [ ] Weighted result computation (50/20/20/10) → `award_winners`; admin override.
- [ ] Notifications on window open/close + results.

### Batch 10 — Marketplace backend (only when launching retail)
- [ ] Product/admin CRUD; inventory tracking.
- [ ] Cart → `orders` / `order_items`; platform-account checkout.
- [ ] Fulfillment/shipping/returns/tax integration (this is the heavy, separable piece).
- [ ] Flip `marketplace_on` when ops are ready.

### Batch 11 — The Lineup backend (phased per the Lineup plan)
- [ ] *(P0)* Seed-from-rankings function; read-only bracket from live data.
- [ ] *(P1)* Contestant profiles ↔ storefront link; before/after via Storage + consent; "Book this barber" into the real booking flow; admin manual round-advance.
- [ ] *(P2)* `voting_windows` + `fan_votes` write path via integrity Edge Function; redemption + Fan Favorite UIs; notifications; fan-integrity audit.
- [ ] *(P3)* Judge role + scoring UI (weighted rubric); result computation + tiebreaks; admin publish.
- [ ] *(P4)* Cut of the Week: weekly briefs, submission flow (reuses entries + consent), recurring window scheduler, leaderboard.
- [ ] *(P5)* Event pages; ticketing (Posh.Vip sync recommended near-term); champion discovery boost; Connect prize payout.

### Batch 12 — Launch readiness (not code)
- [ ] Privacy policy + ToS (handles minors, model/biometric-adjacent consent — get counsel).
- [ ] Accessibility pass (WCAG AA).
- [ ] Analytics instrumentation against the success metrics (§7 of the Lineup plan / conversion from contestant profiles).
- [ ] Hosting, environments, CI/CD, error monitoring.

---

## 6. Open decisions to settle before coding

1. **Money type** — ✅ **RESOLVED (2026-06-05): integer cents.** All 13 money columns converted from `numeric(10,2)` to `integer` (cents); `flash_deals.deal_price` likewise.
2. **Live-event ticketing** — ✅ **RESOLVED (2026-06-07): multi-source sale, unified ledger.** In-app Stripe is the authoritative first-party seller; **Eventbrite** syncs in via API/webhook; both land in one `event_attendees` table (idempotent on `source` + `external_ref`), with best-effort email→profile matching. **Posh.Vip deferred** (import-only when its API is confirmed). Only in-app Stripe is a financial record; external sources are reported mirrors.
3. **Fan vote eligibility** — ✅ **RESOLVED (2026-06-05): any verified account.** No separate "fan" role; the vote-integrity layer (§4.7) gates on verified-account status.
4. **Video reveals** — ✅ **RESOLVED (2026-06-07): phase in later.** Ship photo before/after reveals (existing `entries.before_media`/`after_media` + consent) now; design entries so video can be added in a later phase once a transcoding/CDN path (e.g. Mux / Cloudflare Stream) is chosen. No transcoding dependency for launch.
5. **Champion placement** — ✅ **RESOLVED (2026-06-07): both.** Champion gets a time-limited featured slot in Discover right after winning (e.g. 30 days) plus a smaller permanent metro boost.
6. **Multi-provider group booking** — ✅ **RESOLVED (2026-06-05): deferred.** No `booking_group_id`/split-deposit logic now; group booking stays N line items under one parent + one deposit.

---

## Appendix A — Batch 6 starter SQL (runnable now)

The first concrete step of Batch 6. Run after `styleprofiles_schema.sql`.

```sql
-- Auto-create a profile + default 'client' role when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin-only helper to elevate a profile to pro (called after pro application approval).
create or replace function public.grant_pro_role(_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins may grant the pro role';
  end if;
  insert into public.user_roles (user_id, role)
  values (_user_id, 'pro')
  on conflict (user_id, role) do nothing;
end;
$$;
```

---

*This document is the executable bridge to the production build. The engines in §4 are the parts that must be right the first time; the backlog in §5 is the order to build them. Execution happens in Claude Code against a real Supabase + Stripe environment.*
