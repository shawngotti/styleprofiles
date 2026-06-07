-- Batch 11 P3 — judge scoring (the Lineup's OWN rubric — do not conflate with
-- Awards' 50/20/20/10). Judges score five components; total is computed
-- server-side from the weights technical 30 / creative 25 / reveal 20 /
-- client_experience 15 / composure 10 — never sent by the client. A matchup's
-- winner is decided from summed judge totals (fan votes never touch this).

-- total is always derived from the components, on whatever 0-N scale they use.
create or replace function public.score_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total :=
      0.30 * new.technical
    + 0.25 * new.creative
    + 0.20 * new.reveal
    + 0.15 * new.client_experience
    + 0.10 * new.composure;
  return new;
end;
$$;

drop trigger if exists t_score_total on public.scores;
create trigger t_score_total
  before insert or update on public.scores
  for each row execute function public.score_total();

-- Admin registers a judge (separate from the convenience 'judge' user-role; the
-- scores RLS keys off this judges row + matchup_judges assignment).
create or replace function public.register_judge(_user_id uuid, _display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.judges (user_id, display_name)
  values (_user_id, _display_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  returning id into _id;
  return _id;
end;
$$;

grant execute on function public.register_judge(uuid, text) to authenticated;

-- Decide a matchup from judge scores and publish via the bracket engine.
-- Tiebreaks: higher summed technical, then better (lower) seed.
create or replace function public.compute_matchup_result(_matchup_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _m record;
  _a_total numeric; _b_total numeric;
  _a_tech numeric;  _b_tech numeric;
  _a_seed int;      _b_seed int;
  _winner uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select * into _m from public.matchups where id = _matchup_id;
  if not found then raise exception 'matchup not found'; end if;
  if _m.contestant_a is null or _m.contestant_b is null then
    raise exception 'matchup is not fully populated';
  end if;

  select coalesce(sum(s.total), 0), coalesce(sum(s.technical), 0)
    into _a_total, _a_tech
  from public.entries e join public.scores s on s.entry_id = e.id
  where e.matchup_id = _matchup_id and e.contestant_id = _m.contestant_a;

  select coalesce(sum(s.total), 0), coalesce(sum(s.technical), 0)
    into _b_total, _b_tech
  from public.entries e join public.scores s on s.entry_id = e.id
  where e.matchup_id = _matchup_id and e.contestant_id = _m.contestant_b;

  select seed into _a_seed from public.contestants where id = _m.contestant_a;
  select seed into _b_seed from public.contestants where id = _m.contestant_b;

  if _a_total > _b_total then _winner := _m.contestant_a;
  elsif _b_total > _a_total then _winner := _m.contestant_b;
  elsif _a_tech > _b_tech then _winner := _m.contestant_a;
  elsif _b_tech > _a_tech then _winner := _m.contestant_b;
  elsif coalesce(_a_seed, 2147483647) <= coalesce(_b_seed, 2147483647) then _winner := _m.contestant_a;
  else _winner := _m.contestant_b;
  end if;

  perform public.advance_lineup_matchup(_matchup_id, _winner);
  return _winner;
end;
$$;

grant execute on function public.compute_matchup_result(uuid) to authenticated;
