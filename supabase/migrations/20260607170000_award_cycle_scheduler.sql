-- Batch 9 ticket 3 — Monthly Awards cycle scheduler (pg_cron).
-- Time-driven state machine: submissions → voting → review → complete.
--   submissions → voting : when opens_at passes (voting window opens)
--   voting → review       : when closes_at passes (voting window closes)
--   review → complete      : compute winners (50/20/20/10), write award_winners
-- Notifications fire on the transitions the architecture doc assigns to the
-- scheduler (§4.4): voting-open to pros with approved nominees, results to
-- winners. ensure_upcoming_award_cycle keeps the pipeline full so there is
-- always a cycle accepting submissions for next month.

-- ----------------------------------------------------------------------------
-- 1. Split the admin guard off compute_award_winners so the scheduler (which
--    runs with no auth.uid(), hence is_admin() = false) can compute too. The
--    admin RPC keeps its guard for the manual override path.
-- ----------------------------------------------------------------------------

create or replace function public._compute_award_winners(_cycle_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  _cat text;
  _winner uuid;
  _count int := 0;
begin
  for _cat in
    select distinct category from public.award_submissions where cycle_id = _cycle_id and status = 'approved'
  loop
    with subs as (
      select
        s.id,
        s.pro_id,
        -- public votes: voters who are NOT verified clients of this pro
        (select count(*) from public.award_votes v
           where v.submission_id = s.id
             and not exists (select 1 from public.bookings b
                             where b.client_profile_id = v.voter_profile_id and b.pro_id = s.pro_id and b.status = 'completed')
        )::numeric as public_votes,
        -- verified-client votes: voters with a completed booking with this pro
        (select count(*) from public.award_votes v
           where v.submission_id = s.id
             and exists (select 1 from public.bookings b
                         where b.client_profile_id = v.voter_profile_id and b.pro_id = s.pro_id and b.status = 'completed')
        )::numeric as verified_votes,
        coalesce(p.rating_avg, 0)::numeric as performance,
        coalesce(s.judge_score, 0)::numeric as judge
      from public.award_submissions s
      join public.pros p on p.id = s.pro_id
      where s.cycle_id = _cycle_id and s.category = _cat and s.status = 'approved'
    ),
    maxes as (
      select max(public_votes) mp, max(verified_votes) mv, max(performance) mperf, max(judge) mj from subs
    ),
    scored as (
      select
        subs.pro_id,
        0.5 * (case when m.mp > 0 then subs.public_votes / m.mp else 0 end)
        + 0.2 * (case when m.mv > 0 then subs.verified_votes / m.mv else 0 end)
        + 0.2 * (case when m.mperf > 0 then subs.performance / m.mperf else 0 end)
        + 0.1 * (case when m.mj > 0 then subs.judge / m.mj else 0 end) as total
      from subs, maxes m
    )
    select pro_id into _winner from scored order by total desc, pro_id limit 1;

    if _winner is not null then
      insert into public.award_winners (cycle_id, category, pro_id)
      values (_cycle_id, _cat, _winner)
      on conflict (cycle_id, category) do update set pro_id = excluded.pro_id, selected_at = now();
      _count := _count + 1;
    end if;
  end loop;

  return _count;
end;
$$;

-- Admin-guarded wrapper (manual override / recompute path from the console).
create or replace function public.compute_award_winners(_cycle_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins may compute award winners';
  end if;
  return public._compute_award_winners(_cycle_id);
end;
$$;

grant execute on function public.compute_award_winners(uuid) to authenticated;
revoke all on function public._compute_award_winners(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. The scheduler: advance every cycle to the phase its clock says it's in.
--    Idempotent and safe to run on any cadence — it only acts on cycles whose
--    window boundary has passed, so re-running mid-window is a no-op.
-- ----------------------------------------------------------------------------

create or replace function public.advance_award_cycles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _now timestamptz := now();
  _to_voting int := 0;
  _to_review int := 0;
  _completed int := 0;
  _winners int := 0;
  _c record;
begin
  -- submissions → voting (voting window has opened, not yet closed)
  for _c in
    update public.award_cycles
       set status = 'voting'
     where status = 'submissions' and opens_at <= _now and closes_at > _now
    returning id, period
  loop
    _to_voting := _to_voting + 1;
    -- Notify each pro with an approved nominee that voting is live.
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    select distinct p.profile_id, 'awards',
      'Voting is open for the ' || to_char(_c.period, 'Mon YYYY') ||
        ' Awards — share your nominee link to rally votes!',
      'awards'
    from public.award_submissions s
    join public.pros p on p.id = s.pro_id
    where s.cycle_id = _c.id and s.status = 'approved';
  end loop;

  -- voting → review (voting window has closed)
  update public.award_cycles
     set status = 'review'
   where status = 'voting' and closes_at <= _now;
  get diagnostics _to_review = row_count;

  -- review → complete (compute winners, then close out + notify winners)
  for _c in select id, period from public.award_cycles where status = 'review' loop
    _winners := _winners + public._compute_award_winners(_c.id);
    update public.award_cycles set status = 'complete' where id = _c.id;
    _completed := _completed + 1;
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    select p.profile_id, 'awards',
      'Congratulations — you won the ' || w.category || ' award for ' ||
        to_char(_c.period, 'Mon YYYY') || '!',
      'awards'
    from public.award_winners w
    join public.pros p on p.id = w.pro_id
    where w.cycle_id = _c.id;
  end loop;

  return jsonb_build_object(
    'ran_at', _now,
    'to_voting', _to_voting,
    'to_review', _to_review,
    'completed', _completed,
    'winners', _winners
  );
end;
$$;

revoke all on function public.advance_award_cycles() from public, anon, authenticated;
-- pg_cron runs as the function owner (postgres) and needs no grant; service_role
-- is the trusted server identity allowed to trigger an advance manually.
grant execute on function public.advance_award_cycles() to service_role;

-- ----------------------------------------------------------------------------
-- 3. Keep the pipeline full: ensure next month's cycle exists in 'submissions'.
--    Conventional windows: submissions for the first week, voting the rest of
--    the month, review on the final day. Idempotent on the unique period.
-- ----------------------------------------------------------------------------

create or replace function public.ensure_upcoming_award_cycle()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _period date := (date_trunc('month', now()) + interval '1 month')::date;
  _id uuid;
begin
  insert into public.award_cycles (period, opens_at, closes_at, status)
  values (
    _period,
    (_period + interval '7 days'),                       -- voting opens on the 8th
    (_period + interval '1 month' - interval '1 day'),   -- voting closes on the last day
    'submissions'
  )
  on conflict (period) do nothing
  returning id into _id;

  if _id is null then
    select id into _id from public.award_cycles where period = _period;
  end if;
  return _id;
end;
$$;

revoke all on function public.ensure_upcoming_award_cycle() from public, anon, authenticated;
grant execute on function public.ensure_upcoming_award_cycle() to service_role;

-- ----------------------------------------------------------------------------
-- 4. Schedule both on pg_cron. Wrapped so a local DB without pg_cron available
--    (e.g. `supabase db reset` before the extension is provisioned) does not
--    fail the migration — it just skips scheduling with a notice.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'advance_award_cycles') then
      perform cron.unschedule('advance_award_cycles');
    end if;
    perform cron.schedule(
      'advance_award_cycles', '0 * * * *',
      $cron$ select public.advance_award_cycles(); $cron$
    );

    if exists (select 1 from cron.job where jobname = 'ensure_upcoming_award_cycle') then
      perform cron.unschedule('ensure_upcoming_award_cycle');
    end if;
    perform cron.schedule(
      'ensure_upcoming_award_cycle', '0 0 * * *',
      $cron$ select public.ensure_upcoming_award_cycle(); $cron$
    );
  else
    raise notice 'pg_cron not available; skipping award cycle cron scheduling';
  end if;
end $$;
