-- Batch 9 ticket — Awards submission flow (media + Storage + consent gate).
-- Adds: the private award-media Storage bucket and its policies, a consent_id
-- link from a submission to the consent_requests record that must resolve
-- before the entry can go public (§4.8), and two triggers that make the
-- publish gate server-authoritative:
--   * award_submission_guard — a pro cannot self-approve or edit a published
--     entry from the browser; only admins or trusted server contexts (the
--     submit_award_entry Edge Function / cron, which have no auth.uid()) may.
--   * award_consent_resolved — when a for-contest consent resolves, the linked
--     pending submission is approved (granted) or removed (declined/private).

-- ----------------------------------------------------------------------------
-- 1. Link a submission to its consent request.
-- ----------------------------------------------------------------------------
alter table public.award_submissions
  add column if not exists consent_id uuid references public.consent_requests(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. Private Storage bucket for award media + RLS on storage.objects.
--    Pros read/write only under their own pro-id folder; approved-entry media
--    is readable by any signed-in user (so voters see it); admins see all.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('award-media', 'award-media', false)
on conflict (id) do nothing;

drop policy if exists "award-media owner write" on storage.objects;
create policy "award-media owner write" on storage.objects for all to authenticated
  using (
    bucket_id = 'award-media'
    and exists (select 1 from public.pros p
                where p.id::text = (storage.foldername(name))[1] and public.owns_pro(p.id))
  )
  with check (
    bucket_id = 'award-media'
    and exists (select 1 from public.pros p
                where p.id::text = (storage.foldername(name))[1] and public.owns_pro(p.id))
  );

drop policy if exists "award-media approved read" on storage.objects;
create policy "award-media approved read" on storage.objects for select to authenticated
  using (
    bucket_id = 'award-media'
    and exists (select 1 from public.award_submissions s
                where s.media_path = name and s.status = 'approved')
  );

drop policy if exists "award-media admin" on storage.objects;
create policy "award-media admin" on storage.objects for all to authenticated
  using (bucket_id = 'award-media' and public.is_admin())
  with check (bucket_id = 'award-media' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Publish guard: 'approved' is an eligibility flag (votes count only for
--    approved entries), so flipping it is server-authoritative. The permissive
--    awardsub_admin_update RLS lets a pro edit their own row; this trigger
--    narrows that — a pro (auth.uid() set, not admin) may not change status and
--    may not edit a row once it has left 'pending'. Admins and trusted server
--    contexts (service role / cron: auth.uid() is null) are unrestricted.
-- ----------------------------------------------------------------------------
create or replace function public.award_submission_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;  -- admin or trusted server context
  end if;
  if new.status is distinct from old.status then
    raise exception 'only admins may change a submission''s status';
  end if;
  if old.status <> 'pending' then
    raise exception 'this submission can no longer be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists award_submission_guard on public.award_submissions;
create trigger award_submission_guard
  before update on public.award_submissions
  for each row execute function public.award_submission_guard();

-- ----------------------------------------------------------------------------
-- 4. Consent resolution closes the loop: when a for-contest consent is answered,
--    publish or pull the linked pending submission accordingly.
-- ----------------------------------------------------------------------------
create or replace function public.award_consent_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.for_contest then
    return new;
  end if;
  if new.status in ('public', 'anonymous') and old.status is distinct from new.status then
    update public.award_submissions
       set status = 'approved'
     where consent_id = new.id and status = 'pending';
  elsif new.status in ('declined', 'private') and old.status is distinct from new.status then
    update public.award_submissions
       set status = 'removed', flag_reason = 'consent ' || new.status
     where consent_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists award_consent_resolved on public.consent_requests;
create trigger award_consent_resolved
  after update on public.consent_requests
  for each row execute function public.award_consent_resolved();
