-- Batch 6 — Auth & roles starter (Appendix A of the architecture doc).
-- Adds: (1) signup trigger that creates a profile + default 'client' role,
--       (2) admin-guarded grant_pro_role() for the pro-approval path.

-- Auto-create a profile + default 'client' role when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin-only helper to elevate a profile to pro (called after pro application approval).
create or replace function public.grant_pro_role(_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins may grant the pro role';
  end if;
  insert into public.user_roles (user_id, role)
  values (_user_id, 'pro')
  on conflict (user_id, role) do nothing;
end;
$$;
