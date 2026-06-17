-- Make the demo_shop_on / demo_lineup_on toggles self-sufficient.
--
-- Before: demo Shop/Lineup content was only visible when the REAL launch flag
-- (marketplace_on / lineup_on) was ALSO on — so you couldn't preview the demo
-- without "launching" the empty real feature. After: a demo row is visible
-- whenever its demo toggle is on, independent of the launch flag (real,
-- non-demo rows still require the launch flag). Matches how demo pros/awards/
-- deals already behave. Admins always read (build dark).

-- ---- Products: demo items show under demo_shop_on alone ----
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select
  using (
    public.is_admin()
    or (is_available and (
          (not is_demo and public.feature_enabled('marketplace_on'))
          or (is_demo and public.feature_enabled('demo_shop_on'))
        ))
  );

-- ---- Competitions: demo brackets show under demo_lineup_on alone ----
drop policy if exists comp_public_read on public.competitions;
create policy comp_public_read on public.competitions for select
  using (
    public.is_admin()
    or (not is_demo and public.feature_enabled('lineup_on'))
    or (is_demo and public.feature_enabled('demo_lineup_on'))
  );

-- ---- Bracket child tables: also readable under demo_lineup_on. (No is_demo
--      column on these; the Lineup UI only fetches children for the demo
--      competition it can see, so only demo rows surface in practice.) ----
drop policy if exists rounds_public_read on public.competition_rounds;
create policy rounds_public_read on public.competition_rounds for select
  using (public.is_admin() or public.feature_enabled('lineup_on') or public.feature_enabled('demo_lineup_on'));

drop policy if exists contestants_public_read on public.contestants;
create policy contestants_public_read on public.contestants for select
  using (public.is_admin() or public.feature_enabled('lineup_on') or public.feature_enabled('demo_lineup_on'));

drop policy if exists matchups_public_read on public.matchups;
create policy matchups_public_read on public.matchups for select
  using (public.is_admin() or public.feature_enabled('lineup_on') or public.feature_enabled('demo_lineup_on'));

drop policy if exists vwindows_public_read on public.voting_windows;
create policy vwindows_public_read on public.voting_windows for select
  using (public.is_admin() or public.feature_enabled('lineup_on') or public.feature_enabled('demo_lineup_on'));
