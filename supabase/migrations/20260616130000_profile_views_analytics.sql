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
