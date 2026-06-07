-- Option A3 — let the Eventbrite webhook (service role, no auth.uid()) reuse the
-- attendee aggregation. Split import_event_attendees into an unchecked core +
-- the admin wrapper (same pattern as compute_award_winners). Behaviour is
-- identical; only the call surface widens to service_role.

create or replace function public._import_event_attendees(_event_id uuid, _source text, _rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  _row jsonb;
  _email text;
  _pid uuid;
  _n int := 0;
begin
  if _source not in ('eventbrite', 'posh_vip', 'manual') then
    raise exception 'use buy_event_ticket for in-app stripe sales';
  end if;

  for _row in select * from jsonb_array_elements(coalesce(_rows, '[]'::jsonb))
  loop
    _email := lower(nullif(_row->>'email', ''));
    _pid := null;
    if _email is not null then
      select id into _pid from public.profiles where lower(email) = _email limit 1;
    end if;

    insert into public.event_attendees (event_id, source, external_ref, profile_id, name, email, ticket_type, qty, amount, status, raw)
    values (
      _event_id, _source, nullif(_row->>'external_ref', ''), _pid,
      _row->>'name', _email, _row->>'ticket_type',
      coalesce((_row->>'qty')::int, 1),
      (_row->>'amount')::int,
      coalesce(nullif(_row->>'status', ''), 'confirmed'),
      _row
    )
    on conflict (source, external_ref) do update
      set profile_id = excluded.profile_id, name = excluded.name, email = excluded.email,
          ticket_type = excluded.ticket_type, qty = excluded.qty, amount = excluded.amount,
          status = excluded.status, raw = excluded.raw;
    _n := _n + 1;
  end loop;

  return _n;
end;
$$;

revoke all on function public._import_event_attendees(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public._import_event_attendees(uuid, text, jsonb) to service_role;

-- Admin wrapper keeps the guard for the console / manual imports.
create or replace function public.import_event_attendees(_event_id uuid, _source text, _rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return public._import_event_attendees(_event_id, _source, _rows);
end;
$$;

grant execute on function public.import_event_attendees(uuid, text, jsonb) to authenticated;
