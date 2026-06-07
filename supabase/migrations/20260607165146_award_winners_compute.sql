-- Batch 9 ticket 2 — Monthly Awards result computation (50/20/20/10).
-- Weights: public votes 50% · verified-client votes 20% · performance 20% ·
-- judge 10%. Each component is normalized 0-1 across a category's nominees,
-- then weighted and summed; the top score wins. Admin-only (and admin can
-- override by writing award_winners directly per RLS).

alter table public.award_submissions
  add column if not exists judge_score numeric not null default 0 check (judge_score >= 0 and judge_score <= 10);

create or replace function public.compute_award_winners(_cycle_id uuid)
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
  if not public.is_admin() then
    raise exception 'only admins may compute award winners';
  end if;

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

grant execute on function public.compute_award_winners(uuid) to authenticated;
