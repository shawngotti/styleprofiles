-- Batch 7 — geographic search.
-- Returns pros within an optional radius of a point, sorted by distance, with a
-- distance_mi column. Haversine in plain SQL (no PostGIS/earthdistance needed).
-- Pros are public-read, so this is callable by anon + authenticated.

create or replace function public.pros_near(
  _lat double precision,
  _lng double precision,
  _radius_mi double precision default null
)
returns table (
  id uuid,
  handle text,
  display_name text,
  category text,
  bio text,
  city text,
  verified boolean,
  rating_avg numeric,
  rating_count integer,
  price_from integer,
  latitude double precision,
  longitude double precision,
  travel_mode text,
  distance_mi double precision
)
language sql
stable
set search_path = public
as $$
  select * from (
    select
      p.id, p.handle, p.display_name, p.category, p.bio, p.city, p.verified,
      p.rating_avg, p.rating_count, p.price_from, p.latitude, p.longitude, p.travel_mode,
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
