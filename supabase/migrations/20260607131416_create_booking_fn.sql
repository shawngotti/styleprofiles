-- Batch 7 — create_booking engine.
-- Atomic: inserts the parent booking + N line items in one transaction.
-- SECURITY INVOKER so RLS and auth.uid() apply (the caller must be the client).
-- Server-authoritative: validates each service belongs to the pro and snapshots
-- price/deposit/duration from the DB — never trusts client-sent money.
-- Computes back-to-back scheduled_at from durations. Deposit PaymentIntent is
-- added in Batch 8 (Stripe); for now the booking lands in 'pending'.
--
-- _items: jsonb array of { "service_id": uuid, "household_member_id": uuid? }

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

  -- Parent booking (RLS bookings_client_write requires client_profile_id = auth.uid()).
  insert into public.bookings (client_profile_id, pro_id, service_date, start_time, status)
  values (_uid, _pro_id, _service_date, _start_time, 'pending')
  returning id into _booking_id;

  for _item in select value from jsonb_array_elements(_items)
  loop
    -- Validate the service belongs to THIS pro and is active. Snapshot its values.
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

grant execute on function public.create_booking(uuid, date, timestamptz, jsonb) to authenticated;
