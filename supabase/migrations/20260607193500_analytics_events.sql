-- Batch 12 — analytics event log (self-hosted, in-stack with Supabase). A simple
-- append-only table the client writes to via track(); admins read for funnel
-- analysis. Maps to the success metrics in docs/ANALYTICS.md. Swap the client
-- sink for a provider (PostHog/etc.) later without changing call sites.

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles(id) on delete set null,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_event on public.analytics_events (event, created_at);
create index if not exists analytics_events_profile on public.analytics_events (profile_id);

alter table public.analytics_events enable row level security;
-- Anyone (incl. anon) may append their own event; nobody but admins can read.
-- profile_id must be null (anon) or the caller — events can't be forged for others.
drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events for insert
  with check (profile_id is null or profile_id = auth.uid());
drop policy if exists analytics_admin_read on public.analytics_events;
create policy analytics_admin_read on public.analytics_events for select
  using (public.is_admin());
