-- Batch 10 ticket 1 — feature flags gate the API + data, not just the UI (§4.9).
-- platform_settings holds marketplace_on / lineup_on. A disabled feature's data
-- must be unreachable (RLS returns empty) and its endpoints must reject — so
-- "build it dark, launch later" is genuinely safe. feature_enabled() is the one
-- place that reads a flag; RLS policies and Edge Functions both call it.

create or replace function public.feature_enabled(_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = _key), false);
$$;

grant execute on function public.feature_enabled(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Gate the marketplace catalog on the flag. Admins always see (to seed/build
-- dark); everyone else sees products only when marketplace_on is true.
-- ----------------------------------------------------------------------------
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select
  using (public.is_admin() or (is_available and public.feature_enabled('marketplace_on')));

drop policy if exists prodcats_public_read on public.product_categories;
create policy prodcats_public_read on public.product_categories for select
  using (public.is_admin() or public.feature_enabled('marketplace_on'));
