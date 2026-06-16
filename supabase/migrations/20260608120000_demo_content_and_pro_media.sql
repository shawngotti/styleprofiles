-- Demo content system + pro media. Two related additions:
--  1. Pro media fields (avatar/cover/gallery) so storefronts can be photo-rich.
--  2. An is_demo flag on the public top-level tables + per-aspect admin toggles
--     in platform_settings. A demo row is visible only when its toggle is on
--     (or to admins) — so demo content can be shown/hidden instantly per aspect
--     without deleting it, then wiped entirely before real launch.

-- ----------------------------------------------------------------------------
-- 1. Pro media
-- ----------------------------------------------------------------------------
alter table public.pros
  add column if not exists avatar_url   text,
  add column if not exists cover_url    text,
  add column if not exists gallery_urls text[] not null default '{}';

-- ----------------------------------------------------------------------------
-- 2. is_demo flags
-- ----------------------------------------------------------------------------
alter table public.pros             add column if not exists is_demo boolean not null default false;
alter table public.award_cycles     add column if not exists is_demo boolean not null default false;
alter table public.competitions     add column if not exists is_demo boolean not null default false;
alter table public.chair_promotions add column if not exists is_demo boolean not null default false;
alter table public.products         add column if not exists is_demo boolean not null default false;

-- Per-aspect demo visibility toggles (default off; admins always see demo rows).
insert into public.platform_settings (key, value) values
  ('demo_pros_on',   'false'::jsonb),
  ('demo_awards_on', 'false'::jsonb),
  ('demo_lineup_on', 'false'::jsonb),
  ('demo_deals_on',  'false'::jsonb),
  ('demo_shop_on',   'false'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Gate public reads: real rows always show; demo rows show only when their
--    toggle is on (or to admins). Layered on top of existing feature gates.
-- ----------------------------------------------------------------------------
drop policy if exists pros_public_read on public.pros;
create policy pros_public_read on public.pros for select
  using (public.is_admin() or (not is_demo) or public.feature_enabled('demo_pros_on'));

drop policy if exists cycles_public_read on public.award_cycles;
create policy cycles_public_read on public.award_cycles for select
  using (public.is_admin() or (not is_demo) or public.feature_enabled('demo_awards_on'));

drop policy if exists chair_public_read on public.chair_promotions;
create policy chair_public_read on public.chair_promotions for select
  using (public.is_admin() or (not is_demo) or public.feature_enabled('demo_deals_on'));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select
  using (
    public.is_admin()
    or (is_available and public.feature_enabled('marketplace_on')
        and ((not is_demo) or public.feature_enabled('demo_shop_on')))
  );

drop policy if exists comp_public_read on public.competitions;
create policy comp_public_read on public.competitions for select
  using (
    public.is_admin()
    or (public.feature_enabled('lineup_on')
        and ((not is_demo) or public.feature_enabled('demo_lineup_on')))
  );
