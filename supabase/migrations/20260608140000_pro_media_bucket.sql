-- Public bucket for pro storefront media (avatar / cover / portfolio). Public so
-- <img> tags render without signed URLs (these aren't sensitive). A pro writes
-- only to their own profile-id folder; everyone can read.

insert into storage.buckets (id, name, public)
values ('pro-media', 'pro-media', true)
on conflict (id) do nothing;

drop policy if exists "pro-media owner write" on storage.objects;
create policy "pro-media owner write" on storage.objects for all to authenticated
  using (bucket_id = 'pro-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pro-media' and (storage.foldername(name))[1] = auth.uid()::text);
