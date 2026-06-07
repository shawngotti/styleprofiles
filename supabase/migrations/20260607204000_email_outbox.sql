-- Transactional email via Resend. We don't send from the request path; instead a
-- trigger mirrors email-worthy notifications into an outbox, and the
-- process_email_outbox Edge Function (Resend) drains it with retries. This
-- decouples sending, survives provider hiccups, and respects per-user opt-out.

alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

create table if not exists public.email_outbox (
  id            uuid primary key default gen_random_uuid(),
  to_profile_id uuid references public.profiles(id) on delete set null,
  to_email      text not null,
  subject       text not null,
  body          text not null,
  kind          text,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts      int not null default 0,
  error         text,
  provider_id   text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists email_outbox_pending on public.email_outbox (status, created_at);

alter table public.email_outbox enable row level security;
-- Admin-only visibility; the trigger (definer) and processor (service role) write.
drop policy if exists email_outbox_admin on public.email_outbox;
create policy email_outbox_admin on public.email_outbox for select using (public.is_admin());

-- Enqueue an email for transactional notification kinds, honoring opt-out. Fires
-- on every notification insert, so it automatically covers all current senders
-- (awards scheduler, fill-my-chair, prize payout, etc.).
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
  if new.kind is null or new.kind not in ('booking', 'chair', 'awards', 'lineup') then
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
    else 'StyleProfiles'
  end;

  insert into public.email_outbox (to_profile_id, to_email, subject, body, kind)
  values (new.recipient_profile_id, _email, _subject, new.body, new.kind);
  return new;
end;
$$;

drop trigger if exists t_enqueue_email on public.notifications;
create trigger t_enqueue_email
  after insert on public.notifications
  for each row execute function public.enqueue_email();
