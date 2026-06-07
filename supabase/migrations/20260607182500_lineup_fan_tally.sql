-- Batch 11 P2 — fan-vote tallies + redemption application.
-- Fan votes drive only Redemption Wildcard and Fan Favorite (§4.5). tally is
-- admin-only (no live bandwagon leak; admin publishes). apply_redemption marks
-- the top-voted eliminated contestant 'redeemed' so an admin can re-seat them.

create or replace function public.tally_fan_votes(_window_id uuid)
returns table (target_contestant_id uuid, votes numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select fv.target_contestant_id, sum(fv.weight) as votes
    from public.fan_votes fv
    where fv.voting_window_id = _window_id and fv.target_contestant_id is not null
    group by fv.target_contestant_id
    order by votes desc, fv.target_contestant_id;
end;
$$;

grant execute on function public.tally_fan_votes(uuid) to authenticated;

-- Redemption Wildcard: the top-voted contestant in a 'redemption' window is
-- marked 'redeemed'. Re-seating them into a round stays an explicit admin
-- matchup edit (kept manual on purpose).
create or replace function public.apply_redemption(_window_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _vtype vote_type;
  _winner uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select vote_type into _vtype from public.voting_windows where id = _window_id;
  if _vtype is distinct from 'redemption' then
    raise exception 'window is not a redemption window';
  end if;

  select target_contestant_id into _winner
  from public.fan_votes
  where voting_window_id = _window_id and target_contestant_id is not null
  group by target_contestant_id
  order by sum(weight) desc, target_contestant_id
  limit 1;

  if _winner is not null then
    update public.contestants set status = 'redeemed' where id = _winner;
  end if;
  return _winner;
end;
$$;

grant execute on function public.apply_redemption(uuid) to authenticated;
