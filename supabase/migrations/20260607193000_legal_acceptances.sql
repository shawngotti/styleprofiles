-- Batch 12 — legal acceptance tracking. We record which version of the Terms and
-- Privacy Policy each user accepted, so we can prove consent and re-prompt when a
-- new version ships. Current required versions live in platform_settings so they
-- can be bumped without a migration. (The documents themselves are in docs/legal
-- and REQUIRE counsel review before launch — see those files.)

create table if not exists public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  doc         text not null check (doc in ('tos', 'privacy')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, doc, version)
);
create index if not exists legal_acceptances_profile on public.legal_acceptances (profile_id);

alter table public.legal_acceptances enable row level security;
-- A user reads and records only their own acceptances; admins read all (audit).
drop policy if exists legal_self_read on public.legal_acceptances;
create policy legal_self_read on public.legal_acceptances for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists legal_self_insert on public.legal_acceptances;
create policy legal_self_insert on public.legal_acceptances for insert
  with check (profile_id = auth.uid());

-- Current required document versions (bump these when a new ToS/Privacy ships).
insert into public.platform_settings (key, value) values
  ('legal_tos_version',     '"2026-06-07"'::jsonb),
  ('legal_privacy_version', '"2026-06-07"'::jsonb)
on conflict (key) do nothing;
