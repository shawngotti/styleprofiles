-- Follow-ups: screen pro replies, and email pros on a new review.
--
-- 1. Pro replies now post only through submit_review_reply (service role),
--    which screens the text — so direct owner writes are removed (the public
--    read stays).
-- 2. notify_review_reply gets its own kind ('review_reply') so it stays in-app
--    only, while a new 'review' email is sent to pros for new reviews.

-- ----------------------------------------------------------------------------
-- 1. Lock down review_responses writes to the screening function.
-- ----------------------------------------------------------------------------
drop policy if exists review_resp_owner_write on public.review_responses;
-- (review_resp_public_read remains; submit_review_reply writes via service role)

-- ----------------------------------------------------------------------------
-- 2. Reply notifications use a distinct kind (in-app only, not emailed).
-- ----------------------------------------------------------------------------
create or replace function public.notify_review_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _author uuid;
  _name   text;
begin
  select r.author_profile_id, p.display_name
    into _author, _name
  from public.reviews r join public.pros p on p.id = r.pro_id
  where r.id = new.review_id;

  if _author is not null then
    insert into public.notifications (recipient_profile_id, kind, body, link_screen)
    values (_author, 'review_reply',
            coalesce(_name, 'Your stylist') || ' replied to your review', 'appointments');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Email pros on a new review (kind 'review'), honoring opt-out. Reply
--    notifications ('review_reply') stay in-app only.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _opt boolean;
  _subject text;
begin
  if new.kind is null or new.kind not in ('booking', 'chair', 'awards', 'lineup', 'review') then
    return new;
  end if;

  select email, email_notifications into _email, _opt
  from public.profiles where id = new.recipient_profile_id;
  if _email is null or _opt is false then
    return new;
  end if;

  _subject := case new.kind
    when 'booking' then 'Your StyleProfiles appointment'
    when 'chair'   then 'A StyleProfiles flash deal'
    when 'awards'  then 'StyleProfiles Awards update'
    when 'lineup'  then 'The Lineup update'
    when 'review'  then 'You have a new review on StyleProfiles'
    else 'StyleProfiles'
  end;

  insert into public.email_outbox (to_profile_id, to_email, subject, body, kind)
  values (new.recipient_profile_id, _email, _subject, new.body, new.kind);
  return new;
end;
$$;
