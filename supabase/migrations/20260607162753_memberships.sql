-- Batch 8 ticket 5 — memberships.
-- Adds a structured member benefit (discount %), Stripe linkage columns, a guard
-- so memberships are server-managed (mirror Stripe, never client-set), and member
-- pricing auto-applied inside create_booking (server-authoritative).

alter table public.membership_tiers
  add column if not exists member_discount_pct int not null default 0 check (member_discount_pct between 0 and 100),
  add column if not exists stripe_price_id text;

alter table public.memberships
  add column if not exists stripe_customer_id text;

-- memberships mirror Stripe; only the server (service_role) may write them.
create or replace function public.guard_memberships()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'memberships are managed by the system — subscribe through the app';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists memberships_guard on public.memberships;
create trigger memberships_guard
  before insert or update or delete on public.memberships
  for each row execute function public.guard_memberships();

-- create_booking with member pricing: an active membership with this pro applies
-- its discount to each line item (price + deposit). The discount comes from the
-- DB membership, never the client.
create or replace function public.create_booking(
  _pro_id uuid,
  _service_date date,
  _start_time timestamptz default null,
  _items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _booking_id uuid;
  _item jsonb;
  _svc record;
  _cursor timestamptz := _start_time;
  _service_total int := 0;
  _deposit_total int := 0;
  _sort int := 0;
  _can_charge boolean;
  _discount int := 0;
  _price int;
  _deposit int;
begin
  if _uid is null then raise exception 'authentication required'; end if;
  if _service_date is null then raise exception 'service_date is required'; end if;
  if _items is null or jsonb_array_length(_items) = 0 then raise exception 'at least one service is required'; end if;

  select charges_enabled into _can_charge from public.pros where id = _pro_id;
  if _can_charge is null then raise exception 'pro not found'; end if;
  if not _can_charge then raise exception 'this pro is not accepting bookings yet'; end if;

  -- Active member discount with this pro (0 if none).
  select coalesce(max(mt.member_discount_pct), 0) into _discount
    from public.memberships m
    join public.membership_tiers mt on mt.id = m.tier_id
   where m.member_profile_id = _uid and m.status = 'active' and mt.pro_id = _pro_id;

  insert into public.bookings (client_profile_id, pro_id, service_date, start_time, status)
  values (_uid, _pro_id, _service_date, _start_time, 'pending')
  returning id into _booking_id;

  for _item in select value from jsonb_array_elements(_items)
  loop
    select id, name, duration_min, price, deposit, is_addon
      into _svc
      from public.services
     where id = (_item->>'service_id')::uuid and pro_id = _pro_id and active = true;
    if not found then raise exception 'service % is not offered by this pro', _item->>'service_id'; end if;

    _price := _svc.price;
    _deposit := _svc.deposit;
    if _discount > 0 then
      _price := round(_svc.price * (100 - _discount) / 100.0);
      _deposit := round(_svc.deposit * (100 - _discount) / 100.0);
    end if;

    insert into public.booking_line_items (
      booking_id, household_member_id, service_id, service_name,
      is_addon, price, deposit, duration_min, scheduled_at, sort
    ) values (
      _booking_id, nullif(_item->>'household_member_id', '')::uuid,
      _svc.id, _svc.name, _svc.is_addon, _price, _deposit, _svc.duration_min, _cursor, _sort
    );

    _service_total := _service_total + _price;
    _deposit_total := _deposit_total + _deposit;
    if _cursor is not null then _cursor := _cursor + make_interval(mins => _svc.duration_min); end if;
    _sort := _sort + 1;
  end loop;

  update public.bookings
     set service_total = _service_total, deposit_total = _deposit_total, updated_at = now()
   where id = _booking_id;

  return _booking_id;
end;
$$;
