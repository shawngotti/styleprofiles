-- Option A2 / §4.7 — vote-integrity hardening. Capture IP + device fingerprint on
-- every vote (for the audit), and add an admin anomaly scan that writes vote_flags
-- for IPs casting an abnormal number of votes in a window. The per-device edge
-- rate limit lives in the vote Edge Functions (keyed on the fingerprint header).

alter table public.award_votes add column if not exists ip text, add column if not exists fingerprint text;
alter table public.fan_votes  add column if not exists ip text, add column if not exists fingerprint text;

-- Admin audit: surface IPs with > _threshold votes in the last _minutes as open
-- vote_flags (shown in the moderation console's Vote Integrity tab). Deduped
-- against existing open flags for the same IP+context in the window.
create or replace function public.scan_vote_anomalies(_minutes int default 60, _threshold int default 20)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  _n int := 0;
  _r record;
  _note text;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;

  for _r in
    select 'awards'::text as ctx, ip, count(*) c
    from public.award_votes
    where ip is not null and created_at > now() - make_interval(mins => _minutes)
    group by ip having count(*) > _threshold
    union all
    select 'lineup'::text as ctx, ip, count(*) c
    from public.fan_votes
    where ip is not null and created_at > now() - make_interval(mins => _minutes)
    group by ip having count(*) > _threshold
  loop
    _note := format('%s %s votes from IP %s in %s min', _r.c, _r.ctx, _r.ip, _minutes);
    if not exists (
      select 1 from public.vote_flags
      where context = _r.ctx and note = _note and status = 'open'
        and created_at > now() - make_interval(mins => _minutes)
    ) then
      insert into public.vote_flags (context, note, vote_count, status)
      values (_r.ctx, _note, _r.c, 'open');
      _n := _n + 1;
    end if;
  end loop;

  return _n;
end;
$$;

grant execute on function public.scan_vote_anomalies(int, int) to authenticated;
