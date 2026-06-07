-- Batch 7 — booking status transitions + 24h deposit rule.
-- Adds a deposit_outcome field and a SECURITY DEFINER state-machine function.
-- DEFINER (not INVOKER) so the function enforces its own authorization and
-- supports admin override, which the bookings UPDATE RLS policy does not grant.
-- Actual deposit capture/refund is Batch 8 (Stripe); this records the outcome.

alter table public.bookings
  add column if not exists deposit_outcome text not null default 'pending'
  check (deposit_outcome in ('pending', 'forfeited', 'released', 'applied'));

-- Valid transitions by actor:
--   confirm:  pending   -> confirmed   (pro/admin)
--   complete: confirmed -> completed   (pro/admin)  deposit applied
--   no_show:  confirmed -> no_show     (pro/admin)  deposit forfeited
--   cancel:   pending|confirmed -> cancelled (client/pro/admin)
--             client within 24h  -> forfeited; else released; pro/admin -> released
create or replace function public.transition_booking(_booking_id uuid, _action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _b record;
  _uid uuid := auth.uid();
  _is_client boolean;
  _is_pro boolean;
  _is_admin boolean;
  _is_staff boolean;
  _new_status booking_status;
  _outcome text;
  _within_24h boolean;
begin
  if _uid is null then
    raise exception 'authentication required';
  end if;

  select * into _b from public.bookings where id = _booking_id;
  if not found then
    raise exception 'booking not found';
  end if;

  _is_client := _b.client_profile_id = _uid;
  _is_pro := public.owns_pro(_b.pro_id);
  _is_admin := public.is_admin();
  _is_staff := _is_pro or _is_admin;
  if not (_is_client or _is_staff) then
    raise exception 'not authorized for this booking';
  end if;

  _outcome := _b.deposit_outcome;

  if _action = 'confirm' then
    if not _is_staff then raise exception 'only the pro can confirm a booking'; end if;
    if _b.status <> 'pending' then raise exception 'can only confirm a pending booking'; end if;
    _new_status := 'confirmed';

  elsif _action = 'complete' then
    if not _is_staff then raise exception 'only the pro can complete a booking'; end if;
    if _b.status <> 'confirmed' then raise exception 'can only complete a confirmed booking'; end if;
    _new_status := 'completed';
    _outcome := 'applied';

  elsif _action = 'no_show' then
    if not _is_staff then raise exception 'only the pro can mark a no-show'; end if;
    if _b.status <> 'confirmed' then raise exception 'can only mark a confirmed booking as no-show'; end if;
    _new_status := 'no_show';
    _outcome := 'forfeited';

  elsif _action = 'cancel' then
    if _b.status not in ('pending', 'confirmed') then
      raise exception 'can only cancel a pending or confirmed booking';
    end if;
    _new_status := 'cancelled';
    if _is_staff then
      _outcome := 'released'; -- pro/admin cancellation: refund the client
    else
      -- client cancellation: forfeit the deposit if within 24h of start
      _within_24h := _b.start_time is not null and now() >= (_b.start_time - interval '24 hours');
      _outcome := case when _within_24h then 'forfeited' else 'released' end;
    end if;

  else
    raise exception 'unknown action: %', _action;
  end if;

  update public.bookings
     set status = _new_status,
         deposit_outcome = _outcome,
         updated_at = now()
   where id = _booking_id;

  return jsonb_build_object('id', _booking_id, 'status', _new_status, 'deposit_outcome', _outcome);
end;
$$;

grant execute on function public.transition_booking(uuid, text) to authenticated;
