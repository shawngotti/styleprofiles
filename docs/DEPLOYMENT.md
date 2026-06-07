# StyleProfiles — Deployment & Launch Runbook

## Architecture
- **Frontend:** Vite + React (static build) — host on Vercel/Netlify/Cloudflare Pages.
- **Backend:** Supabase (Postgres + RLS + Storage + Edge Functions + pg_cron).
- **Payments:** Stripe Connect (test → live).

## Environments
| | Dev | Prod |
|---|---|---|
| Supabase project | `styleprofiles-dev` (`tngzgltxpszqqiiymgji`) | `[create]` |
| Stripe | test mode | live mode |
| Flags | features dark by default | flip at launch |

Keep a separate Supabase project + Stripe account per environment. Never point a
prod build at the dev project.

## Environment variables
**Frontend (build-time, public):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`

**Edge Functions (secrets — set via `supabase secrets set`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- (P5) `EVENTBRITE_API_TOKEN` once the Eventbrite webhook wrapper is wired

The repo `.env` (gitignored) holds dev URL + service role + Stripe test keys for
the local `node scripts/test-*.mjs` harness.

## Deploy steps
1. **DB:** `supabase db push` (applies `supabase/migrations/*` in order).
2. **Functions:** `supabase functions deploy <name>` for each in `supabase/functions/`.
3. **Secrets:** `supabase secrets set KEY=...` for all function secrets.
4. **Stripe webhook:** point a webhook at the `stripe_webhook` function URL;
   subscribe to `payment_intent.succeeded`, `account.updated`,
   `customer.subscription.*`; copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
5. **Cron:** pg_cron jobs are created by migrations (awards + Cut of the Week).
   Verify with `award_scheduler_status()` / `select * from cron.job`.
6. **Frontend:** set the three `VITE_*` vars in the host, deploy `npm run build`
   output (`dist/`).

## CI/CD
`.github/workflows/ci.yml`: `build` runs on every push/PR (compiles the whole app
— the gate). `integration` (the `test-*.mjs` suite against the dev DB) is manual
dispatch only, since it creates/deletes real auth users.

## Error monitoring
`reportError()` (`src/lib/analytics.js`) + the `ErrorBoundary` are the single
seam. Today they log to console + `analytics_events`. To wire Sentry: add the SDK,
init in `main.jsx`, and call `Sentry.captureException` inside `reportError`.

## Launch checklist
- [ ] Prod Supabase project created; schema pushed; functions deployed; secrets set.
- [ ] Stripe **live** keys + webhook configured; Connect onboarding tested end-to-end.
- [ ] **Legal:** ToS + Privacy reviewed by counsel; versions in `platform_settings`
      match the published docs; acceptance gate verified.
- [ ] Feature flags decided: `marketplace_on` / `lineup_on` (default off → flip when ops ready).
- [ ] Seed reference data (categories) present; demo/seed scripts NOT run in prod.
- [ ] Accessibility: `axe` + screen-reader pass (see `docs/ACCESSIBILITY.md`).
- [ ] Analytics dashboard reads `analytics_events` (see `docs/ANALYTICS.md`).
- [ ] Error monitoring wired (Sentry DSN or equivalent).
- [ ] Backups/PITR enabled on the prod Supabase project.
- [ ] Custom domain + TLS; CORS/allowed origins set for Edge Functions.
