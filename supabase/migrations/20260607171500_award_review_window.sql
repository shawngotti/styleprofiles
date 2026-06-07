-- Batch 9 ticket 3 (fix) — give the Awards 'review' phase a real dwell time.
-- Without this, advance_award_cycles() flowed a cycle voting → review → complete
-- in a single invocation the moment voting closed, leaving no window for judges
-- to enter judge_score (the whole point of the 'review' phase per §4.4).
--
-- New boundary: award_cycles.results_at. voting → review fires when closes_at
-- passes; review → complete fires only once results_at passes. A null
-- results_at means "do not auto-publish" (admin computes/overrides manually).

alter table public.award_cycles
  add column if not exists results_at timestamptz;

-- ----------------------------------------------------------------------------
-- Redefine the scheduler to honour results_at for the review → complete step.
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

  -- voting → review (voting window has closed). The cycle dwells here until
  -- results_at so judges can score; it does NOT auto-complete in this pass.
  update public.award_cycles
     set status = 'review'
   where status = 'voting' and closes_at <= _now;
  get diagnostics _to_review = row_count;

  -- review → complete (results window reached): compute winners, close out,
  -- notify winners. Gated on results_at so review has real dwell time; a null
  -- results_at is left for the admin to publish manually.
  for _c in
    select id, period from public.award_cycles
     where status = 'review' and results_at is not null and results_at <= _now
  loop
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
grant execute on function public.advance_award_cycles() to service_role;

-- ----------------------------------------------------------------------------
-- ensure_upcoming sets a 1-day review window: voting closes on the last day of
-- the month, results publish on the 1st of the following month.
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
  insert into public.award_cycles (period, opens_at, closes_at, results_at, status)
  values (
    _period,
    (_period + interval '7 days'),                       -- voting opens on the 8th
    (_period + interval '1 month' - interval '1 day'),   -- voting closes on the last day
    (_period + interval '1 month'),                      -- results publish on the 1st
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
