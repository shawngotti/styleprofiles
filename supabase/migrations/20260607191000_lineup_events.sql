-- Batch 11 P5 — events, multi-source ticketing, champion perk, prize payout.
-- Decision #2: in-app Stripe is the authoritative first-party seller; Eventbrite
-- (and manual/Posh) sync into ONE event_attendees ledger. Decision #5: champion
-- gets a time-limited featured slot + a smaller permanent metro boost.

-- ----------------------------------------------------------------------------
-- 1. Events gain ticketing fields. Relax the provider hint to include eventbrite.
-- ----------------------------------------------------------------------------
alter table public.events
  add column if not exists title text,
  add column if not exists capacity int,
  add column if not exists ticket_price integer,          -- cents, in-app Stripe tickets
  add column if not exists status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  add column if not exists eventbrite_event_id text;

alter table public.events drop constraint if exists events_ticketing_provider_check;
alter table public.events
  add constraint events_ticketing_provider_check
  check (ticketing_provider in ('stripe', 'eventbrite', 'posh_vip'));

-- ----------------------------------------------------------------------------
-- 2. Unified attendee ledger. Idempotent on (source, external_ref) so re-syncing
--    never double-counts. Only the 'stripe' source is a financial record; other
--    sources are reported mirrors.
-- ----------------------------------------------------------------------------
create table if not exists public.event_attendees (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  source       text not null check (source in ('stripe', 'eventbrite', 'posh_vip', 'manual')),
  external_ref text,
  profile_id   uuid references public.profiles(id) on delete set null,
  name         text,
  email        text,
  ticket_type  text,
  qty          int not null default 1 check (qty > 0),
  status       text not null default 'confirmed' check (status in ('pending', 'confirmed', 'refunded', 'checked_in', 'cancelled')),
  amount       integer,                                    -- cents
  stripe_payment_intent_id text,
  purchased_at timestamptz not null default now(),
  raw          jsonb,
  unique (source, external_ref)
);
create index if not exists event_attendees_event on public.event_attendees (event_id);
create index if not exists event_attendees_profile on public.event_attendees (profile_id);

alter table public.event_attendees enable row level security;
drop policy if exists attendees_self_read on public.event_attendees;
create policy attendees_self_read on public.event_attendees for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists attendees_admin on public.event_attendees;
create policy attendees_admin on public.event_attendees for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. mark_ticket_paid — the one idempotent place an in-app ticket confirms.
--    Guards capacity. Called by confirm_event_ticket + the Stripe webhook.
-- ----------------------------------------------------------------------------
create or replace function public.mark_ticket_paid(_attendee_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _a record;
  _cap int;
  _confirmed int;
begin
  select * into _a from public.event_attendees where id = _attendee_id for update;
  if _a is null then raise exception 'attendee not found'; end if;
  if _a.status <> 'pending' then return _a.status; end if;  -- idempotent

  select capacity into _cap from public.events where id = _a.event_id for update;
  if _cap is not null then
    select coalesce(sum(qty), 0) into _confirmed
      from public.event_attendees
      where event_id = _a.event_id and status in ('confirmed', 'checked_in');
    if _confirmed + _a.qty > _cap then
      raise exception 'event is sold out';
    end if;
  end if;

  update public.event_attendees set status = 'confirmed' where id = _attendee_id;
  return 'confirmed';
end;
$$;

revoke all on function public.mark_ticket_paid(uuid) from public, anon, authenticated;
grant execute on function public.mark_ticket_paid(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 4. import_event_attendees — the aggregation core. A production Eventbrite
--    webhook fetches the order from the Eventbrite API then calls this; it
--    upserts idempotently and best-effort matches email -> a platform profile.
-- ----------------------------------------------------------------------------
create or replace function public.import_event_attendees(_event_id uuid, _source text, _rows jsonb)
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
  if not public.is_admin() then raise exception 'admins only'; end if;
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
      set profile_id = excluded.profile_id,
          name = excluded.name,
          email = excluded.email,
          ticket_type = excluded.ticket_type,
          qty = excluded.qty,
          amount = excluded.amount,
          status = excluded.status,
          raw = excluded.raw;
    _n := _n + 1;
  end loop;

  return _n;
end;
$$;

grant execute on function public.import_event_attendees(uuid, text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Champion perk (decision #5): featured slot + permanent boost, applied when
--    a contestant is crowned. Plus prize payout bookkeeping on the contestant.
-- ----------------------------------------------------------------------------
alter table public.pros
  add column if not exists featured_until timestamptz,
  add column if not exists champion_boost numeric not null default 0;

alter table public.contestants
  add column if not exists prize_cents integer,
  add column if not exists prize_transfer_id text;

create or replace function public.apply_champion_perk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'champion' and old.status is distinct from 'champion' then
    update public.pros
      set featured_until = greatest(coalesce(featured_until, now()), now()) + interval '30 days',
          champion_boost = champion_boost + 0.5
      where id = new.pro_id;
  end if;
  return new;
end;
$$;

drop trigger if exists t_champion_perk on public.contestants;
create trigger t_champion_perk
  after update on public.contestants
  for each row execute function public.apply_champion_perk();

-- ----------------------------------------------------------------------------
-- 6. pros_near gains featured_until + champion_boost so "near me" can surface
--    the featured/champion lift too (recreate: return type changes).
-- ----------------------------------------------------------------------------
drop function if exists public.pros_near(double precision, double precision, double precision);
create function public.pros_near(
  _lat double precision,
  _lng double precision,
  _radius_mi double precision default null
)
returns table (
  id uuid, handle text, display_name text, category text, bio text, city text,
  verified boolean, rating_avg numeric, rating_count integer, price_from integer,
  latitude double precision, longitude double precision, travel_mode text,
  featured_until timestamptz, champion_boost numeric, distance_mi double precision
)
language sql
stable
set search_path = public
as $$
  select * from (
    select
      p.id, p.handle, p.display_name, p.category, p.bio, p.city, p.verified,
      p.rating_avg, p.rating_count, p.price_from, p.latitude, p.longitude, p.travel_mode,
      p.featured_until, p.champion_boost,
      3958.8 * acos(least(1, greatest(-1,
        cos(radians(_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(_lng))
        + sin(radians(_lat)) * sin(radians(p.latitude))
      ))) as distance_mi
    from public.pros p
    where p.latitude is not null and p.longitude is not null
  ) q
  where _radius_mi is null or q.distance_mi <= _radius_mi
  order by q.distance_mi
$$;

grant execute on function public.pros_near(double precision, double precision, double precision) to anon, authenticated;
