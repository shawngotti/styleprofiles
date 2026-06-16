-- StyleProfiles prod deploy bundle — 2026-06-16
-- Reviews moderation + photos + replies, profile-view analytics, new-review email.
-- Run this whole file once in the PROD Supabase SQL Editor. Idempotent where possible.
-- (Edge Functions submit_review / submit_review_reply are already deployed to prod.)

begin;

-- ===== photo bucket (safety; no-op if already present) =====
-- Public bucket for pro storefront media (avatar / cover / portfolio). Public so
-- <img> tags render without signed URLs (these aren't sensitive). A pro writes
-- only to their own profile-id folder; everyone can read.

insert into storage.buckets (id, name, public)
values ('pro-media', 'pro-media', true)
on conflict (id) do nothing;

drop policy if exists "pro-media owner write" on storage.objects;
create policy "pro-media owner write" on storage.objects for all to authenticated
  using (bucket_id = 'pro-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pro-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== 1/3 reviews moderation =====
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

-- ===== 2/3 profile-view analytics =====
-- Phase 3 — Profile-view analytics & conversion tracking.
--
-- Every storefront open is logged (server-side, throttled) with the viewer's
-- identity. Pros see counts, a named-visitor list (respecting each client's
-- opt-out), and a view→book conversion funnel. Admin sees a popularity board
-- with a profile-completeness score to spot who needs marketing help.

-- ----------------------------------------------------------------------------
-- 1. Client privacy opt-out: hide my name from the pros whose pages I view.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists hide_profile_views boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. View events. Insert only via log_profile_view (security definer); pros
--    read their own pro's views, admin reads all. No public read.
-- ----------------------------------------------------------------------------
create table if not exists public.profile_views (
  id                uuid primary key default gen_random_uuid(),
  pro_id            uuid not null references public.pros(id) on delete cascade,
  viewer_profile_id uuid references public.profiles(id) on delete set null,
  source            text,                    -- 'discover' | 'lineup' | 'direct' | ...
  booked            boolean not null default false, -- converted: viewer later booked this pro
  created_at        timestamptz not null default now()
);
create index if not exists profile_views_pro_time_idx on public.profile_views (pro_id, created_at desc);
create index if not exists profile_views_pro_viewer_idx on public.profile_views (pro_id, viewer_profile_id);

alter table public.profile_views enable row level security;
drop policy if exists pv_pro_read on public.profile_views;
create policy pv_pro_read on public.profile_views
  for select using (public.owns_pro(pro_id) or public.is_admin());
-- (no insert/update/delete policy — only the SECURITY DEFINER RPC writes)

-- ----------------------------------------------------------------------------
-- 3. log_profile_view — throttled, owner-excluded view logger.
-- ----------------------------------------------------------------------------
create or replace function public.log_profile_view(_pro_id uuid, _source text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _viewer uuid := auth.uid();
begin
  if _pro_id is null then return; end if;
  -- never count a pro viewing their own page
  if public.owns_pro(_pro_id) then return; end if;
  -- throttle: at most one logged view per viewer per pro per 30 minutes
  if _viewer is not null and exists (
    select 1 from public.profile_views
    where pro_id = _pro_id and viewer_profile_id = _viewer
      and created_at > now() - interval '30 minutes'
  ) then return; end if;
  insert into public.profile_views (pro_id, viewer_profile_id, source)
  values (_pro_id, _viewer, _source);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Conversion: when a client books a pro, mark their views converted.
-- ----------------------------------------------------------------------------
create or replace function public.mark_view_converted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profile_views
    set booked = true
  where pro_id = new.pro_id
    and viewer_profile_id = new.client_profile_id
    and not booked;
  return new;
end;
$$;

drop trigger if exists t_mark_view_converted on public.bookings;
create trigger t_mark_view_converted
  after insert on public.bookings
  for each row execute function public.mark_view_converted();

-- ----------------------------------------------------------------------------
-- 5. Profile-completeness score (0–100) over 7 signals.
-- ----------------------------------------------------------------------------
create or replace function public.pro_completeness(_pro_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, least(100, (
    (case when p.avatar_url is not null then 1 else 0 end) +
    (case when p.cover_url is not null then 1 else 0 end) +
    (case when coalesce(array_length(p.gallery_urls, 1), 0) >= 3 then 1 else 0 end) +
    (case when p.bio is not null and length(p.bio) > 30 then 1 else 0 end) +
    (case when p.price_from is not null then 1 else 0 end) +
    (case when p.charges_enabled then 1 else 0 end) +
    (case when (select count(*) from public.services s where s.pro_id = p.id and s.active) >= 3 then 1 else 0 end)
  ) * 100 / 7))
  from public.pros p where p.id = _pro_id
$$;

-- ----------------------------------------------------------------------------
-- 6. Pro's own analytics: aggregate stats + named recent visitors.
--    Visitor names honor each client's hide_profile_views opt-out.
-- ----------------------------------------------------------------------------
create or replace function public.pro_view_stats(_pro_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json;
begin
  if not (public.owns_pro(_pro_id) or public.is_admin()) then
    raise exception 'not authorized';
  end if;
  select json_build_object(
    'total_views', count(*),
    'unique_viewers', count(distinct viewer_profile_id),
    'views_7d', count(*) filter (where created_at > now() - interval '7 days'),
    'views_30d', count(*) filter (where created_at > now() - interval '30 days'),
    'converted_viewers', count(distinct viewer_profile_id) filter (where booked),
    'completeness', public.pro_completeness(_pro_id)
  ) into result
  from public.profile_views where pro_id = _pro_id;
  return result;
end;
$$;

create or replace function public.pro_recent_visitors(_pro_id uuid, _limit int default 24)
returns table (
  viewer_profile_id uuid,
  display_name text,
  avatar_color text,
  last_view timestamptz,
  views int,
  booked boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.owns_pro(_pro_id) or public.is_admin()) then
    raise exception 'not authorized';
  end if;
  return query
    select v.viewer_profile_id,
           case when pr.hide_profile_views then null else pr.display_name end,
           pr.avatar_color,
           max(v.created_at) as last_view,
           count(*)::int as views,
           bool_or(v.booked) as booked
    from public.profile_views v
    left join public.profiles pr on pr.id = v.viewer_profile_id
    where v.pro_id = _pro_id and v.viewer_profile_id is not null
    group by v.viewer_profile_id, pr.hide_profile_views, pr.display_name, pr.avatar_color
    order by max(v.created_at) desc
    limit _limit;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Admin popularity board across all pros.
-- ----------------------------------------------------------------------------
create or replace function public.admin_pro_analytics(_days int default 30)
returns table (
  pro_id uuid,
  handle text,
  display_name text,
  is_demo boolean,
  views bigint,
  unique_viewers bigint,
  conversions bigint,
  completeness int,
  charges_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.id, p.handle, p.display_name, p.is_demo,
           count(v.id) as views,
           count(distinct v.viewer_profile_id) as unique_viewers,
           count(distinct v.viewer_profile_id) filter (where v.booked) as conversions,
           public.pro_completeness(p.id) as completeness,
           p.charges_enabled
    from public.pros p
    left join public.profile_views v
      on v.pro_id = p.id and v.created_at > now() - make_interval(days => _days)
    group by p.id
    order by count(v.id) desc, p.rating_avg desc;
end;
$$;

-- ===== 3/3 review-reply screening + email =====
-- Follow-ups: screen pro replies, and email pros on a new review.
--
-- 1. Pro replies now post only through submit_review_reply (service role),
--    which screens the text — so direct owner writes are removed (the public
--    read stays).
-- 2. notify_review_reply gets its own kind ('review_reply') so it stays in-app
--    only, while a new 'review' email is sent to pros for new reviews.

-- ----------------------------------------------------------------------------
-- 1. Lock down review_responses writes to the screening function.
-- ----------------------------------------------------------------------------
drop policy if exists review_resp_owner_write on public.review_responses;
-- (review_resp_public_read remains; submit_review_reply writes via service role)

-- ----------------------------------------------------------------------------
-- 2. Reply notifications use a distinct kind (in-app only, not emailed).
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
    values (_author, 'review_reply',
            coalesce(_name, 'Your stylist') || ' replied to your review', 'appointments');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Email pros on a new review (kind 'review'), honoring opt-out. Reply
--    notifications ('review_reply') stay in-app only.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _opt boolean;
  _subject text;
begin
  if new.kind is null or new.kind not in ('booking', 'chair', 'awards', 'lineup', 'review') then
    return new;
  end if;

  select email, email_notifications into _email, _opt
  from public.profiles where id = new.recipient_profile_id;
  if _email is null or _opt is false then
    return new;
  end if;

  _subject := case new.kind
    when 'booking' then 'Your StyleProfiles appointment'
    when 'chair'   then 'A StyleProfiles flash deal'
    when 'awards'  then 'StyleProfiles Awards update'
    when 'lineup'  then 'The Lineup update'
    when 'review'  then 'You have a new review on StyleProfiles'
    else 'StyleProfiles'
  end;

  insert into public.email_outbox (to_profile_id, to_email, subject, body, kind)
  values (new.recipient_profile_id, _email, _subject, new.body, new.kind);
  return new;
end;
$$;

commit;
