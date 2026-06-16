-- Phase 1 — Reviews loop: moderation status, photos, screening gate, and the
-- new-review / reply notifications.
--
-- Reviews become server-authoritative for *publication*, not just reputation:
-- a review is only publicly readable once status='approved'. The submit_review
-- Edge Function (service role) is the sole writer — it screens text + photos
-- via OpenAI omni-moderation and sets the status per the platform mode
-- (auto vs manual). Direct client inserts are removed so screening can't be
-- bypassed from the browser (operating principle #1).

-- ----------------------------------------------------------------------------
-- 1. Columns: moderation lifecycle + photos
-- ----------------------------------------------------------------------------
alter table public.reviews
  add column if not exists status         text not null default 'pending'
    check (status in ('pending','approved','flagged','removed')),
  add column if not exists photo_urls      text[] not null default '{}',
  add column if not exists moderation_reason text,
  add column if not exists flagged_labels  text[] not null default '{}',
  add column if not exists moderated_at    timestamptz,
  add column if not exists removed_by       uuid references public.profiles(id) on delete set null;

-- Existing reviews predate moderation — keep them visible.
update public.reviews set status = 'approved' where status = 'pending' and created_at < now();

create index if not exists reviews_status_idx on public.reviews (status);
create index if not exists reviews_pro_status_idx on public.reviews (pro_id, status);

-- ----------------------------------------------------------------------------
-- 2. RLS: public sees only approved; author/pro see their own (any status);
--    admin sees + writes all. No direct client insert/update — submit_review
--    (service role) is the gate.
-- ----------------------------------------------------------------------------
drop policy if exists reviews_public_read   on public.reviews;
drop policy if exists reviews_author_write  on public.reviews;
drop policy if exists reviews_author_update on public.reviews;

create policy reviews_public_read on public.reviews
  for select using (status = 'approved');
create policy reviews_author_read on public.reviews
  for select using (author_profile_id = auth.uid());
create policy reviews_pro_read on public.reviews
  for select using (public.owns_pro(pro_id));
create policy reviews_admin_all on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Rating cache counts only APPROVED reviews (held/flagged/removed never
--    move a pro's public rating).
-- ----------------------------------------------------------------------------
create or replace function public.recompute_pro_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _pid uuid := coalesce(new.pro_id, old.pro_id);
begin
  update public.pros p
    set rating_avg = coalesce((
          select round(avg(rating)::numeric, 2)
          from public.reviews where pro_id = _pid and status = 'approved'), 0),
        rating_count = (
          select count(*)
          from public.reviews where pro_id = _pid and status = 'approved')
    where p.id = _pid;
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. review-media bucket (public; a client writes only to their own folder).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', true)
on conflict (id) do nothing;

drop policy if exists "review-media owner write" on storage.objects;
create policy "review-media owner write" on storage.objects for all to authenticated
  using (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 5. Notify the pro when a review becomes visible (insert-approved or
--    transitions into approved). Manual/flagged reviews don't ping the pro
--    until they actually go live.
-- ----------------------------------------------------------------------------
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _pro_profile uuid;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select profile_id into _pro_profile from public.pros where id = new.pro_id;
    if _pro_profile is not null and _pro_profile <> new.author_profile_id then
      insert into public.notifications (recipient_profile_id, kind, body, link_screen)
      values (_pro_profile, 'review',
              'New ' || new.rating || '★ review on your profile', 'dashboard');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists t_notify_new_review on public.reviews;
create trigger t_notify_new_review
  after insert or update on public.reviews
  for each row execute function public.notify_new_review();

-- ----------------------------------------------------------------------------
-- 6. Notify the client when the pro replies to their review.
-- ----------------------------------------------------------------------------
create or replace function public.notify_review_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _author uuid;
  _name   text;
begin
  select r.author_profile_id, p.display_name
    into _author, _name
  from public.reviews r join public.pros p on p.id = r.pro_id
  where r.id = new.review_id;

  if _author is not null then
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    values (_author, 'review',
            coalesce(_name, 'Your stylist') || ' replied to your review', 'appointments');
  end if;
  return new;
end;
$$;

drop trigger if exists t_notify_review_reply on public.review_responses;
create trigger t_notify_review_reply
  after insert on public.review_responses
  for each row execute function public.notify_review_reply();

-- ----------------------------------------------------------------------------
-- 7. Moderation mode flag (admin-toggleable). 'auto' = clean reviews publish
--    immediately; 'manual' = everything waits in the admin queue.
-- ----------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('review_moderation_mode', '"auto"'::jsonb)
on conflict (key) do nothing;
