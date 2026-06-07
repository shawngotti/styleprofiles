-- Batch 9 ticket — notifications on window open/close + results (completing the
-- set the scheduler emits). advance_award_cycles already notified on voting-open
-- and to winners; this adds:
--   * voting CLOSED → approved nominees of the just-closed cycle
--   * results in    → non-winning approved entrants (winners get the congrats)
-- The voting→review step becomes a RETURNING loop so we can target the cycles
-- that actually transitioned this run.

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
  -- submissions → voting: notify approved nominees that voting is live.
  for _c in
    update public.award_cycles
       set status = 'voting'
     where status = 'submissions' and opens_at <= _now and closes_at > _now
    returning id, period
  loop
    _to_voting := _to_voting + 1;
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    select distinct p.profile_id, 'awards',
      'Voting is open for the ' || to_char(_c.period, 'Mon YYYY') ||
        ' Awards — share your nominee link to rally votes!',
      'awards'
    from public.award_submissions s
    join public.pros p on p.id = s.pro_id
    where s.cycle_id = _c.id and s.status = 'approved';
  end loop;

  -- voting → review: notify approved nominees that voting has closed. The cycle
  -- dwells in review until results_at; it does not auto-complete this pass.
  for _c in
    update public.award_cycles
       set status = 'review'
     where status = 'voting' and closes_at <= _now
    returning id, period
  loop
    _to_review := _to_review + 1;
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    select distinct p.profile_id, 'awards',
      'Voting has closed for the ' || to_char(_c.period, 'Mon YYYY') ||
        ' Awards — winners are being finalized.',
      'awards'
    from public.award_submissions s
    join public.pros p on p.id = s.pro_id
    where s.cycle_id = _c.id and s.status = 'approved';
  end loop;

  -- review → complete (results window reached): compute winners, close out,
  -- notify winners (congrats) and other approved entrants (results posted).
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

    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    select distinct p.profile_id, 'awards',
      'The ' || to_char(_c.period, 'Mon YYYY') || ' Awards results are in — see the winners.',
      'awards'
    from public.award_submissions s
    join public.pros p on p.id = s.pro_id
    where s.cycle_id = _c.id and s.status = 'approved'
      and not exists (select 1 from public.award_winners w
                      where w.cycle_id = _c.id and w.pro_id = s.pro_id);
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
