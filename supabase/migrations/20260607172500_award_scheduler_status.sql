-- Batch 9 ticket 3 — admin readout for the Awards scheduler health.
-- Surfaces the registered pg_cron jobs (name, schedule, active) so the admin
-- console can show "scheduler is live" without superuser access to the cron
-- schema. Admin-only; returns an empty set if pg_cron isn't installed.

create or replace function public.award_scheduler_status()
returns table (jobname text, schedule text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;  -- empty set: pg_cron not installed
  end if;
  return query
    select j.jobname::text, j.schedule::text, j.active
    from cron.job j
    where j.jobname in ('advance_award_cycles', 'ensure_upcoming_award_cycle')
    order by j.jobname;
end;
$$;

grant execute on function public.award_scheduler_status() to authenticated;
