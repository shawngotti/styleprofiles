-- Batch 8 ticket 6 — loyalty ledger.
-- loyalty_transactions is the source of truth; profiles.style_points is a cache.
-- Earn on booking completion (1 point per $1 of service_total); redeem checks
-- balance server-side. Tier is derived from LIFETIME earned (so redeeming never
-- lowers a tier).

-- Tier thresholds (lifetime earned points), computed in one place.
create or replace function public.loyalty_tier_for(_lifetime int)
returns text language sql immutable as $$
  select case
    when _lifetime >= 4000 then 'Platinum'
    when _lifetime >= 1500 then 'Gold'
    when _lifetime >= 500  then 'Silver'
    else 'Bronze'
  end
$$;

-- Earn points when a booking becomes 'completed' (never on creation — prevents
-- book/cancel farming). Idempotent: one earn row per booking.
create or replace function public.award_loyalty_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _pts int;
  _lifetime int;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    _pts := new.service_total / 100;  -- integer cents -> whole points ($1 = 1pt)
    if _pts > 0 and not exists (select 1 from public.loyalty_transactions where booking_id = new.id and delta > 0) then
      insert into public.loyalty_transactions (profile_id, delta, reason, booking_id)
        values (new.client_profile_id, _pts, 'Booking completed', new.id);
      select coalesce(sum(delta), 0) into _lifetime
        from public.loyalty_transactions where profile_id = new.client_profile_id and delta > 0;
      update public.profiles
         set style_points = style_points + _pts,
             loyalty_tier = public.loyalty_tier_for(_lifetime),
             updated_at = now()
       where id = new.client_profile_id;
      new.points_earned := _pts;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_award_loyalty on public.bookings;
create trigger bookings_award_loyalty
  before update on public.bookings
  for each row execute function public.award_loyalty_on_completion();

-- Redeem a reward: server-authoritative balance check, then ledger + redemption.
create or replace function public.redeem_reward(_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _reward record;
  _balance int;
begin
  if _uid is null then raise exception 'authentication required'; end if;

  select id, name, cost_points, active into _reward from public.rewards where id = _reward_id;
  if not found or not _reward.active then raise exception 'reward not available'; end if;

  select style_points into _balance from public.profiles where id = _uid;
  if _balance < _reward.cost_points then
    raise exception 'not enough points (have %, need %)', _balance, _reward.cost_points;
  end if;

  insert into public.loyalty_transactions (profile_id, delta, reason)
    values (_uid, -_reward.cost_points, 'Redeemed: ' || _reward.name);
  insert into public.reward_redemptions (profile_id, reward_id, cost_points)
    values (_uid, _reward.id, _reward.cost_points);
  update public.profiles set style_points = style_points - _reward.cost_points, updated_at = now()
   where id = _uid;

  return jsonb_build_object('reward', _reward.name, 'spent', _reward.cost_points, 'balance', _balance - _reward.cost_points);
end;
$$;

grant execute on function public.redeem_reward(uuid) to authenticated;

-- Seed a starter rewards catalog (only if empty).
insert into public.rewards (name, cost_points)
select v.name, v.cost_points
from (values
  ('Free add-on', 50),
  ('$10 off next visit', 200),
  ('Priority booking (30 days)', 500),
  ('VIP styling session', 1000)
) as v(name, cost_points)
where not exists (select 1 from public.rewards);
