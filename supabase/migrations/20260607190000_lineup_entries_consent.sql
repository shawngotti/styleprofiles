-- Batch 11 P4 (part 1) — entry media + consent gate, reused by Cut of the Week
-- and the bracket. before/after reveal media requires a resolved consent record
-- before it can publish (§4.8). Mirrors the awards submission gate: a pro can
-- draft/submit their entry but only an admin or a granted consent may publish it.

-- ----------------------------------------------------------------------------
-- 1. Private reveal-media bucket. Pros write under their own pro-id folder;
--    approved-entry media is readable by signed-in users only while lineup_on.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('lineup-reveals', 'lineup-reveals', false)
on conflict (id) do nothing;

drop policy if exists "lineup-reveals owner write" on storage.objects;
create policy "lineup-reveals owner write" on storage.objects for all to authenticated
  using (
    bucket_id = 'lineup-reveals'
    and exists (select 1 from public.pros p where p.id::text = (storage.foldername(name))[1] and public.owns_pro(p.id))
  )
  with check (
    bucket_id = 'lineup-reveals'
    and exists (select 1 from public.pros p where p.id::text = (storage.foldername(name))[1] and public.owns_pro(p.id))
  );

drop policy if exists "lineup-reveals approved read" on storage.objects;
create policy "lineup-reveals approved read" on storage.objects for select to authenticated
  using (
    bucket_id = 'lineup-reveals'
    and public.feature_enabled('lineup_on')
    and exists (select 1 from public.entries e
                where (e.before_media = name or e.after_media = name) and e.status = 'approved')
  );

drop policy if exists "lineup-reveals admin" on storage.objects;
create policy "lineup-reveals admin" on storage.objects for all to authenticated
  using (bucket_id = 'lineup-reveals' and public.is_admin())
  with check (bucket_id = 'lineup-reveals' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. One entry per contestant per brief (the weekly submission rule; also holds
--    for bracket entries, which are one-per-round-brief). Draft entries with no
--    brief are unconstrained.
-- ----------------------------------------------------------------------------
create unique index if not exists entries_contestant_brief_uniq
  on public.entries (contestant_id, brief_id) where brief_id is not null;

-- ----------------------------------------------------------------------------
-- 3. Publish guard: the owning pro may draft/submit but never self-approve or
--    remove; admins and trusted server contexts (submit fn / consent trigger,
--    which don't own the pro) pass through.
-- ----------------------------------------------------------------------------
create or replace function public.entry_publish_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owns boolean;
begin
  if public.is_admin() then return new; end if;
  select exists (select 1 from public.contestants c where c.id = old.contestant_id and public.owns_pro(c.pro_id))
    into _owns;
  if not _owns then return new; end if;  -- server context / consent trigger / non-owner
  if new.status in ('approved', 'removed') and new.status is distinct from old.status then
    raise exception 'only admins or consent resolution may publish or remove an entry';
  end if;
  return new;
end;
$$;

drop trigger if exists entry_publish_guard on public.entries;
create trigger entry_publish_guard
  before update on public.entries
  for each row execute function public.entry_publish_guard();

-- ----------------------------------------------------------------------------
-- 4. Consent resolution publishes/pulls the linked entry (mirror of awards).
-- ----------------------------------------------------------------------------
create or replace function public.entry_consent_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.for_contest then return new; end if;
  if new.status in ('public', 'anonymous') and old.status is distinct from new.status then
    update public.entries set status = 'approved'
     where consent_id = new.id and status in ('draft', 'submitted');
  elsif new.status in ('declined', 'private') and old.status is distinct from new.status then
    update public.entries set status = 'removed'
     where consent_id = new.id and status in ('draft', 'submitted');
  end if;
  return new;
end;
$$;

drop trigger if exists entry_consent_resolved on public.consent_requests;
create trigger entry_consent_resolved
  after update on public.consent_requests
  for each row execute function public.entry_consent_resolved();

-- ----------------------------------------------------------------------------
-- 5. Cut of the Week container: a single long-running competition holds every
--    weekly challenge's contestants/entries/votes. Idempotent.
-- ----------------------------------------------------------------------------
create or replace function public.ensure_cotw_competition()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  select id into _id from public.competitions where name = 'Cut of the Week' limit 1;
  if _id is null then
    insert into public.competitions (name, scope, status)
    values ('Cut of the Week', 'national', 'live')
    returning id into _id;
  end if;
  return _id;
end;
$$;

revoke all on function public.ensure_cotw_competition() from public, anon, authenticated;
grant execute on function public.ensure_cotw_competition() to service_role;

-- ----------------------------------------------------------------------------
-- 6. Link a weekly challenge to its fan-vote window (each week = one brief + one
--    cut_of_week voting window), so the leaderboard joins cleanly.
-- ----------------------------------------------------------------------------
alter table public.weekly_challenges
  add column if not exists voting_window_id uuid references public.voting_windows(id) on delete set null;

-- Live leaderboard for a Cut of the Week challenge: approved entries for that
-- week's brief ranked by weighted fan votes. Public (live ranks are the point).
create or replace function public.cotw_leaderboard(_challenge_id uuid)
returns table (entry_id uuid, pro_id uuid, display_name text, before_media text, after_media text, votes numeric)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, p.id, p.display_name, e.before_media, e.after_media,
         coalesce(sum(fv.weight), 0) as votes
  from public.weekly_challenges wc
  join public.entries e on e.brief_id = wc.brief_id and e.status = 'approved'
  join public.contestants c on c.id = e.contestant_id
  join public.pros p on p.id = c.pro_id
  left join public.fan_votes fv on fv.target_entry_id = e.id and fv.voting_window_id = wc.voting_window_id
  where wc.id = _challenge_id
  group by e.id, p.id, p.display_name, e.before_media, e.after_media
  order by votes desc, e.created_at;
$$;

grant execute on function public.cotw_leaderboard(uuid) to authenticated;
