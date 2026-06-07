-- Batch 11 P0+P1 — The Lineup bracket engine.
-- P0: seed_lineup() takes the top-N pros (by rating, scoped to the competition's
--     metro) as contestants and builds round 1 by standard seed pairing.
-- P1: advance_lineup_matchup() records a winner, eliminates the loser, and when
--     a round completes, seeds the next round from the winners (or crowns the
--     champion). This is the manual-advance path (admin picks the winner);
--     compute_matchup_result() (P3) automates it from judge scores.
-- Bracket outcomes are 100% judge/admin-decided here — fan votes never touch
-- matchups (§4.5). Assumes power-of-two contestant counts (byes are a later
-- refinement).

create or replace function public._lineup_round_name(_n int)
returns text language sql immutable as $$
  select case _n
    when 2 then 'Final'
    when 4 then 'Semifinal'
    when 8 then 'Quarterfinal'
    else 'Round of ' || _n
  end;
$$;

-- P0 — seed contestants + first round.
create or replace function public.seed_lineup(_competition_id uuid, _n int default 8)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  _metro text;
  _count int;
  _round_id uuid;
  i int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select metro into _metro from public.competitions where id = _competition_id;
  if not found then raise exception 'competition not found'; end if;

  with ranked as (
    select p.id,
           row_number() over (order by p.rating_avg desc, p.rating_count desc, p.created_at) as rn
    from public.pros p
    where (_metro is null or p.city = _metro)
  )
  insert into public.contestants (competition_id, pro_id, seed, qualification_source, status)
  select _competition_id, id, rn, 'ranking', 'active' from ranked where rn <= _n
  on conflict (competition_id, pro_id) do nothing;

  select count(*) into _count from public.contestants where competition_id = _competition_id;

  if _count >= 2 and not exists (select 1 from public.competition_rounds where competition_id = _competition_id) then
    insert into public.competition_rounds (competition_id, name, round_order, status)
    values (_competition_id, public._lineup_round_name(_count), 1, 'pending')
    returning id into _round_id;

    for i in 1.._count / 2 loop
      insert into public.matchups (round_id, contestant_a, contestant_b, status)
      values (
        _round_id,
        (select id from public.contestants where competition_id = _competition_id and seed = i),
        (select id from public.contestants where competition_id = _competition_id and seed = _count + 1 - i),
        'pending'
      );
    end loop;
  end if;

  return _count;
end;
$$;

grant execute on function public.seed_lineup(uuid, int) to authenticated;

-- P1 — record a winner and advance the bracket.
create or replace function public.advance_lineup_matchup(_matchup_id uuid, _winner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _m record;
  _round record;
  _loser uuid;
  _winners uuid[];
  _next_round_id uuid;
  _n int;
  i int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select * into _m from public.matchups where id = _matchup_id;
  if not found then raise exception 'matchup not found'; end if;
  if _winner is null or (_winner is distinct from _m.contestant_a and _winner is distinct from _m.contestant_b) then
    raise exception 'winner must be one of the two contestants';
  end if;

  _loser := case when _winner = _m.contestant_a then _m.contestant_b else _m.contestant_a end;
  update public.matchups set winner_contestant_id = _winner, status = 'complete' where id = _matchup_id;
  if _loser is not null then
    update public.contestants set status = 'eliminated' where id = _loser;
  end if;

  select * into _round from public.competition_rounds where id = _m.round_id;

  -- Round still in progress?
  if exists (select 1 from public.matchups where round_id = _m.round_id and status <> 'complete') then
    update public.competition_rounds set status = 'live' where id = _m.round_id;
    return jsonb_build_object('round_complete', false);
  end if;

  update public.competition_rounds set status = 'complete' where id = _m.round_id;

  -- Winners, ordered by their seed, become the next round's field.
  select array_agg(c.id order by c.seed) into _winners
  from public.matchups m
  join public.contestants c on c.id = m.winner_contestant_id
  where m.round_id = _m.round_id;
  _n := coalesce(array_length(_winners, 1), 0);

  if _n <= 1 then
    if _n = 1 then
      update public.contestants set status = 'champion' where id = _winners[1];
      update public.competitions set status = 'complete' where id = _round.competition_id;
    end if;
    return jsonb_build_object('round_complete', true, 'champion', case when _n = 1 then _winners[1] else null end);
  end if;

  insert into public.competition_rounds (competition_id, name, round_order, status)
  values (_round.competition_id, public._lineup_round_name(_n), _round.round_order + 1, 'pending')
  returning id into _next_round_id;

  for i in 1.._n / 2 loop
    insert into public.matchups (round_id, contestant_a, contestant_b, status)
    values (_next_round_id, _winners[i], _winners[_n + 1 - i], 'pending');
  end loop;

  return jsonb_build_object('round_complete', true, 'next_round_id', _next_round_id, 'advancing', _n);
end;
$$;

grant execute on function public.advance_lineup_matchup(uuid, uuid) to authenticated;
