-- Option A1 — reviews are server-authoritative for reputation. Two triggers:
--   * review_set_verified: a review is 'verified' iff it's tied to the author's
--     own completed booking with that pro (clients can't fake the verified badge).
--   * recompute_pro_rating: keep pros.rating_avg / rating_count in sync with the
--     reviews table (the cache the UI + ranking read), instead of trusting a
--     client-set number.

create or replace function public.review_set_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.verified := new.booking_id is not null and exists (
    select 1 from public.bookings b
    where b.id = new.booking_id
      and b.client_profile_id = new.author_profile_id
      and b.pro_id = new.pro_id
      and b.status = 'completed'
  );
  return new;
end;
$$;

drop trigger if exists t_review_set_verified on public.reviews;
create trigger t_review_set_verified
  before insert or update on public.reviews
  for each row execute function public.review_set_verified();

create or replace function public.recompute_pro_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _pid uuid := coalesce(new.pro_id, old.pro_id);
begin
  update public.pros p
    set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where pro_id = _pid), 0),
        rating_count = (select count(*) from public.reviews where pro_id = _pid)
    where p.id = _pid;
  return null;
end;
$$;

drop trigger if exists t_recompute_pro_rating on public.reviews;
create trigger t_recompute_pro_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_pro_rating();
