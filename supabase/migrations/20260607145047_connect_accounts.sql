-- Batch 8 ticket 1 — Stripe Connect accounts on pros + booking gate.

alter table public.pros
  add column if not exists stripe_account_id text,
  add column if not exists charges_enabled boolean not null default false,
  add column if not exists payouts_enabled boolean not null default false;

-- Guard: these payment-state columns are managed by the server only. Even
-- though pros_owner_write lets a pro edit their own row, they must NOT be able
-- to flip charges_enabled themselves — only the Edge Functions (service_role)
-- mirror Stripe's truth. Clients changing these columns are rejected.
create or replace function public.guard_pro_payment_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.stripe_account_id is distinct from old.stripe_account_id
       or new.charges_enabled is distinct from old.charges_enabled
       or new.payouts_enabled is distinct from old.payouts_enabled then
      raise exception 'payment account fields are managed by the system';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pros_guard_payment_cols on public.pros;
create trigger pros_guard_payment_cols
  before update on public.pros
  for each row execute function public.guard_pro_payment_cols();

-- Gate booking creation on the pro being able to accept charges. Re-creates
-- create_booking() with the same body plus an up-front charges_enabled check.
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
begin
  if _uid is null then
    raise exception 'authentication required';
  end if;
  if _service_date is null then
    raise exception 'service_date is required';
  end if;
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'at least one service is required';
  end if;

  select charges_enabled into _can_charge from public.pros where id = _pro_id;
  if _can_charge is null then
    raise exception 'pro not found';
  end if;
  if not _can_charge then
    raise exception 'this pro is not accepting bookings yet';
  end if;

  insert into public.bookings (client_profile_id, pro_id, service_date, start_time, status)
  values (_uid, _pro_id, _service_date, _start_time, 'pending')
  returning id into _booking_id;

  for _item in select value from jsonb_array_elements(_items)
  loop
    select id, name, duration_min, price, deposit, is_addon
      into _svc
      from public.services
     where id = (_item->>'service_id')::uuid
       and pro_id = _pro_id
       and active = true;

    if not found then
      raise exception 'service % is not offered by this pro', _item->>'service_id';
    end if;

    insert into public.booking_line_items (
      booking_id, household_member_id, service_id, service_name,
      is_addon, price, deposit, duration_min, scheduled_at, sort
    ) values (
      _booking_id,
      nullif(_item->>'household_member_id', '')::uuid,
      _svc.id, _svc.name, _svc.is_addon, _svc.price, _svc.deposit, _svc.duration_min,
      _cursor, _sort
    );

    _service_total := _service_total + _svc.price;
    _deposit_total := _deposit_total + _svc.deposit;
    if _cursor is not null then
      _cursor := _cursor + make_interval(mins => _svc.duration_min);
    end if;
    _sort := _sort + 1;
  end loop;

  update public.bookings
     set service_total = _service_total,
         deposit_total = _deposit_total,
         updated_at = now()
   where id = _booking_id;

  return _booking_id;
end;
$$;
