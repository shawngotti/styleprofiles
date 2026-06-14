#!/usr/bin/env bash
# Provision the PRODUCTION Supabase project: apply schema, deploy all Edge
# Functions. Re-links to dev afterward so the local test harness keeps hitting
# dev. Idempotent — safe to re-run.
#
# Requires: SUPABASE_DB_PASSWORD env var (the prod DB password). The Supabase CLI
# must already be logged in (`supabase login`).
#
# Usage:  SUPABASE_DB_PASSWORD='...' bash scripts/provision-prod.sh
set -euo pipefail

PROD_REF="${PROD_REF:-ejchbffcbkgjktoawiet}"   # StyleProfiles (prod)
DEV_REF="${DEV_REF:-tngzgltxpszqqiiymgji}"     # styleprofiles-dev

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "ERROR: set SUPABASE_DB_PASSWORD (the prod DB password) first." >&2
  exit 1
fi

echo "==> Linking to PROD ($PROD_REF)"
supabase link --project-ref "$PROD_REF"

echo "==> Applying migrations (schema + RLS + functions + cron)"
supabase db push

echo "==> Deploying Edge Functions"
supabase functions deploy   # deploys every function in supabase/functions/

echo "==> Re-linking to DEV ($DEV_REF) so local tests stay on dev"
supabase link --project-ref "$DEV_REF"

cat <<'NEXT'

==> Schema + functions are live on prod. Remaining (need your values):

  # Edge Function secrets (SUPABASE_URL / ANON / SERVICE_ROLE are auto-injected):
  supabase secrets set --project-ref ejchbffcbkgjktoawiet \
    STRIPE_SECRET_KEY=sk_live_... \
    STRIPE_WEBHOOK_SECRET=whsec_...        # after creating the webhook (step below) \
    RESEND_API_KEY=re_... \
    EMAIL_FROM='StyleProfiles <hi@yourdomain>' \
    APP_URL=https://yourdomain

  # Stripe webhook -> point at:
  #   https://ejchbffcbkgjktoawiet.functions.supabase.co/stripe_webhook
  #   events: payment_intent.succeeded, account.updated, customer.subscription.*
  #   then copy its signing secret into STRIPE_WEBHOOK_SECRET above.

  # Schedule the email processor (every minute) hitting:
  #   https://ejchbffcbkgjktoawiet.functions.supabase.co/process_email_outbox

  # Frontend build env (set in your host — Vercel/Netlify):
  #   VITE_SUPABASE_URL=https://ejchbffcbkgjktoawiet.supabase.co
  #   VITE_SUPABASE_ANON_KEY=<prod anon key>
  #   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

  # Then in the app: Admin -> Feature Flags to flip marketplace_on / lineup_on.
NEXT
