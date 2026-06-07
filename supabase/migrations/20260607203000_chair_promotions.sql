-- Fill My Chair — promotional open slots. Pros post a time-sensitive opening
-- (a discounted slot); clients claim it, which atomically reserves it and creates
-- a real discounted booking (deposit still required). Claiming is server-
-- authoritative: the slot can be claimed exactly once even under a race.

-- Real datetimes (the schema's slot_label/slot_time were display text only) +
-- an expiry + a link to the booking a claim creates.
alter table public.chair_promotions
  add column if not exists slot_at    timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- ----------------------------------------------------------------------------
-- Notify the audience when a deal is posted (past clients of the pro stand in
-- for the loyalty/waitlist audience). Records how many were reached.
-- ----------------------------------------------------------------------------
create or replace function public.notify_chair_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text;
  _pro_profile uuid;
  _n int;
begin
  select display_name, profile_id into _name, _pro_profile from public.pros where id = new.pro_id;

  insert into public.notifications (recipient_profile_id, kind, body, link_screen)
  select distinct b.client_profile_id, 'chair',
    'New opening with ' || _name ||
      case when new.discount_pct > 0 then ' · ' || new.discount_pct || '% off' else '' end,
    'deals'
  from public.bookings b
  where b.pro_id = new.pro_id and b.status = 'completed'
    and b.client_profile_id <> _pro_profile;
  get diagnostics _n = row_count;

  update public.chair_promotions set notified_count = _n where id = new.id;
  return new;
end;
$$;

drop trigger if exists t_notify_chair_audience on public.chair_promotions;
create trigger t_notify_chair_audience
  after insert on public.chair_promotions
  for each row execute function public.notify_chair_audience();

-- ----------------------------------------------------------------------------
-- Atomic claim: reserve the open slot for the caller and create a discounted
-- booking (reusing create_booking). SECURITY DEFINER so the non-owner claimer
-- can flip the row despite chair_owner_write RLS; auth.uid() stays the claimer,
-- so the booking is created for them. Returns the booking + discounted deposit.
-- ----------------------------------------------------------------------------
create or replace function public.claim_chair_promotion(_promo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _promo record;
  _claimed int;
  _booking_id uuid;
  _disc numeric;
  _deposit int;
  _pro_profile uuid;
begin
  if _uid is null then raise exception 'authentication required'; end if;

  select * into _promo from public.chair_promotions where id = _promo_id for update;
  if not found then raise exception 'deal not found'; end if;
  if _promo.service_id is null then raise exception 'deal has no service to book'; end if;
  if _promo.status <> 'open' then raise exception 'this deal is no longer open'; end if;
  if _promo.expires_at is not null and _promo.expires_at <= now() then
    raise exception 'this deal has expired';
  end if;

  -- Reserve it (atomic — a racing claim updates 0 rows and bails).
  update public.chair_promotions
     set status = 'claimed', claimed_by_profile_id = _uid
   where id = _promo_id and status = 'open';
  get diagnostics _claimed = row_count;
  if _claimed = 0 then raise exception 'this slot was just claimed'; end if;

  -- Create the booking for the claimer (slot_at carries the real datetime).
  _booking_id := public.create_booking(
    _promo.pro_id,
    coalesce(_promo.slot_at, now())::date,
    _promo.slot_at,
    jsonb_build_array(jsonb_build_object('service_id', _promo.service_id))
  );

  -- Apply the discount to the line item + booking totals.
  _disc := 1 - (_promo.discount_pct::numeric / 100);
  update public.booking_line_items
     set price = round(price * _disc), deposit = round(deposit * _disc)
   where booking_id = _booking_id;
  update public.bookings b
     set service_total = (select coalesce(sum(price), 0) from public.booking_line_items where booking_id = b.id),
         deposit_total = (select coalesce(sum(deposit), 0) from public.booking_line_items where booking_id = b.id)
   where b.id = _booking_id
   returning deposit_total into _deposit;

  update public.chair_promotions set booking_id = _booking_id where id = _promo_id;

  -- Notify the pro.
  select profile_id into _pro_profile from public.pros where id = _promo.pro_id;
  insert into public.notifications (recipient_profile_id, kind, body, link_screen)
  values (_pro_profile, 'chair', 'A client claimed your open chair.', 'fillchair');

  return jsonb_build_object('booking_id', _booking_id, 'pro_id', _promo.pro_id, 'deposit_total', _deposit);
end;
$$;

grant execute on function public.claim_chair_promotion(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Expire open deals past their window (hourly via pg_cron).
-- ----------------------------------------------------------------------------
create or replace function public.expire_chair_promotions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare _n int;
begin
  update public.chair_promotions
     set status = 'expired'
   where status = 'open' and expires_at is not null and expires_at <= now();
  get diagnostics _n = row_count;
  return _n;
end;
$$;

revoke all on function public.expire_chair_promotions() from public, anon, authenticated;
grant execute on function public.expire_chair_promotions() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'expire_chair_promotions') then
      perform cron.unschedule('expire_chair_promotions');
    end if;
    perform cron.schedule('expire_chair_promotions', '0 * * * *',
      $cron$ select public.expire_chair_promotions(); $cron$);
  else
    raise notice 'pg_cron not available; skipping chair-promotion expiry scheduling';
  end if;
end $$;
