-- Batch 11 P4 (part 2) — Cut of the Week recurring scheduler.
-- ensure_upcoming_weekly_challenge() keeps a week open at all times (brief +
-- cut_of_week voting window + weekly_challenge, opening now for 7 days when none
-- is live). advance_weekly_challenges() opens scheduled weeks and closes expired
-- ones, keeping each challenge's voting window in lockstep. Both on pg_cron.

create or replace function public.ensure_upcoming_weekly_challenge()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _comp uuid := public.ensure_cotw_competition();
  _existing uuid;
  _brief uuid;
  _win uuid;
  _wc uuid;
begin
  -- A challenge already open or scheduled and not yet closed? Keep it.
  select id into _existing
  from public.weekly_challenges
  where status in ('scheduled', 'open') and closes_at > now()
  order by opens_at desc
  limit 1;
  if _existing is not null then
    return _existing;
  end if;

  insert into public.briefs (competition_id, title, description)
  values (_comp, 'Cut of the Week — ' || to_char(now(), 'Mon DD'), 'Submit your best look for this week''s challenge.')
  returning id into _brief;

  insert into public.voting_windows (competition_id, vote_type, opens_at, closes_at, status)
  values (_comp, 'cut_of_week', now(), now() + interval '7 days', 'open')
  returning id into _win;

  insert into public.weekly_challenges (brief_id, opens_at, closes_at, status, voting_window_id)
  values (_brief, now(), now() + interval '7 days', 'open', _win)
  returning id into _wc;

  return _wc;
end;
$$;

revoke all on function public.ensure_upcoming_weekly_challenge() from public, anon, authenticated;
grant execute on function public.ensure_upcoming_weekly_challenge() to service_role;

create or replace function public.advance_weekly_challenges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _now timestamptz := now();
  _opened int := 0;
  _closed int := 0;
  _wc record;
begin
  for _wc in
    update public.weekly_challenges set status = 'open'
     where status = 'scheduled' and opens_at <= _now and closes_at > _now
    returning id, voting_window_id
  loop
    if _wc.voting_window_id is not null then
      update public.voting_windows set status = 'open' where id = _wc.voting_window_id;
    end if;
    _opened := _opened + 1;
  end loop;

  for _wc in
    update public.weekly_challenges set status = 'closed'
     where status = 'open' and closes_at <= _now
    returning id, voting_window_id
  loop
    if _wc.voting_window_id is not null then
      update public.voting_windows set status = 'closed' where id = _wc.voting_window_id;
    end if;
    _closed := _closed + 1;
  end loop;

  return jsonb_build_object('ran_at', _now, 'opened', _opened, 'closed', _closed);
end;
$$;

revoke all on function public.advance_weekly_challenges() from public, anon, authenticated;
grant execute on function public.advance_weekly_challenges() to service_role;

-- Schedule (guarded so a local DB without pg_cron still migrates).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'advance_weekly_challenges') then
      perform cron.unschedule('advance_weekly_challenges');
    end if;
    perform cron.schedule('advance_weekly_challenges', '0 * * * *',
      $cron$ select public.advance_weekly_challenges(); $cron$);
    if exists (select 1 from cron.job where jobname = 'ensure_upcoming_weekly_challenge') then
      perform cron.unschedule('ensure_upcoming_weekly_challenge');
    end if;
    perform cron.schedule('ensure_upcoming_weekly_challenge', '0 0 * * *',
      $cron$ select public.ensure_upcoming_weekly_challenge(); $cron$);
  else
    raise notice 'pg_cron not available; skipping Cut of the Week cron scheduling';
  end if;
end $$;
