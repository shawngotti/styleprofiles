-- Batch 11 — gate The Lineup on lineup_on (§4.9). The bracket is public-read for
-- top-of-funnel acquisition, but only once the feature is launched: until then
-- its data must be unreachable, not just hidden. Admins always read (build dark).
-- Re-points the public SELECT policies through feature_enabled('lineup_on').

drop policy if exists comp_public_read on public.competitions;
create policy comp_public_read on public.competitions for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists rounds_public_read on public.competition_rounds;
create policy rounds_public_read on public.competition_rounds for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists contestants_public_read on public.contestants;
create policy contestants_public_read on public.contestants for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists matchups_public_read on public.matchups;
create policy matchups_public_read on public.matchups for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists briefs_public_read on public.briefs;
create policy briefs_public_read on public.briefs for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists judges_public_read on public.judges;
create policy judges_public_read on public.judges for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists vwindows_public_read on public.voting_windows;
create policy vwindows_public_read on public.voting_windows for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists weekly_public_read on public.weekly_challenges;
create policy weekly_public_read on public.weekly_challenges for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select
  using (public.is_admin() or public.feature_enabled('lineup_on'));

-- Entries: the public 'approved' path also requires the feature live; owner pro
-- and admin keep their access for building dark.
drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries for select
  using (
    public.is_admin()
    or (status = 'approved' and public.feature_enabled('lineup_on'))
    or exists (select 1 from public.contestants c where c.id = contestant_id and public.owns_pro(c.pro_id))
  );
